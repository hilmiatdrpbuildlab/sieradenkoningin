/**
 * Checkout (P2-04, P2-05, P2-07). Everything is recomputed on the server from the cart rows:
 * prices from variants, the discount from the code (incl. per-customer limit for the e-mail
 * entered), shipping from the zone rates, VAT per line via computeTotals().
 *
 * placeOrder():
 *   1. quote (outside the transaction, read-only)
 *   2. ONE transaction: lock variants FOR UPDATE → verify availability → insert order + lines +
 *      reservations (15 min) + 'placed' event (services/orders.ts insertOrder)
 *   3. create the provider payment (outside the transaction: no row locks held during network I/O)
 */
import { asc, eq, sql } from 'drizzle-orm';
import type { DB, Executor } from '../db/index.ts';
import { cartLines, carts, media, productImages, products, variants } from '../db/schema.ts';
import type { Address, I18n, ServicePoint } from '../db/schema.ts';
import type { PaymentsAdapter } from '../adapters/payments.ts';
import type { ShippingAdapter } from '../adapters/shipping.ts';
import type { CheckoutData } from '../../schemas/checkout.ts';
import type { Lang } from '../../i18n/paths.ts';
import { tr } from '../../i18n/index.ts';
import { getRates, variantLabelI18n } from './cart.ts';
import { evaluateDiscount, lookupDiscount, type DiscountFailure } from './discounts.ts';
import { computeTotals, shippingPrice, unitPrice, VAT_BP, type ShippingRate, type Totals } from './pricing.ts';
import { getSetting } from './settings.ts';
import { InsufficientStockError, type StockShortage } from './inventory-reservations.ts';
import { abandonOrder, createPaymentForOrder, insertOrder, type NewOrderLine, type OrderRow } from './orders.ts';

export interface QuoteLine {
	variantId: string;
	productId: string;
	sku: string;
	name: I18n;
	variantLabel: I18n;
	imageKey: string | null;
	unitPrice: number;
	qty: number;
	giftWrap: boolean;
	engraving: { text: string; font: string } | null;
	active: boolean;
}

/** Cart lines with everything an order line snapshots (translations of name + variant label). */
export async function cartLinesForOrder(db: Executor, cartId: string): Promise<QuoteLine[]> {
	const rows = await db
		.select({
			line: cartLines,
			variant: variants,
			product: { id: products.id, name: products.name, price: products.price, status: products.status },
			imageKey: sql<
				string | null
			>`(select ${media.storageKey} from ${productImages} join ${media} on ${media.id} = ${productImages.mediaId} where ${productImages.productId} = ${sql.raw('"products"."id"')} order by ${productImages.position} limit 1)`
		})
		.from(cartLines)
		.innerJoin(variants, eq(variants.id, cartLines.variantId))
		.innerJoin(products, eq(products.id, variants.productId))
		.where(eq(cartLines.cartId, cartId))
		.orderBy(asc(cartLines.createdAt));
	return rows.map(({ line, variant, product, imageKey }) => ({
		variantId: variant.id,
		productId: product.id,
		sku: variant.sku,
		name: product.name,
		variantLabel: variantLabelI18n(variant.metal, variant.size),
		imageKey,
		unitPrice: unitPrice(product, variant),
		qty: line.qty,
		giftWrap: line.giftWrap,
		engraving: line.engraving ?? null,
		active: product.status === 'active'
	}));
}

export interface Quote {
	lines: QuoteLine[];
	totals: Totals;
	method: 'home' | 'pickup';
	discountCode: string | null;
	discountError: DiscountFailure | null;
	freeShipping: boolean;
	shippingAvailable: boolean;
}

/** Pure: totals for a set of lines, a (validated) discount and a shipping method. */
export function quoteFromLines(
	lines: QuoteLine[],
	discount: { amount: number; freeShipping: boolean },
	rates: ShippingRate[],
	defaultFreeFrom: number,
	method: 'home' | 'pickup'
): { totals: Totals; shippingAvailable: boolean } {
	const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
	const ship = shippingPrice(
		rates,
		method,
		subtotal - Math.min(discount.amount, subtotal),
		defaultFreeFrom,
		discount.freeShipping
	);
	return {
		totals: computeTotals(
			lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty })),
			discount.amount,
			ship ?? 0
		),
		shippingAvailable: ship !== null
	};
}

/** Server-side quote for the cart (both methods are cheap, so the page shows both). */
export async function buildQuote(
	db: Executor,
	input: { cartId: string; email?: string | null; country: string; method: 'home' | 'pickup' }
): Promise<Quote> {
	const [cart] = await db.select().from(carts).where(eq(carts.id, input.cartId));
	const lines = cart ? await cartLinesForOrder(db, cart.id) : [];
	const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
	let discount = { amount: 0, freeShipping: false };
	let discountError: DiscountFailure | null = null;
	if (cart?.discountCode) {
		const { discount: d, totalUses, customerUses } = await lookupDiscount(db, cart.discountCode, input.email);
		const r = evaluateDiscount(d, { subtotal, totalUses, customerUses });
		if (r.ok) discount = { amount: r.amount, freeShipping: r.freeShipping };
		else discountError = r.reason;
	}
	const [rates, shipping] = await Promise.all([getRates(db, input.country), getSetting(db, 'shipping')]);
	const { totals, shippingAvailable } = quoteFromLines(lines, discount, rates, shipping.freeFrom, input.method);
	return {
		lines,
		totals,
		method: input.method,
		discountCode: discountError ? null : (cart?.discountCode ?? null),
		discountError,
		freeShipping: discount.freeShipping,
		shippingAvailable
	};
}

