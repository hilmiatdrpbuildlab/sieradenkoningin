/**
 * Server cart (P2-01). The cart is identified by the `sk_cart` cookie; prices are ALWAYS recomputed
 * from variants on the server (the client never sends a price). Quantities are capped by
 * available stock = stock − active reservations held by other carts.
 */
import type { Cookies } from '@sveltejs/kit';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { cartLines, carts, productImages, products, media, stockReservations, variants, shippingRates, shippingZones } from '../db/schema.ts';
import type { I18n } from '../db/schema.ts';
import { randomToken } from '../crypto.ts';
import { evaluateDiscount, lookupDiscount, type DiscountFailure } from './discounts.ts';
import { shippingPrice, unitPrice, type ShippingRate } from './pricing.ts';
import { getSetting } from './settings.ts';
import { tr } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/paths.ts';
import type { CartLineView, CartView } from '../../types.ts';

export type { CartLineView, CartView };

export const CART_COOKIE = 'sk_cart';
export const MAX_LINE_QTY = 10;


export const emptyCart = (freeFrom = 5000): CartView => ({
	id: null,
	lines: [],
	count: 0,
	subtotal: 0,
	discount: 0,
	discountCode: null,
	discountError: null,
	freeShipping: false,
	shippingEstimate: 0,
	freeShippingFrom: freeFrom,
	toFreeShipping: freeFrom,
	total: 0
});

const METAL_LABEL: Record<Lang, Record<string, string>> = {
	nl: { gold: 'Goud', rosegold: 'Roségoud', silver: 'Zilver' },
	fr: { gold: 'Or', rosegold: 'Or rose', silver: 'Argent' }
};
export function variantLabel(metal: string, size: string | null, lang: Lang) {
	const sizeLabel = size ? (lang === 'fr' ? `taille ${size}` : `maat ${size}`) : '';
	return [METAL_LABEL[lang][metal] ?? metal, sizeLabel].filter(Boolean).join(' · ');
}
export const variantLabelI18n = (metal: string, size: string | null): I18n => ({ nl: variantLabel(metal, size, 'nl'), fr: variantLabel(metal, size, 'fr') });

export async function findCart(db: Executor, cookies: Cookies) {
	const token = cookies.get(CART_COOKIE);
	if (!token) return null;
	const [cart] = await db.select().from(carts).where(eq(carts.token, token));
	return cart ?? null;
}

export async function getOrCreateCart(db: Executor, cookies: Cookies, lang: Lang, customerId?: string | null) {
	const existing = await findCart(db, cookies);
	if (existing) return existing;
	const token = randomToken(24);
	const [cart] = await db.insert(carts).values({ token, locale: lang, customerId: customerId ?? null }).returning();
	cookies.set(CART_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 86400 });
	return cart;
}

/** Available units per variant for `cartId` (excludes this cart's own reservations). */
export async function availableStock(db: Executor, variantIds: string[], cartId?: string | null): Promise<Map<string, number>> {
	if (!variantIds.length) return new Map();
	const rows = await db
		.select({
			id: variants.id,
			stock: variants.stock,
			reserved: sql<number>`coalesce((select sum(${stockReservations.qty}) from ${stockReservations} where ${stockReservations.variantId} = ${sql.raw('"variants"."id"')} and ${stockReservations.expiresAt} > now() ${cartId ? sql`and ${stockReservations.cartId} <> ${cartId}` : sql``}), 0)::int`
		})
		.from(variants)
		.where(inArray(variants.id, variantIds));
	return new Map(rows.map((r) => [r.id, Math.max(0, r.stock - r.reserved)]));
}

