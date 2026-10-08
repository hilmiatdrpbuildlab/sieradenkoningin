/**
 * Order administration & fulfilment (P2-09, P3-05).
 *
 * Status flow after payment (the payment state machine itself lives in orders.ts):
 *   paid ──▶ processing ──▶ shipped ──▶ delivered
 *     └────────┴──▶ cancelled            (refunded is set by refunds.ts)
 * - "Create label" (Sendcloud / mock) stores the label PDF privately under `labels/…`, adds a
 *   `shipments` row (status created) and moves a paid order to processing.
 * - "Shipped" happens when the parcel is handed over: manually in the admin or through the
 *   Sendcloud tracking webhook. It queues the "shipped" email with track & trace exactly once.
 * Every transition locks the order row, so concurrent clicks / webhooks cannot double-apply.
 */
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { DB, Executor, Tx } from '../db/index.ts';
import { orderEvents, orderLines, orders, payments, refunds, shipments, stockMovements } from '../db/schema.ts';
import type { ShippingAdapter, TrackingStatus } from '../adapters/shipping.ts';
import type { Storage } from '../adapters/storage.ts';
import { enqueueJob } from '../jobs/index.ts';
import { releaseReservations } from './inventory-reservations.ts';
import { applyStockDelta } from './inventory.ts';
import { TIME_ZONE } from '../../utils/format.ts';
import type { OrderStatus, PaymentStatus } from '../../types.ts';

export type OrderRow = typeof orders.$inferSelect;
export type ShipmentRow = typeof shipments.$inferSelect;

export class FulfilmentError extends Error {}

// ── List ───────────────────────────────────────────────────────────────────────

