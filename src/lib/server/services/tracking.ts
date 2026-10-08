/**
 * Customer-facing order status (P3-04 public tracking + P3-02 account order detail).
 *
 * `lookupOrderForTracking(number, email)` matches BOTH in one query, so a wrong email and an unknown
 * order number take the same path and return the same `null` — the page renders one identical
 * "not found" response for both (unit + e2e tested).
 */
import { and, asc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { orderEvents, orderLines, orders, shipments } from '../db/schema.ts';
import { tr } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/paths.ts';
import type {
	CustomerOrderStatus,
	ShipmentView,
	TimelineStep,
	TimelineStepKey
} from '../../components/storefront/account-types.ts';

type OrderRow = typeof orders.$inferSelect;
type EventRow = Pick<typeof orderEvents.$inferSelect, 'type' | 'data' | 'createdAt'>;
type ShipmentRow = Pick<typeof shipments.$inferSelect, 'carrier' | 'trackingNumber' | 'trackingUrl' | 'status' | 'createdAt' | 'updatedAt'>;

const FLOW: TimelineStepKey[] = ['placed', 'paid', 'processing', 'shipped', 'delivered'];
const RANK: Record<string, number> = { pending: 0, paid: 1, processing: 2, shipped: 3, delivered: 4 };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function eventAt(events: EventRow[], key: TimelineStepKey): Date | null {
	const hit = events.find((e) => {
		if (key === 'refunded' && e.type.startsWith('refund')) return true;
		if (e.type === key) return true;
		if (e.type === 'status' || e.type === 'status_changed') {
			const d = (e.data ?? {}) as Record<string, unknown>;
			return d.to === key || d.status === key;
		}
		return false;
	});
	return hit?.createdAt ?? null;
}

/** Builds the customer timeline from the order status, its events and shipments. Pure (unit-tested). */
export function buildTimeline(
	order: Pick<OrderRow, 'status' | 'placedAt' | 'paidAt'>,
	events: EventRow[],
	ships: ShipmentRow[] = []
): TimelineStep[] {
	const shippedShipment = ships.find((s) => s.status === 'shipped' || s.status === 'delivered');
	const deliveredShipment = ships.find((s) => s.status === 'delivered');
	const at: Record<TimelineStepKey, Date | null> = {
		placed: order.placedAt,
		paid: order.paidAt ?? eventAt(events, 'paid'),
		processing: eventAt(events, 'processing'),
		shipped: eventAt(events, 'shipped') ?? shippedShipment?.updatedAt ?? null,
		delivered: eventAt(events, 'delivered') ?? deliveredShipment?.updatedAt ?? null,
		cancelled: eventAt(events, 'cancelled'),
		refunded: eventAt(events, 'refunded')
	};

	if (order.status === 'cancelled' || order.status === 'refunded') {
		// What actually happened before the terminal state, then the terminal step.
		const happened = FLOW.filter((k) => k === 'placed' || at[k] !== null);
		return [
			...happened.map((key) => ({ key, state: 'done' as const, at: iso(at[key]) })),
			{ key: order.status, state: 'current', at: iso(at[order.status]) }
		];
	}
	const rank = RANK[order.status] ?? 0;
	return FLOW.map((key, i) => ({
		key,
		state: i < rank ? 'done' : i === rank ? 'current' : 'upcoming',
		at: i <= rank ? iso(at[key]) : null
	}));
}

const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

export function shipmentViews(ships: ShipmentRow[]): ShipmentView[] {
	return ships.map((s) => ({
		carrier: s.carrier,
		trackingNumber: s.trackingNumber,
		trackingUrl: safeUrl(s.trackingUrl),
		status: s.status
	}));
}

/** Events + shipments for one order (oldest first). */
export async function orderProgress(db: Executor, order: Pick<OrderRow, 'id' | 'status' | 'placedAt' | 'paidAt'>) {
	const [events, ships] = await Promise.all([
		db
			.select({ type: orderEvents.type, data: orderEvents.data, createdAt: orderEvents.createdAt })
			.from(orderEvents)
			.where(eq(orderEvents.orderId, order.id))
			.orderBy(asc(orderEvents.createdAt)),
		db
			.select({
				carrier: shipments.carrier,
				trackingNumber: shipments.trackingNumber,
				trackingUrl: shipments.trackingUrl,
				status: shipments.status,
				createdAt: shipments.createdAt,
				updatedAt: shipments.updatedAt
			})
			.from(shipments)
			.where(eq(shipments.orderId, order.id))
			.orderBy(asc(shipments.createdAt))
	]);
	return { timeline: buildTimeline(order, events, ships), shipments: shipmentViews(ships) };
}

export interface TrackedOrder {
	number: string;
	status: CustomerOrderStatus;
	placedAt: string;
	shippingMethod: 'home' | 'pickup';
	timeline: TimelineStep[];
	shipments: ShipmentView[];
	lines: { name: string; variantLabel: string; qty: number }[];
}

/**
 * Public lookup: order number AND email must both match (one query). Pending (unpaid) orders are
 * tracked too — the buyer may want to see that payment is still open.
 */
export async function lookupOrderForTracking(db: Executor, number: string, email: string, lang: Lang): Promise<TrackedOrder | null> {
	const [order] = await db
		.select()
		.from(orders)
		.where(and(eq(orders.number, number.trim().toUpperCase()), eq(orders.email, email.trim().toLowerCase())));
	if (!order) return null;
	const [progress, lines] = await Promise.all([
		orderProgress(db, order),
		db.select().from(orderLines).where(eq(orderLines.orderId, order.id))
	]);
	return {
		number: order.number,
		status: order.status,
		placedAt: order.placedAt.toISOString(),
		shippingMethod: order.shippingMethod,
		timeline: progress.timeline,
		shipments: progress.shipments,
		lines: lines.map((l) => ({ name: tr(l.name, lang), variantLabel: tr(l.variantLabel, lang), qty: l.qty }))
	};
}