export async function loadCart(db: Executor, cartId: string | null, lang: Lang, opts: { email?: string | null } = {}): Promise<CartView> {
	const shippingSettings = await getSetting(db, 'shipping');
	if (!cartId) return emptyCart(shippingSettings.freeFrom);
	const [cart] = await db.select().from(carts).where(eq(carts.id, cartId));
	if (!cart) return emptyCart(shippingSettings.freeFrom);

	const rows = await db
		.select({
			line: cartLines,
			variant: variants,
			product: { id: products.id, slug: products.slug, name: products.name, price: products.price, compareAtPrice: products.compareAtPrice, status: products.status },
			image: sql<{ key: string; alt: I18n } | null>`(select json_build_object('key', ${media.storageKey}, 'alt', ${productImages.alt}) from ${productImages} join ${media} on ${media.id} = ${productImages.mediaId} where ${productImages.productId} = ${sql.raw('"products"."id"')} order by ${productImages.position} limit 1)`
		})
		.from(cartLines)
		.innerJoin(variants, eq(variants.id, cartLines.variantId))
		.innerJoin(products, eq(products.id, variants.productId))
		.where(eq(cartLines.cartId, cartId))
		.orderBy(asc(cartLines.createdAt));

	const avail = await availableStock(db, rows.map((r) => r.variant.id), cartId);
	const lines: CartLineView[] = rows.map(({ line, variant, product, image }) => {
		const max = Math.min(MAX_LINE_QTY, avail.get(variant.id) ?? 0);
		return {
			id: line.id,
			variantId: variant.id,
			productId: product.id,
			slug: product.slug,
			sku: variant.sku,
			name: tr(product.name, lang),
			variantLabel: variantLabel(variant.metal, variant.size, lang),
			metal: variant.metal,
			size: variant.size,
			imageKey: image?.key ?? null,
			imageAlt: image ? tr(image.alt, lang) : '',
			unitPrice: unitPrice(product, variant),
			compareAtPrice: product.compareAtPrice,
			quantity: line.qty,
			maxQuantity: max,
			giftWrap: line.giftWrap,
			available: product.status === 'active' && max >= line.qty
		};
	});

	const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
	let discount = 0;
	let freeShipping = false;
	let discountError: DiscountFailure | null = null;
	if (cart.discountCode) {
		const { discount: d, totalUses, customerUses } = await lookupDiscount(db, cart.discountCode, opts.email);
		const r = evaluateDiscount(d, { subtotal, totalUses, customerUses });
		if (r.ok) {
			discount = r.amount;
			freeShipping = r.freeShipping;
		} else discountError = r.reason;
	}
	const rates = await getRates(db, 'BE');
	const merch = subtotal - discount;
	const shippingEstimate = lines.length ? (shippingPrice(rates, 'home', merch, shippingSettings.freeFrom, freeShipping) ?? 0) : 0;
	const homeRate = rates.find((r) => r.method === 'home');
	const freeFrom = homeRate?.freeFrom ?? shippingSettings.freeFrom;
	return {
		id: cart.id,
		lines,
		count: lines.reduce((n, l) => n + l.quantity, 0),
		subtotal,
		discount,
		discountCode: cart.discountCode,
		discountError,
		freeShipping,
		shippingEstimate,
		freeShippingFrom: freeFrom,
		toFreeShipping: freeShipping ? 0 : Math.max(0, freeFrom - merch),
		total: merch + shippingEstimate
	};
}

export async function getRates(db: Executor, country: string): Promise<(ShippingRate & { carrier: string })[]> {
	const rows = await db
		.select({ method: shippingRates.method, price: shippingRates.price, freeFrom: shippingRates.freeFrom, active: shippingRates.active, carrier: shippingRates.carrier })
		.from(shippingRates)
		.innerJoin(shippingZones, eq(shippingZones.id, shippingRates.zoneId))
		.where(and(eq(shippingZones.active, true), sql`${country} = any(${shippingZones.countries})`));
	return rows;
}

export type CartMutationError = 'unavailable' | 'not_found' | 'qty';