export const ORDER_STATUSES: OrderStatus[] = [
	'pending',
	'paid',
	'processing',
	'shipped',
	'delivered',
	'cancelled',
	'refunded'
];
export const PAYMENT_STATUSES: PaymentStatus[] = [
	'open',
	'paid',
	'failed',
	'canceled',
	'expired',
	'partially_refunded',
	'refunded'
];
export const ORDER_SORTS = ['placed', 'number', 'total', 'customer'] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export interface OrderListParams {
	q?: string;
	status?: OrderStatus;
	payment?: PaymentStatus;
	/** Inclusive Brussels calendar days, YYYY-MM-DD. */
	from?: string;
	to?: string;
	sort?: OrderSort;
	dir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

/** Start of a Brussels calendar day (YYYY-MM-DD) as a timestamptz expression. */
const brusselsDay = (day: string) => sql`(${day}::date)::timestamp at time zone ${TIME_ZONE}`;
const isDay = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function listOrders(db: Executor, p: OrderListParams = {}) {
	const pageSize = p.pageSize ?? 25;
	const where: SQL[] = [];
	if (p.q) {
		const like = `%${p.q.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
		where.push(
			or(
				ilike(orders.number, like),
				ilike(orders.email, like),
				ilike(orders.invoiceNumber, like),
				sql`${orders.shippingAddress}->>'name' ilike ${like}`,
				sql`${orders.billingAddress}->>'name' ilike ${like}`
			)!
		);
	}
	if (p.status) where.push(eq(orders.status, p.status));
	if (p.payment) where.push(eq(orders.paymentStatus, p.payment));
	if (isDay(p.from)) where.push(gte(orders.placedAt, brusselsDay(p.from)));
	if (isDay(p.to)) where.push(lt(orders.placedAt, sql`${brusselsDay(p.to)} + interval '1 day'`));
	const cond = where.length ? and(...where) : undefined;
	const dirFn = p.dir === 'asc' ? asc : desc;
	const orderBy =
		p.sort === 'number'
			? [dirFn(orders.number)]
			: p.sort === 'total'
				? [dirFn(orders.total), desc(orders.placedAt)]
				: p.sort === 'customer'
					? [dirFn(sql`${orders.shippingAddress}->>'name'`), desc(orders.placedAt)]
					: [dirFn(orders.placedAt)];
	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				id: orders.id,
				number: orders.number,
				email: orders.email,
				name: sql<string>`${orders.shippingAddress}->>'name'`,
				status: orders.status,
				paymentStatus: orders.paymentStatus,
				total: orders.total,
				refundedTotal: orders.refundedTotal,
				shippingMethod: orders.shippingMethod,
				locale: orders.locale,
				placedAt: orders.placedAt,
				items: sql<number>`(select coalesce(sum(ol.qty), 0) from ${orderLines} ol where ol.order_id = ${sql.raw('"orders"."id"')})::int`,
				shipment: sql<
					string | null
				>`(select s.status from ${shipments} s where s.order_id = ${sql.raw('"orders"."id"')} order by s.created_at desc limit 1)`
			})
			.from(orders)
			.where(cond)
			.orderBy(...orderBy)
			.limit(pageSize)
			.offset(((p.page ?? 1) - 1) * pageSize),
		db.select({ total: count() }).from(orders).where(cond)
	]);
	return { rows, total, pageSize };
}

// ── Detail ─────────────────────────────────────────────────────────────────────

export async function getOrderDetail(db: Executor, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const [order] = await db.select().from(orders).where(eq(orders.id, id));
	if (!order) return null;
	const [lines, pays, refs, ships, events] = await Promise.all([
		db.select().from(orderLines).where(eq(orderLines.orderId, id)).orderBy(asc(orderLines.sku)),
		db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.createdAt)),
		db.select().from(refunds).where(eq(refunds.orderId, id)).orderBy(desc(refunds.createdAt)),
		db.select().from(shipments).where(eq(shipments.orderId, id)).orderBy(desc(shipments.createdAt)),
		db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(desc(orderEvents.createdAt))
	]);
	return { order, lines, payments: pays, refunds: refs, shipments: ships, events };
}

// ── Status transitions ─────────────────────────────────────────────────────────

/** Manual transitions the admin may make (refunded is only reached through a refund). */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	pending: ['cancelled'],
	paid: ['processing', 'shipped', 'cancelled'],
	processing: ['shipped', 'cancelled'],
	shipped: ['delivered'],
	delivered: [],
	cancelled: [],
	refunded: []
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);

const lockOrder = async (tx: Tx, id: string) =>
	(await tx.select().from(orders).where(eq(orders.id, id)).for('update'))[0];

async function event(tx: Executor, orderId: string, type: string, actor: string, data?: Record<string, unknown>) {
	await tx.insert(orderEvents).values({ orderId, type, actor, data: data ?? null });
}

export interface Actor {
	name: string;
}

/**
 * Bulk / single "mark processing" (paid → processing). Orders in any other status are skipped.
 * Returns the ids that changed.
 */
export async function markProcessing(db: DB, ids: string[], actor: Actor): Promise<string[]> {
	const changed: string[] = [];
	for (const id of ids) {
		const ok = await db.transaction(async (tx) => {
			const o = await lockOrder(tx, id);
			if (!o || o.status !== 'paid') return false;
			await tx.update(orders).set({ status: 'processing', updatedAt: new Date() }).where(eq(orders.id, id));
			await event(tx, id, 'status', actor.name, { from: 'paid', to: 'processing' });
			return true;
		});
		if (ok) changed.push(id);
	}
	return changed;
}

export async function markDelivered(db: DB, id: string, actor: Actor) {
	return db.transaction(async (tx) => {
		const o = await lockOrder(tx, id);
		if (!o) throw new FulfilmentError('Bestelling niet gevonden');
		if (!canTransition(o.status, 'delivered'))
			throw new FulfilmentError('Alleen verzonden bestellingen kunnen als geleverd gemarkeerd worden.');
		await tx.update(orders).set({ status: 'delivered', updatedAt: new Date() }).where(eq(orders.id, id));
		await tx
			.update(shipments)
			.set({ status: 'delivered', updatedAt: new Date() })
			.where(and(eq(shipments.orderId, id), inArray(shipments.status, ['created', 'shipped'])));
		await event(tx, id, 'status', actor.name, { from: o.status, to: 'delivered' });
		return { from: o.status };
	});
}

/**
 * Cancels an order. Pending: releases the stock reservation. Paid/processing: the sold units go back
 * into stock (stock_movements 'return', minus anything already restocked by a refund). Money is NOT
 * refunded automatically — the admin issues the refund separately (the UI says so).
 */
export async function cancelOrder(db: DB, id: string, actor: Actor, reason?: string | null) {
	return db.transaction(async (tx) => {
		const o = await lockOrder(tx, id);
		if (!o) throw new FulfilmentError('Bestelling niet gevonden');
		if (!canTransition(o.status, 'cancelled'))
			throw new FulfilmentError('Deze bestelling kan niet meer geannuleerd worden.');
		let restocked = 0;
		if (o.status === 'pending') {
			await releaseReservations(tx, id);
		} else {
			const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, id));
			const returned = await restockedQty(tx, o.number);
			for (const l of lines) {
				if (!l.variantId) continue;
				const qty = l.qty - (returned.get(l.variantId) ?? 0);
				if (qty <= 0) continue;
				await applyStockDelta(tx, {
					variantId: l.variantId,
					delta: qty,
					reason: 'return',
					note: 'Bestelling geannuleerd',
					refId: o.number,
					actor: actor.name
				});
				returned.set(l.variantId, (returned.get(l.variantId) ?? 0) + qty);
				restocked += qty;
			}
		}
		await tx.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, id));
		await event(tx, id, 'status', actor.name, { from: o.status, to: 'cancelled', reason: reason || null, restocked });
		return { from: o.status, restocked, needsRefund: o.status !== 'pending' && o.total - o.refundedTotal > 0 };
	});
}

/** Units already put back into stock for an order (stock_movements 'return' with ref = order number). */
export async function restockedQty(db: Executor, orderNumber: string) {
	const rows = await db
		.select({ variantId: stockMovements.variantId, qty: sql<number>`sum(${stockMovements.delta})::int` })
		.from(stockMovements)
		.where(and(eq(stockMovements.refId, orderNumber), eq(stockMovements.reason, 'return')))
		.groupBy(stockMovements.variantId);
	return new Map(rows.map((r) => [r.variantId, r.qty]));
}

export async function addNote(db: Executor, id: string, actor: Actor, text: string) {
	await event(db, id, 'note', actor.name, { text });
}

// ── Shipping ───────────────────────────────────────────────────────────────────

const SHIPPABLE: OrderStatus[] = ['paid', 'processing'];
/** Rough parcel weight: jewellery box + item (no per-product weight in the catalogue yet). */
const parcelWeight = (items: number) => 150 + 50 * items;

export interface LabelDeps {
	db: DB;
	shipping: ShippingAdapter;
	storage: Storage;
}

export const labelKey = (orderNumber: string, ref: string) =>
	`labels/${orderNumber.slice(3, 7)}/${orderNumber}-${ref.replace(/[^a-z0-9_-]/gi, '')}.pdf`;

/**
 * Creates a shipping label (single or from the bulk action). Idempotent per order: when an open
 * shipment with a label exists it is returned instead of buying a second label.
 * Label created → order paid→processing, shipment 'created'.
 */
export async function createLabel(
	deps: LabelDeps,
	orderId: string,
	actor: Actor
): Promise<{ shipment: ShipmentRow; created: boolean }> {
	const [o] = await deps.db.select().from(orders).where(eq(orders.id, orderId));
	if (!o) throw new FulfilmentError('Bestelling niet gevonden');
	if (!SHIPPABLE.includes(o.status))
		throw new FulfilmentError(`${o.number}: alleen betaalde bestellingen kunnen verzonden worden.`);
	const [existing] = await deps.db
		.select()
		.from(shipments)
		.where(and(eq(shipments.orderId, orderId), inArray(shipments.status, ['created', 'shipped'])))
		.limit(1);
	if (existing?.labelKey) return { shipment: existing, created: false };

	const [{ items }] = await deps.db
		.select({ items: sql<number>`coalesce(sum(${orderLines.qty}), 0)::int` })
		.from(orderLines)
		.where(eq(orderLines.orderId, orderId));
	const label = await deps.shipping.createLabel({
		orderNumber: o.number,
		address: o.shippingAddress,
		email: o.email,
		method: o.shippingMethod,
		servicePoint: o.servicePoint,
		weightGrams: parcelWeight(items)
	});
	const key = labelKey(o.number, label.providerRef);
	await deps.storage.put(key, label.labelPdf, 'application/pdf');

	return deps.db.transaction(async (tx) => {
		const locked = await lockOrder(tx, orderId);
		const [shipment] = await tx
			.insert(shipments)
			.values({
				orderId,
				carrier: label.carrier,
				providerRef: label.providerRef,
				servicePoint: o.servicePoint,
				labelKey: key,
				trackingNumber: label.trackingNumber,
				trackingUrl: label.trackingUrl,
				status: 'created'
			})
			.returning();
		if (locked.status === 'paid') {
			await tx.update(orders).set({ status: 'processing', updatedAt: new Date() }).where(eq(orders.id, orderId));
			await event(tx, orderId, 'status', actor.name, { from: 'paid', to: 'processing' });
		}
		await event(tx, orderId, 'shipment', actor.name, {
			action: 'label_created',
			carrier: label.carrier,
			provider: deps.shipping.provider,
			trackingNumber: label.trackingNumber,
			shipmentId: shipment.id
		});
		return { shipment, created: true };
	});
}

/** Queues the "shipped" email once per order. */
async function queueShippedEmail(
	tx: Executor,
	o: OrderRow,
	s: { trackingNumber: string | null; trackingUrl: string | null; carrier: string }
) {
	return enqueueJob(
		tx,
		'email.send',
		{
			template: 'order_shipped',
			orderId: o.id,
			to: o.email,
			locale: o.locale,
			refId: o.number,
			data: { tracking: { number: s.trackingNumber, url: s.trackingUrl, carrier: s.carrier } }
		},
		{ dedupeKey: `email:order_shipped:${o.id}` }
	);
}

/**
 * Manual "Markeer verzonden": marks the open shipment (or a new manual one with optional tracking)
 * as shipped, the order as shipped, and queues the email. Returns the job ids to run inline.
 */
export async function markShipped(
	db: DB,
	orderId: string,
	actor: Actor,
	manual: { carrier?: string | null; trackingNumber?: string | null; trackingUrl?: string | null } = {}
): Promise<string[]> {
	return db.transaction(async (tx) => {
		const o = await lockOrder(tx, orderId);
		if (!o) throw new FulfilmentError('Bestelling niet gevonden');
		if (!canTransition(o.status, 'shipped'))
			throw new FulfilmentError('Alleen betaalde bestellingen of bestellingen in behandeling kunnen verzonden worden.');
		const now = new Date();
		let [s] = await tx
			.select()
			.from(shipments)
			.where(and(eq(shipments.orderId, orderId), eq(shipments.status, 'created')))
			.orderBy(desc(shipments.createdAt))
			.limit(1)
			.for('update');
		if (s) {
			[s] = await tx
				.update(shipments)
				.set({
					status: 'shipped',
					trackingNumber: manual.trackingNumber || s.trackingNumber,
					trackingUrl: manual.trackingUrl || s.trackingUrl,
					updatedAt: now
				})
				.where(eq(shipments.id, s.id))
				.returning();
		} else {
			[s] = await tx
				.insert(shipments)
				.values({
					orderId,
					carrier: manual.carrier || 'bpost',
					servicePoint: o.servicePoint,
					trackingNumber: manual.trackingNumber || null,
					trackingUrl: manual.trackingUrl || null,
					status: 'shipped'
				})
				.returning();
		}
		await tx.update(orders).set({ status: 'shipped', updatedAt: now }).where(eq(orders.id, orderId));
		await event(tx, orderId, 'status', actor.name, { from: o.status, to: 'shipped' });
		await event(tx, orderId, 'shipment', actor.name, {
			action: 'shipped',
			trackingNumber: s.trackingNumber,
			shipmentId: s.id
		});
		const job = await queueShippedEmail(tx, o, s);
		return job ? [job] : [];
	});
}

const RANK: Record<string, number> = { created: 0, shipped: 1, delivered: 2 };

/**
 * Sendcloud tracking update (webhook). Idempotent and monotonic: a status the shipment already has
 * (or an older one arriving late) changes nothing. Returns job ids to run inline.
 */
export async function applyTrackingUpdate(
	db: DB,
	input: { providerRef: string; status: TrackingStatus }
): Promise<{ outcome: 'unknown' | 'noop' | 'updated'; jobIds: string[] }> {
	return db.transaction(async (tx) => {
		const [s] = await tx.select().from(shipments).where(eq(shipments.providerRef, input.providerRef)).for('update');
		if (!s) return { outcome: 'unknown' as const, jobIds: [] };
		const o = await lockOrder(tx, s.orderId);
		const now = new Date();
		if (input.status === 'exception') {
			if (s.status === 'exception' || s.status === 'delivered') return { outcome: 'noop' as const, jobIds: [] };
			await tx.update(shipments).set({ status: 'exception', updatedAt: now }).where(eq(shipments.id, s.id));
			await event(tx, o.id, 'shipment', 'sendcloud', { action: 'exception', shipmentId: s.id });
			return { outcome: 'updated' as const, jobIds: [] };
		}
		if ((RANK[s.status] ?? -1) >= RANK[input.status] && s.status !== 'exception')
			return { outcome: 'noop' as const, jobIds: [] };
		await tx.update(shipments).set({ status: input.status, updatedAt: now }).where(eq(shipments.id, s.id));
		await event(tx, o.id, 'shipment', 'sendcloud', {
			action: input.status,
			shipmentId: s.id,
			trackingNumber: s.trackingNumber
		});
		const jobIds: string[] = [];
		// Order status follows, only forward (never touches cancelled/refunded orders).
		const target: OrderStatus = input.status;
		const path: OrderStatus[] = target === 'delivered' ? ['shipped', 'delivered'] : ['shipped'];
		let status = o.status;
		for (const step of path) {
			if (canTransition(status, step)) {
				await event(tx, o.id, 'status', 'sendcloud', { from: status, to: step });
				status = step;
			}
		}
		if (status !== o.status) await tx.update(orders).set({ status, updatedAt: now }).where(eq(orders.id, o.id));
		if (['shipped', 'delivered'].includes(status) && ['paid', 'processing'].includes(o.status)) {
			const job = await queueShippedEmail(tx, o, s);
			if (job) jobIds.push(job);
		}
		return { outcome: 'updated' as const, jobIds };
	});
}

/** Label PDF of a shipment (admin print/download). */
export async function shipmentLabel(db: Executor, orderId: string, shipmentId: string) {
	const [s] = await db
		.select()
		.from(shipments)
		.where(and(eq(shipments.id, shipmentId), eq(shipments.orderId, orderId)));
	return s?.labelKey ? s : null;
}
