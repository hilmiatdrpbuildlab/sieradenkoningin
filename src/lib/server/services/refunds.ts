/**
 * Refunds (P3-06): full or partial, by amount or by order lines (+ quantities), optional restock.
 *
 * Never more than captured − already refunded. The flow is two-phase so concurrent refunds cannot
 * both pass the check and so a provider failure leaves no trace in the totals:
 *  1. (tx, order row locked) validate, insert `refunds` row 'pending', RESERVE the amount in
 *     `orders.refunded_total` and the quantities in `order_lines.refunded_qty`;
 *  2. call the payment provider (Mollie refund API / mock) — outside the transaction;
 *  3. (tx) on success: final status, payment_status partially_refunded/refunded (+ order status
 *     refunded when fully refunded), restock (`stock_movements` 'return'), `order_events`, refund email.
 *     On failure: the reservation is rolled back and the refund row marked failed.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB, Executor } from '../db/index.ts';
import { orderEvents, orderLines, orders, payments, refunds } from '../db/schema.ts';
import type { PaymentsAdapter } from '../adapters/payments.ts';
import { enqueueJob } from '../jobs/index.ts';
import { applyStockDelta } from './inventory.ts';
import { restockedQty } from './fulfilment.ts';
import { formatPrice } from '../../utils/format.ts';

export class RefundError extends Error {}

type OrderRow = typeof orders.$inferSelect;
type LineRow = typeof orderLines.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

const CAPTURED = ['paid', 'partially_refunded', 'refunded'] as const;

export type RefundInput =
	| { mode: 'amount'; amount: number; reason?: string | null; restock?: boolean }
	| {
			mode: 'lines';
			lines: { orderLineId: string; qty: number }[];
			shipping?: boolean;
			reason?: string | null;
			restock?: boolean;
	  };

/** Amount paid for the first `k` units of a line (discount included; exact over successive partial refunds). */
export const paidForUnits = (l: Pick<LineRow, 'lineTotal' | 'discountAmount' | 'qty'>, k: number) =>
	Math.round(((l.lineTotal - l.discountAmount) * k) / l.qty);

/** Amount for refunding `qty` more units of a line that already had `refundedQty` refunded. */
export const lineRefundAmount = (
	l: Pick<LineRow, 'lineTotal' | 'discountAmount' | 'qty' | 'refundedQty'>,
	qty: number
) => paidForUnits(l, l.refundedQty + qty) - paidForUnits(l, l.refundedQty);

/** The captured payment of an order (the one that was paid). */
export async function capturedPayment(db: Executor, orderId: string): Promise<PaymentRow | null> {
	const [p] = await db
		.select()
		.from(payments)
		.where(and(eq(payments.orderId, orderId), inArray(payments.status, [...CAPTURED])))
		.limit(1);
	return p ?? null;
}

/** captured − already refunded (≥ 0). */
export const refundable = (captured: number, refundedTotal: number) => Math.max(0, captured - refundedTotal);

interface Plan {
	amount: number;
	lines: { line: LineRow; qty: number }[];
	fullAfter: boolean;
}

function plan(order: OrderRow, lines: LineRow[], captured: number, input: RefundInput): Plan {
	const left = refundable(captured, order.refundedTotal);
	if (left <= 0) throw new RefundError('Deze bestelling is al volledig terugbetaald.');
	let amount: number;
	let picked: { line: LineRow; qty: number }[] = [];
	if (input.mode === 'amount') {
		amount = input.amount;
		if (!Number.isInteger(amount) || amount <= 0) throw new RefundError('Geef een bedrag groter dan € 0 in.');
	} else {
		const byId = new Map(lines.map((l) => [l.id, l]));
		for (const sel of input.lines) {
			if (!sel.qty) continue;
			const line = byId.get(sel.orderLineId);
			if (!line) throw new RefundError('Onbekende orderregel.');
			if (!Number.isInteger(sel.qty) || sel.qty < 0 || sel.qty > line.qty - line.refundedQty)
				throw new RefundError(
					`${line.sku}: er kunnen nog maximaal ${line.qty - line.refundedQty} stuks terugbetaald worden.`
				);
			picked.push({ line, qty: sel.qty });
		}
		amount =
			picked.reduce((s, p) => s + lineRefundAmount(p.line, p.qty), 0) + (input.shipping ? order.shippingTotal : 0);
		if (amount <= 0) throw new RefundError('Kies minstens één artikel om terug te betalen.');
		// Shipping + rounding can exceed what is left; cap at the refundable amount.
		amount = Math.min(amount, left);
	}
	if (amount > left)
		throw new RefundError(
			`Je kunt maximaal ${formatPrice(left)} terugbetalen (betaald ${formatPrice(captured)}, al terugbetaald ${formatPrice(order.refundedTotal)}).`
		);
	const fullAfter = order.refundedTotal + amount >= captured;
	if (input.mode === 'amount' && fullAfter) {
		// A full refund by amount refunds every remaining unit.
		picked = lines.filter((l) => l.qty > l.refundedQty).map((line) => ({ line, qty: line.qty - line.refundedQty }));
	} else if (input.mode === 'amount' && input.restock) {
		throw new RefundError('Terug in voorraad zetten kan bij een gedeeltelijke terugbetaling alleen per artikel.');
	}
	return { amount, lines: picked, fullAfter };
}

export interface RefundDeps {
	db: DB;
	payments: PaymentsAdapter;
}