export type PlaceOrderResult =
	| { ok: true; order: OrderRow; checkoutUrl: string }
	| { ok: false; error: 'empty' }
	| { ok: false; error: 'unavailable'; skus: string[] }
	| { ok: false; error: 'stock'; shortages: (StockShortage & { name: string })[] }
	| { ok: false; error: 'discount'; reason: DiscountFailure }
	| { ok: false; error: 'shipping' }
	| { ok: false; error: 'service_point' }
	| { ok: false; error: 'payment' };

export interface PlaceOrderDeps {
	db: DB;
	payments: PaymentsAdapter;
	shipping: Pick<ShippingAdapter, 'servicePoints'>;
	siteUrl: string;
}

const fullName = (first?: string, last?: string) => [first, last].filter(Boolean).join(' ').trim();

export async function placeOrder(
	deps: PlaceOrderDeps,
	input: { cartId: string; lang: Lang; customerId: string | null; data: CheckoutData }
): Promise<PlaceOrderResult> {
	const d = input.data;
	const quote = await buildQuote(deps.db, {
		cartId: input.cartId,
		email: d.email,
		country: d.country,
		method: d.shippingMethod
	});
	if (!quote.lines.length) return { ok: false, error: 'empty' };
	const inactive = quote.lines.filter((l) => !l.active);
	if (inactive.length) return { ok: false, error: 'unavailable', skus: inactive.map((l) => l.sku) };
	if (quote.discountError) return { ok: false, error: 'discount', reason: quote.discountError };
	if (!quote.shippingAvailable) return { ok: false, error: 'shipping' };

	// The pickup point is re-fetched from the carrier: the client only sends its id.
	let servicePoint: ServicePoint | null = null;
	if (d.shippingMethod === 'pickup') {
		const points = await deps.shipping.servicePoints(d.spPostalCode || d.postalCode, d.country).catch(() => []);
		servicePoint = points.find((p) => p.id === d.servicePointId) ?? null;
		if (!servicePoint) return { ok: false, error: 'service_point' };
	}

	const shippingAddress: Address = {
		name: fullName(d.firstName, d.lastName),
		line1: d.line1,
		line2: d.line2,
		postalCode: d.postalCode,
		city: d.city,
		country: d.country,
		phone: d.phone
	};
	const billingAddress: Address = d.billingSame
		? { ...shippingAddress, company: d.company }
		: {
				name: fullName(d.billingFirstName, d.billingLastName),
				company: d.company,
				line1: d.billingLine1 ?? '',
				line2: d.billingLine2,
				postalCode: d.billingPostalCode ?? '',
				city: d.billingCity ?? '',
				country: d.billingCountry ?? d.country
			};

	const t = quote.totals;
	const lines: NewOrderLine[] = quote.lines.map((l, i) => ({
		variantId: l.variantId,
		productId: l.productId,
		sku: l.sku,
		name: l.name,
		variantLabel: l.variantLabel,
		imageKey: l.imageKey,
		unitPrice: l.unitPrice,
		qty: l.qty,
		vatRate: VAT_BP,
		vatAmount: t.lineVat[i],
		lineTotal: l.unitPrice * l.qty,
		discountAmount: t.lineDiscounts[i],
		giftWrap: l.giftWrap,
		engraving: l.engraving
	}));

	let order: OrderRow;
	try {
		order = await deps.db.transaction((tx) =>
			insertOrder(tx, {
				cartId: input.cartId,
				customerId: input.customerId,
				email: d.email,
				locale: input.lang,
				subtotal: t.subtotal,
				discountTotal: t.discount,
				shippingTotal: t.shipping,
				vatTotal: t.vat,
				total: t.total,
				shippingAddress,
				billingAddress,
				vatNumber: d.vatNumber ?? null,
				shippingMethod: d.shippingMethod,
				servicePoint,
				giftWrap: d.giftWrap || quote.lines.some((l) => l.giftWrap),
				giftMessage: d.giftMessage ?? null,
				discountCode: quote.discountCode,
				paymentMethod: d.paymentMethod,
				lines
			})
		);
	} catch (err) {
		if (err instanceof InsufficientStockError) {
			return {
				ok: false,
				error: 'stock',
				shortages: err.shortages.map((s) => {
					const l = quote.lines.find((x) => x.variantId === s.variantId);
					return { ...s, name: l ? `${tr(l.name, input.lang)} (${tr(l.variantLabel, input.lang)})` : s.variantId };
				})
			};
		}
		throw err;
	}

	try {
		const { checkoutUrl } = await createPaymentForOrder(deps, order, d.paymentMethod);
		return { ok: true, order, checkoutUrl };
	} catch (err) {
		console.error('[checkout] payment creation failed', err);
		await abandonOrder(deps.db, order.id, err instanceof Error ? err.message : String(err));
		return { ok: false, error: 'payment' };
	}
}