export async function addToCart(db: Executor, cartId: string, input: { variantId: string; qty: number; giftWrap?: boolean }): Promise<{ ok: true; capped: boolean } | { ok: false; error: CartMutationError }> {
	const [v] = await db
		.select({ id: variants.id, status: products.status })
		.from(variants)
		.innerJoin(products, eq(products.id, variants.productId))
		.where(eq(variants.id, input.variantId));
	if (!v || v.status !== 'active') return { ok: false, error: 'not_found' };
	const available = (await availableStock(db, [v.id], cartId)).get(v.id) ?? 0;
	const [existing] = await db.select().from(cartLines).where(and(eq(cartLines.cartId, cartId), eq(cartLines.variantId, v.id)));
	const wanted = (existing?.qty ?? 0) + Math.max(1, input.qty);
	const qty = Math.min(wanted, available, MAX_LINE_QTY);
	if (qty <= 0) return { ok: false, error: 'unavailable' };
	if (existing) await db.update(cartLines).set({ qty, giftWrap: input.giftWrap ?? existing.giftWrap }).where(eq(cartLines.id, existing.id));
	else await db.insert(cartLines).values({ cartId, variantId: v.id, qty, giftWrap: input.giftWrap ?? false });
	await touch(db, cartId);
	return { ok: true, capped: qty < wanted };
}

export async function setLineQty(db: Executor, cartId: string, lineId: string, qty: number) {
	const [line] = await db.select().from(cartLines).where(and(eq(cartLines.id, lineId), eq(cartLines.cartId, cartId)));
	if (!line) return { ok: false as const, error: 'not_found' as const };
	if (qty <= 0) {
		await db.delete(cartLines).where(eq(cartLines.id, lineId));
	} else {
		const available = (await availableStock(db, [line.variantId], cartId)).get(line.variantId) ?? 0;
		const capped = Math.min(qty, available, MAX_LINE_QTY);
		if (capped <= 0) await db.delete(cartLines).where(eq(cartLines.id, lineId));
		else await db.update(cartLines).set({ qty: capped }).where(eq(cartLines.id, lineId));
	}
	await touch(db, cartId);
	return { ok: true as const };
}

export async function setLineGiftWrap(db: Executor, cartId: string, lineId: string, giftWrap: boolean) {
	await db.update(cartLines).set({ giftWrap }).where(and(eq(cartLines.id, lineId), eq(cartLines.cartId, cartId)));
}

export async function setDiscountCode(db: Executor, cartId: string, code: string | null) {
	await db.update(carts).set({ discountCode: code, updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export async function clearCart(db: Executor, cartId: string) {
	await db.delete(cartLines).where(eq(cartLines.cartId, cartId));
	await db.update(carts).set({ discountCode: null, updatedAt: new Date() }).where(eq(carts.id, cartId));
}

/** On login: move guest cart lines into the customer's cart (P3-01). */
export async function mergeCarts(db: Executor, guestCartId: string, customerId: string) {
	const [own] = await db.select().from(carts).where(and(eq(carts.customerId, customerId), ne(carts.id, guestCartId))).orderBy(sql`${carts.updatedAt} desc`).limit(1);
	await db.update(carts).set({ customerId }).where(eq(carts.id, guestCartId));
	if (!own) return guestCartId;
	const ownLines = await db.select().from(cartLines).where(eq(cartLines.cartId, own.id));
	for (const l of ownLines) {
		const [dup] = await db.select().from(cartLines).where(and(eq(cartLines.cartId, guestCartId), eq(cartLines.variantId, l.variantId)));
		if (dup) await db.update(cartLines).set({ qty: Math.min(MAX_LINE_QTY, Math.max(dup.qty, l.qty)) }).where(eq(cartLines.id, dup.id));
		else await db.update(cartLines).set({ cartId: guestCartId }).where(eq(cartLines.id, l.id));
	}
	await db.delete(carts).where(eq(carts.id, own.id));
	return guestCartId;
}

async function touch(db: Executor, cartId: string) {
	await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
}

/** Purge abandoned anonymous carts (cron). */
export async function purgeOldCarts(db: Executor, days = 60) {
	await db.delete(carts).where(and(sql`${carts.customerId} is null`, sql`${carts.updatedAt} < now() - (${days} || ' days')::interval`));
}

