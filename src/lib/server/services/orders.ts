/**
 * Orders (P2-06, P2-07): numbering, creation, the payment state machine and payment (re)creation.
 *
 * State machine (driven ONLY by the provider's view of a payment — never by a request body):
 *   order.status        pending ──paid──▶ paid
 *                          └──failed | canceled | expired──▶ cancelled
 *   order.paymentStatus open ──▶ paid | failed | canceled | expired
 * `applyPaymentStatus` is idempotent: it locks the payment and the order row, and a transition that
 * already happened is a no-op, so duplicate or out-of-order webhooks change nothing.
 * "Paid" always wins: a payment that completes after the order expired is still booked.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DB, Executor, Tx } from '../db/index.ts';
import {
	carts,
	cartLines,
	discountRedemptions,
	discounts,
	orderEvents,
	orderLines,
	orders,
	payments,
	stockMovements
} from '../db/schema.ts';
import type { Address, I18n, ServicePoint } from '../db/schema.ts';
import type { PaymentsAdapter, ProviderPaymentStatus } from '../adapters/payments.ts';
import { randomToken, safeEqual } from '../crypto.ts';
import { enqueueJob, runJobs, type JobDeps } from '../jobs/index.ts';
import {
	InsufficientStockError,
	insertReservations,
	lockAndCheck,
	releaseReservations,
	reserveStock
} from './inventory-reservations.ts';
import { localizeHref, type Lang } from '../../i18n/paths.ts';
import { TIME_ZONE } from '../../utils/format.ts';

export type OrderRow = typeof orders.$inferSelect;
export type OrderLineRow = typeof orderLines.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;

const PAID_LIKE = ['paid', 'partially_refunded', 'refunded'] as const;
const isPaidLike = (s: string) => (PAID_LIKE as readonly string[]).includes(s);

// ── Numbering ──────────────────────────────────────────────────────────────────

/** Calendar year in Belgium (an order placed on 31/12 23:30 UTC+1 belongs to that year). */
export function brusselsYear(d = new Date()) {
	return Number(new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric' }).format(d));
}

export const formatOrderNumber = (year: number, n: number) => `SK-${year}-${String(n).padStart(6, '0')}`;
export const formatInvoiceNumber = (year: number, n: number) => `SK-INV-${year}-${String(n).padStart(6, '0')}`;

/** Next order number from the `order_number_seq` sequence (gaps are fine for order numbers). */
export async function nextOrderNumber(db: Executor, now = new Date()) {
	const r = await db.execute<{ n: string }>(sql`select nextval('order_number_seq')::text as n`);
	return formatOrderNumber(brusselsYear(now), Number(r.rows[0].n));
}

/**
 * Next invoice number, GAP-FREE per calendar year (Belgian invoicing requires an unbroken series).
 * A sequence can leave gaps when a transaction rolls back after `nextval`, so the number is derived
 * from the highest issued number under a transaction-scoped advisory lock instead: it is only
 * consumed if the paying transaction commits. Must run inside a transaction.
 */
export async function nextInvoiceNumber(tx: Tx, now = new Date()) {
	const year = brusselsYear(now);
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('sk_invoice_number'))`);
	const prefix = `SK-INV-${year}-`;
	const r = await tx.execute<{ n: number | null }>(
		sql`select max(right(invoice_number, 6)::int) as n from orders where invoice_number like ${prefix + '%'}`
	);
	return formatInvoiceNumber(year, Number(r.rows[0]?.n ?? 0) + 1);
}

// ── Creation ───────────────────────────────────────────────────────────────────

export interface NewOrderLine {
	variantId: string;
	productId: string;
	sku: string;
	name: I18n;
	variantLabel: I18n;
	imageKey: string | null;
	unitPrice: number;
	qty: number;
	vatRate: number;
	vatAmount: number;
	lineTotal: number;
	discountAmount: number;
	giftWrap: boolean;
	engraving?: { text: string; font: string } | null;
}

export interface NewOrder {
	cartId: string;
	customerId: string | null;
	email: string;
	locale: Lang;
	subtotal: number;
	discountTotal: number;
	shippingTotal: number;
	vatTotal: number;
	total: number;
	shippingAddress: Address;
	billingAddress: Address;
	vatNumber: string | null;
	shippingMethod: 'home' | 'pickup';
	servicePoint: ServicePoint | null;
	giftWrap: boolean;
	giftMessage: string | null;
	discountCode: string | null;
	paymentMethod: string;
	lines: NewOrderLine[];
}

/**
 * Inserts order + lines + 'placed' event and reserves the stock, inside the caller's transaction.
 * Earlier pending orders of the same cart (abandoned payment attempts) are superseded.
 */
export async function insertOrder(tx: Tx, input: NewOrder): Promise<OrderRow> {
	const now = new Date();
	// 1. Lock the variant rows first and verify availability (see inventory-reservations.ts on lock order).
	const reserveLines = input.lines.map((l) => ({ variantId: l.variantId, qty: l.qty }));
	const shortages = await lockAndCheck(tx, reserveLines, input.cartId);
	if (shortages.length) throw new InsufficientStockError(shortages);

	// Supersede: a customer who comes back from the payment page and checks out again replaces the
	// previous attempt (its reservation is replaced below; "paid" would still win if it completes).
	const previous = await tx
		.update(orders)
		.set({ status: 'cancelled', updatedAt: now })
		.where(and(eq(orders.cartId, input.cartId), eq(orders.status, 'pending'), eq(orders.paymentStatus, 'open')))
		.returning({ id: orders.id });
	for (const p of previous) {
		await tx.insert(orderEvents).values({ orderId: p.id, type: 'superseded', actor: 'system' });
		await releaseReservations(tx, p.id);
	}

	const number = await nextOrderNumber(tx, now);
	const [order] = await tx
		.insert(orders)
		.values({
			number,
			accessToken: randomToken(24),
			customerId: input.customerId,
			email: input.email,
			locale: input.locale,
			status: 'pending',
			paymentStatus: 'open',
			subtotal: input.subtotal,
			discountTotal: input.discountTotal,
			shippingTotal: input.shippingTotal,
			vatTotal: input.vatTotal,
			total: input.total,
			shippingAddress: input.shippingAddress,
			billingAddress: input.billingAddress,
			vatNumber: input.vatNumber,
			shippingMethod: input.shippingMethod,
			servicePoint: input.servicePoint,
			giftWrap: input.giftWrap,
			giftMessage: input.giftMessage,
			discountCode: input.discountCode,
			paymentMethod: input.paymentMethod,
			cartId: input.cartId,
			placedAt: now
		})
		.returning();
	await tx
		.insert(orderLines)
		.values(input.lines.map((l) => ({ ...l, orderId: order.id, engraving: l.engraving ?? null })));
	await insertReservations(tx, { cartId: input.cartId, orderId: order.id, lines: reserveLines });
	await tx.insert(orderEvents).values({
		orderId: order.id,
		type: 'placed',
		actor: 'customer',
		data: { total: input.total, lines: input.lines.length, method: input.shippingMethod, payment: input.paymentMethod }
	});
	return order;
}

// ── Payments ───────────────────────────────────────────────────────────────────

export interface PaymentDeps {
	db: DB;
	payments: PaymentsAdapter;
	siteUrl: string;
}

export const thanksPath = (order: Pick<OrderRow, 'number' | 'accessToken' | 'locale'>) =>
	`${localizeHref(`/checkout/thanks/${order.number}`, order.locale === 'fr' ? 'fr' : 'nl')}?t=${order.accessToken}`;

/** Creates a provider payment for the order and stores it. Returns the URL to send the browser to. */
export async function createPaymentForOrder(
	deps: PaymentDeps,
	order: OrderRow,
	method?: string | null
): Promise<{ payment: PaymentRow; checkoutUrl: string }> {
	const site = deps.siteUrl.replace(/\/$/, '');
	const p = await deps.payments.createPayment({
		orderNumber: order.number,
		amount: order.total,
		description: order.number,
		redirectUrl: `${site}${thanksPath(order)}`,
		webhookUrl: `${site}/api/webhooks/mollie`,
		locale: order.locale === 'fr' ? 'fr' : 'nl',
		method: method ?? order.paymentMethod ?? undefined,
		metadata: { orderId: order.id }
	});
	const [payment] = await deps.db
		.insert(payments)
		.values({
			orderId: order.id,
			provider: deps.payments.provider,
			providerRef: p.id,
			method: p.method ?? method ?? order.paymentMethod,
			amount: order.total,
			status: 'open',
			checkoutUrl: p.checkoutUrl,
			raw: p.raw as object
		})
		.returning();
	await deps.db
		.insert(orderEvents)
		.values({
			orderId: order.id,
			type: 'payment_created',
			actor: 'system',
			data: { provider: deps.payments.provider, ref: p.id, method: payment.method }
		});
	return { payment, checkoutUrl: p.checkoutUrl ?? thanksPath(order) };
}

export type PaymentOutcome = 'unknown' | 'noop' | 'paid' | 'failed';
export interface ApplyResult {
	outcome: PaymentOutcome;
	orderId?: string;
	orderNumber?: string;
	jobIds: string[];
}

type TargetStatus = 'open' | 'paid' | 'failed' | 'canceled' | 'expired';
const toTarget = (s: ProviderPaymentStatus): TargetStatus => (s === 'pending' || s === 'authorized' ? 'open' : s);

/**
 * The payment state machine. `status` must come from the provider (getPayment), never from a request.
 * Runs in its own transaction with row locks on the payment and the order.
 */
export async function applyPaymentStatus(
	db: DB,
	input: { provider: string; providerRef: string; status: ProviderPaymentStatus; method?: string | null; raw?: unknown }
): Promise<ApplyResult> {
	return db.transaction(async (tx) => {
		const [pay] = await tx
			.select()
			.from(payments)
			.where(and(eq(payments.provider, input.provider), eq(payments.providerRef, input.providerRef)))
			.for('update');
		if (!pay) return { outcome: 'unknown' as const, jobIds: [] };
		const [order] = await tx.select().from(orders).where(eq(orders.id, pay.orderId)).for('update');
		const target = toTarget(input.status);
		const base = { orderId: order.id, orderNumber: order.number };

		if (pay.status !== target || (input.method && input.method !== pay.method)) {
			await tx
				.update(payments)
				.set({
					status: target,
					method: input.method ?? pay.method,
					raw: (input.raw as object) ?? pay.raw,
					updatedAt: new Date()
				})
				.where(eq(payments.id, pay.id));
		}
		if (target === 'open') return { outcome: 'noop' as const, ...base, jobIds: [] };

		if (target === 'paid') {
			if (isPaidLike(order.paymentStatus)) return { outcome: 'noop' as const, ...base, jobIds: [] };
			const jobIds = await markPaid(tx, order, { ...pay, method: input.method ?? pay.method });
			return { outcome: 'paid' as const, ...base, jobIds };
		}

		// failed | canceled | expired — only the order's LATEST payment attempt decides, and never after "paid".
		if (isPaidLike(order.paymentStatus) || order.paymentStatus === target)
			return { outcome: 'noop' as const, ...base, jobIds: [] };
		const [latest] = await tx
			.select({ id: payments.id })
			.from(payments)
			.where(eq(payments.orderId, order.id))
			.orderBy(desc(payments.createdAt))
			.limit(1);
		if (latest && latest.id !== pay.id) return { outcome: 'noop' as const, ...base, jobIds: [] };
		const jobIds = await markFailed(tx, order, target, pay.id);
		return { outcome: 'failed' as const, ...base, jobIds };
	});
}

async function markPaid(tx: Tx, order: OrderRow, pay: PaymentRow): Promise<string[]> {
	const now = new Date();
	const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, order.id));
	const perVariant = new Map<string, number>();
	for (const l of lines) if (l.variantId) perVariant.set(l.variantId, (perVariant.get(l.variantId) ?? 0) + l.qty);
	const ids = [...perVariant.keys()].sort();
	const oversold: { variantId: string; missing: number }[] = [];
	if (ids.length) {
		const locked = await tx.execute<{ id: string; stock: number }>(
			sql`select id, stock from variants where id in (${sql.join(
				ids.map((id) => sql`${id}::uuid`),
				sql`, `
			)}) order by id for update`
		);
		for (const row of locked.rows) {
			const qty = perVariant.get(row.id)!;
			const take = Math.min(qty, Number(row.stock));
			if (take < qty) oversold.push({ variantId: row.id, missing: qty - take });
			if (take > 0) {
				await tx.execute(
					sql`update variants set stock = stock - ${take}, updated_at = now() where id = ${row.id}::uuid`
				);
				await tx
					.insert(stockMovements)
					.values({ variantId: row.id, delta: -take, reason: 'sale', refId: order.number, actor: 'system' });
			}
		}
	}
	await releaseReservations(tx, order.id);

	if (order.discountCode) {
		const [d] = await tx.select({ id: discounts.id }).from(discounts).where(eq(discounts.code, order.discountCode));
		if (d)
			await tx
				.insert(discountRedemptions)
				.values({
					discountId: d.id,
					orderId: order.id,
					customerId: order.customerId,
					email: order.email,
					amount: order.discountTotal
				})
				.onConflictDoNothing();
	}

	const invoiceNumber = order.invoiceNumber ?? (await nextInvoiceNumber(tx, now));
	await tx
		.update(orders)
		.set({
			status: 'paid',
			paymentStatus: 'paid',
			paidAt: now,
			invoiceNumber,
			paymentMethod: pay.method ?? order.paymentMethod,
			updatedAt: now
		})
		.where(eq(orders.id, order.id));
	await tx.insert(orderEvents).values({
		orderId: order.id,
		type: 'paid',
		actor: 'system',
		data: {
			paymentId: pay.id,
			provider: pay.provider,
			ref: pay.providerRef,
			method: pay.method,
			invoiceNumber,
			amount: pay.amount
		}
	});
	if (oversold.length)
		await tx
			.insert(orderEvents)
			.values({ orderId: order.id, type: 'oversold', actor: 'system', data: { lines: oversold } });

	// The bought items leave the cart (anything added meanwhile stays).
	if (order.cartId) {
		const variantIds = [...perVariant.keys()];
		if (variantIds.length)
			await tx
				.delete(cartLines)
				.where(and(eq(cartLines.cartId, order.cartId), inArray(cartLines.variantId, variantIds)));
		await tx.update(carts).set({ discountCode: null, updatedAt: now }).where(eq(carts.id, order.cartId));
	}

	const job = await enqueueJob(
		tx,
		'email.send',
		{ template: 'order_confirmation', orderId: order.id, to: order.email, locale: order.locale, refId: order.number },
		{ dedupeKey: `email:order_confirmation:${order.id}` }
	);
	return job ? [job] : [];
}

async function markFailed(
	tx: Tx,
	order: OrderRow,
	status: 'failed' | 'canceled' | 'expired',
	paymentId: string | null
): Promise<string[]> {
	const now = new Date();
	await releaseReservations(tx, order.id);
	await tx
		.update(orders)
		.set({ status: 'cancelled', paymentStatus: status, updatedAt: now })
		.where(eq(orders.id, order.id));
	await tx
		.insert(orderEvents)
		.values({ orderId: order.id, type: 'payment_failed', actor: 'system', data: { status, paymentId } });
	const job = await enqueueJob(
		tx,
		'email.send',
		{ template: 'payment_failed', orderId: order.id, to: order.email, locale: order.locale, refId: order.number },
		{ dedupeKey: `email:payment_failed:${order.id}:${paymentId ?? 'none'}` }
	);
	return job ? [job] : [];
}

/**
 * Webhook / mock / poll entry point: asks the PROVIDER for the payment's status and applies it.
 * Jobs enqueued by the transition (emails) are processed right away, best effort — the cron
 * picks them up if that fails.
 */
export async function syncPayment(
	deps: Pick<PaymentDeps, 'db' | 'payments'> & Partial<JobDeps>,
	providerRef: string
): Promise<ApplyResult> {
	const p = await deps.payments.getPayment(providerRef);
	if (!p) return { outcome: 'unknown', jobIds: [] };
	const r = await applyPaymentStatus(deps.db, {
		provider: deps.payments.provider,
		providerRef: p.id,
		status: p.status,
		method: p.method,
		raw: p.raw
	});
	if (r.jobIds.length && deps.email && deps.siteUrl) {
		try {
			await runJobs(
				{ db: deps.db, email: deps.email, siteUrl: deps.siteUrl, payments: deps.payments },
				{ ids: r.jobIds }
			);
		} catch (err) {
			console.error('[jobs] inline run failed', err);
		}
	}
	return r;
}

/**
 * Retry after a failed/cancelled payment (thank-you page): re-reserves the stock (it was released)
 * and creates a new payment. Throws InsufficientStockError when the items sold out meanwhile.
 */
export async function retryPayment(deps: PaymentDeps, orderId: string, method?: string | null) {
	const order = await deps.db.transaction(async (tx) => {
		const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
		if (!o || isPaidLike(o.paymentStatus)) return null;
		const lines = await tx
			.select({ variantId: orderLines.variantId, qty: orderLines.qty })
			.from(orderLines)
			.where(eq(orderLines.orderId, o.id));
		await reserveStock(tx, {
			cartId: o.cartId ?? o.id,
			orderId: o.id,
			lines: lines.filter((l): l is { variantId: string; qty: number } => !!l.variantId)
		});
		const [updated] = await tx
			.update(orders)
			.set({
				status: 'pending',
				paymentStatus: 'open',
				paymentMethod: method ?? o.paymentMethod,
				updatedAt: new Date()
			})
			.where(eq(orders.id, o.id))
			.returning();
		await tx
			.insert(orderEvents)
			.values({ orderId: o.id, type: 'payment_retry', actor: 'customer', data: { method: method ?? o.paymentMethod } });
		return updated;
	});
	if (!order) return null;
	return createPaymentForOrder(deps, order, method);
}

/** Cancels a freshly created order whose payment could not be started (provider down). */
export async function abandonOrder(db: DB, orderId: string, reason: string) {
	await db.transaction(async (tx) => {
		await releaseReservations(tx, orderId);
		await tx
			.update(orders)
			.set({ status: 'cancelled', paymentStatus: 'failed', updatedAt: new Date() })
			.where(and(eq(orders.id, orderId), eq(orders.status, 'pending')));
		await tx
			.insert(orderEvents)
			.values({ orderId, type: 'payment_error', actor: 'system', data: { reason: reason.slice(0, 500) } });
	});
}

/**
 * Cron: pending orders older than `olderThanMs` are reconciled with the provider; whatever is still
 * not paid is expired (status cancelled, payment_status expired, reservation released).
 */
export async function expireStaleOrders(deps: Pick<PaymentDeps, 'db' | 'payments'>, olderThanMs = 2 * 3600_000) {
	const cutoff = new Date(Date.now() - olderThanMs);
	const stale = await deps.db
		.select({ id: orders.id })
		.from(orders)
		.where(and(eq(orders.status, 'pending'), eq(orders.paymentStatus, 'open'), sql`${orders.placedAt} < ${cutoff}`))
		.limit(100);
	let paid = 0;
	let expired = 0;
	for (const { id } of stale) {
		const [pay] = await deps.db
			.select()
			.from(payments)
			.where(eq(payments.orderId, id))
			.orderBy(desc(payments.createdAt))
			.limit(1);
		const remote = pay ? await deps.payments.getPayment(pay.providerRef).catch(() => null) : null;
		if (pay && remote && remote.status === 'paid') {
			const r = await applyPaymentStatus(deps.db, {
				provider: pay.provider,
				providerRef: pay.providerRef,
				status: 'paid',
				method: remote.method,
				raw: remote.raw
			});
			if (r.outcome === 'paid') paid++;
			continue;
		}
		if (pay) {
			const status = remote && (remote.status === 'failed' || remote.status === 'canceled') ? remote.status : 'expired';
			const r = await applyPaymentStatus(deps.db, {
				provider: pay.provider,
				providerRef: pay.providerRef,
				status,
				raw: remote?.raw ?? pay.raw
			});
			if (r.outcome === 'failed') expired++;
			continue;
		}
		await deps.db.transaction(async (tx) => {
			const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
			if (o && o.status === 'pending' && o.paymentStatus === 'open') {
				await markFailed(tx, o, 'expired', null);
				expired++;
			}
		});
	}
	return { paid, expired };
}

// ── Read side ──────────────────────────────────────────────────────────────────

export async function findOrderByNumber(db: Executor, number: string) {
	const [order] = await db.select().from(orders).where(eq(orders.number, number));
	if (!order) return null;
	const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
	const [payment] = await db
		.select()
		.from(payments)
		.where(eq(payments.orderId, order.id))
		.orderBy(desc(payments.createdAt))
		.limit(1);
	return { order, lines, payment: payment ?? null };
}

/** Guest access via the order's access token (constant-time) or the owning logged-in customer. */
export function canViewOrder(
	order: Pick<OrderRow, 'accessToken' | 'customerId'>,
	token: string | null,
	customerId: string | null | undefined
) {
	if (token && safeEqual(token, order.accessToken)) return true;
	return !!customerId && order.customerId === customerId;
}

/**
 * Delivery estimate: orders before the cut-off hour (Brussels time) ship the same working day;
 * delivery takes `deliveryDays` working days (Mon–Fri).
 */
export function estimateDelivery(placedAt: Date, shipping: { cutoffHour: number; deliveryDays: number }): Date {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: TIME_ZONE,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			hourCycle: 'h23',
			weekday: 'short'
		})
			.formatToParts(placedAt)
			.map((p) => [p.type, p.value])
	);
	// Work on a UTC-noon date for the Brussels calendar day (no DST edge cases).
	const d = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
	const isWeekend = (x: Date) => x.getUTCDay() === 0 || x.getUTCDay() === 6;
	const addWorkday = () => {
		do d.setUTCDate(d.getUTCDate() + 1);
		while (isWeekend(d));
	};
	// Ship day: today if a working day before the cut-off, otherwise the next working day.
	if (isWeekend(d) || Number(parts.hour) >= shipping.cutoffHour) addWorkday();
	for (let i = 0; i < Math.max(1, shipping.deliveryDays); i++) addWorkday();
	return d;
}