export interface RefundResult {
	refundId: string;
	amount: number;
	full: boolean;
	restocked: number;
	jobIds: string[];
}

export async function createRefund(
	deps: RefundDeps,
	orderId: string,
	input: RefundInput,
	actor: { name: string }
): Promise<RefundResult> {
	// 1. Validate + reserve.
	const reserved = await deps.db.transaction(async (tx) => {
		const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
		if (!order) throw new RefundError('Bestelling niet gevonden.');
		if (!(CAPTURED as readonly string[]).includes(order.paymentStatus))
			throw new RefundError('Deze bestelling is niet betaald.');
		const pay = await capturedPayment(tx, orderId);
		if (!pay) throw new RefundError('Geen geslaagde betaling gevonden.');
		const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, orderId)).for('update');
		const p = plan(order, lines, pay.amount, input);
		const [refund] = await tx
			.insert(refunds)
			.values({
				orderId,
				paymentId: pay.id,
				amount: p.amount,
				reason: input.reason?.trim() || null,
				lines: p.lines.map((x) => ({ orderLineId: x.line.id, qty: x.qty })),
				restock: !!input.restock,
				status: 'pending',
				actor: actor.name
			})
			.returning();
		await tx
			.update(orders)
			.set({ refundedTotal: sql`${orders.refundedTotal} + ${p.amount}`, updatedAt: new Date() })
			.where(eq(orders.id, orderId));
		for (const x of p.lines)
			await tx
				.update(orderLines)
				.set({ refundedQty: sql`${orderLines.refundedQty} + ${x.qty}` })
				.where(eq(orderLines.id, x.line.id));
		return { refund, pay, order, plan: p };
	});
	const { refund, pay, order, plan: p } = reserved;

	// 2. Provider.
	let provider: { id: string; status: string };
	try {
		provider = await deps.payments.createRefund(pay.providerRef, p.amount, `Terugbetaling ${order.number}`);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await deps.db.transaction(async (tx) => {
			await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).for('update');
			await tx.update(refunds).set({ status: 'failed' }).where(eq(refunds.id, refund.id));
			await tx
				.update(orders)
				.set({ refundedTotal: sql`${orders.refundedTotal} - ${p.amount}`, updatedAt: new Date() })
				.where(eq(orders.id, orderId));
			for (const x of p.lines)
				await tx
					.update(orderLines)
					.set({ refundedQty: sql`${orderLines.refundedQty} - ${x.qty}` })
					.where(eq(orderLines.id, x.line.id));
			await tx.insert(orderEvents).values({
				orderId,
				type: 'refund_failed',
				actor: actor.name,
				data: { refundId: refund.id, amount: p.amount, error: message.slice(0, 500) }
			});
		});
		throw new RefundError(`De betaalprovider weigerde de terugbetaling: ${message.slice(0, 200)}`);
	}

	// 3. Book it.
	return deps.db.transaction(async (tx) => {
		const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
		const full = o.refundedTotal >= pay.amount;
		const paymentStatus = full ? 'refunded' : 'partially_refunded';
		await tx
			.update(refunds)
			.set({
				status: provider.status === 'failed' ? 'failed' : provider.status || 'refunded',
				providerRef: provider.id
			})
			.where(eq(refunds.id, refund.id));
		await tx.update(payments).set({ status: paymentStatus, updatedAt: new Date() }).where(eq(payments.id, pay.id));
		await tx
			.update(orders)
			.set({ paymentStatus, ...(full ? { status: 'refunded' as const } : {}), updatedAt: new Date() })
			.where(eq(orders.id, orderId));

		let restocked = 0;
		if (input.restock && p.lines.length) {
			const back = await restockedQty(tx, o.number);
			const sold = new Map<string, number>();
			const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, orderId));
			for (const l of lines) if (l.variantId) sold.set(l.variantId, (sold.get(l.variantId) ?? 0) + l.qty);
			for (const x of p.lines) {
				const v = x.line.variantId;
				if (!v) continue;
				const qty = Math.min(x.qty, (sold.get(v) ?? 0) - (back.get(v) ?? 0));
				if (qty <= 0) continue;
				await applyStockDelta(tx, {
					variantId: v,
					delta: qty,
					reason: 'return',
					note: 'Terugbetaling',
					refId: o.number,
					actor: actor.name
				});
				back.set(v, (back.get(v) ?? 0) + qty);
				restocked += qty;
			}
		}
		await tx.insert(orderEvents).values({
			orderId,
			type: 'refund',
			actor: actor.name,
			data: {
				refundId: refund.id,
				amount: p.amount,
				full,
				reason: refund.reason,
				lines: p.lines.map((x) => ({ sku: x.line.sku, qty: x.qty })),
				restocked,
				providerRef: provider.id
			}
		});
		if (full && o.status !== 'refunded')
			await tx
				.insert(orderEvents)
				.values({ orderId, type: 'status', actor: actor.name, data: { from: o.status, to: 'refunded' } });
		const locale = o.locale === 'fr' ? 'fr' : 'nl';
		const job = await enqueueJob(
			tx,
			'email.send',
			{
				template: 'refund_issued',
				orderId,
				to: o.email,
				locale,
				refId: o.number,
				data: { refund: { amountFormatted: formatPrice(p.amount, locale), full } }
			},
			{ dedupeKey: `email:refund_issued:${refund.id}` }
		);
		return { refundId: refund.id, amount: p.amount, full, restocked, jobIds: job ? [job] : [] };
	});
}
