/** P3-06 — refunds: caps, partial/full, by lines, restock, provider failure, concurrency, permissions. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { isHttpError } from '@sveltejs/kit';
import { jobs, orderEvents, orderLines, orders, payments, refunds, stockMovements } from '#lib/server/db/schema.ts';
import { placeOrder } from '#lib/server/services/checkout.ts';
import { syncPayment } from '#lib/server/services/orders.ts';
import { RefundError, createRefund, lineRefundAmount, paidForUnits, refundable } from '#lib/server/services/refunds.ts';
import { runJobs } from '#lib/server/jobs/index.ts';
import type { PaymentsAdapter } from '#lib/server/adapters/payments.ts';
import { can } from '#lib/permissions.ts';
import { actions } from '../../src/routes/admin/(app)/orders/[id]/+page.server.ts';
import {
	checkoutData,
	deps,
	ensureShipping,
	makeCart,
	makeDiscount,
	makeVariant,
	openTestDb,
	setMockStatus,
	stockOf
} from './checkout-fixtures.ts';

const { db, close } = openTestDb();
beforeAll(() => ensureShipping(db));
afterAll(() => close());
const actor = { name: 'DEMO Klantendienst' };

async function paidOrder(opts: { qty?: number; price?: number; code?: string } = {}) {
	const v = await makeVariant(db, { stock: 10, price: opts.price ?? 2500 });
	const cartId = await makeCart(db, [{ variantId: v.variantId, qty: opts.qty ?? 3 }], opts.code ?? null);
	const d = deps(db);
	const r = await placeOrder(d, {
		cartId,
		lang: 'fr',
		customerId: null,
		data: checkoutData({ email: 'refund@example.com' })
	});
	if (!r.ok) throw new Error(r.error);
	const [payment] = await db.select().from(payments).where(eq(payments.orderId, r.order.id));
	await setMockStatus(db, payment.providerRef, 'paid');
	await syncPayment(d, payment.providerRef);
	const [order] = await db.select().from(orders).where(eq(orders.id, r.order.id));
	const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
	return { order, lines, payment, v, d };
}
const reload = async (id: string) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

describe('refund amounts', () => {
	it('per-unit amounts add up exactly over successive partial refunds (discount included)', () => {
		const line = { lineTotal: 10000, discountAmount: 1001, qty: 3, refundedQty: 0 };
		const a = lineRefundAmount(line, 1);
		const b = lineRefundAmount({ ...line, refundedQty: 1 }, 1);
		const c = lineRefundAmount({ ...line, refundedQty: 2 }, 1);
		expect(a + b + c).toBe(8999);
		expect(paidForUnits(line, 3)).toBe(8999);
		expect(refundable(5000, 4999)).toBe(1);
		expect(refundable(5000, 6000)).toBe(0);
	});
});

describe('createRefund', () => {
	it('cannot refund more than captured minus already refunded', async () => {
		const { order, d } = await paidOrder({ qty: 2, price: 2500 }); // 50,00 (free shipping above 50)
		const captured = order.total;
		await expect(createRefund(d, order.id, { mode: 'amount', amount: captured + 1 }, actor)).rejects.toBeInstanceOf(
			RefundError
		);
		const first = await createRefund(d, order.id, { mode: 'amount', amount: 1500 }, actor);
		expect(first).toMatchObject({ amount: 1500, full: false });
		expect(await reload(order.id)).toMatchObject({
			refundedTotal: 1500,
			paymentStatus: 'partially_refunded',
			status: 'paid'
		});
		await expect(createRefund(d, order.id, { mode: 'amount', amount: captured - 1500 + 1 }, actor)).rejects.toThrow(
			/maximaal/
		);
		const rest = await createRefund(d, order.id, { mode: 'amount', amount: captured - 1500 }, actor);
		expect(rest.full).toBe(true);
		expect(await reload(order.id)).toMatchObject({
			refundedTotal: captured,
			paymentStatus: 'refunded',
			status: 'refunded'
		});
		await expect(createRefund(d, order.id, { mode: 'amount', amount: 1 }, actor)).rejects.toThrow(
			/volledig terugbetaald/
		);
		// payment row + provider agree
		const [p] = await db.select().from(payments).where(eq(payments.orderId, order.id));
		expect(p.status).toBe('refunded');
		expect((p.raw as { mock: { refunded: number } }).mock.refunded).toBe(captured);
	});

	it('refuses unpaid orders', async () => {
		const v = await makeVariant(db, { stock: 2 });
		const cartId = await makeCart(db, [{ variantId: v.variantId, qty: 1 }]);
		const d = deps(db);
		const r = await placeOrder(d, { cartId, lang: 'nl', customerId: null, data: checkoutData() });
		if (!r.ok) throw new Error(r.error);
		await expect(createRefund(d, r.order.id, { mode: 'amount', amount: 100 }, actor)).rejects.toThrow(/niet betaald/);
	});

	it('concurrent refunds cannot together exceed the captured amount', async () => {
		const { order, d } = await paidOrder({ qty: 2, price: 3000 });
		const sixty = Math.ceil(order.total * 0.6);
		const results = await Promise.allSettled([
			createRefund(d, order.id, { mode: 'amount', amount: sixty }, actor),
			createRefund(d, order.id, { mode: 'amount', amount: sixty }, actor)
		]);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		expect((await reload(order.id)).refundedTotal).toBe(sixty);
	});

	it('by lines + restock: refunds the paid unit price (with discount), puts units back, events + email', async () => {
		const code = await makeDiscount(db, { type: 'amount', value: 900 });
		const { order, lines, v, d } = await paidOrder({ qty: 3, price: 2500, code: code.code });
		const stockAfterSale = await stockOf(db, v.variantId);
		const line = lines[0];
		const r = await createRefund(
			d,
			order.id,
			{ mode: 'lines', lines: [{ orderLineId: line.id, qty: 2 }], restock: true, reason: 'retour' },
			actor
		);
		expect(r.amount).toBe(paidForUnits(line, 2));
		expect(r.restocked).toBe(2);
		expect(await stockOf(db, v.variantId)).toBe(stockAfterSale + 2);
		const moves = await db
			.select()
			.from(stockMovements)
			.where(and(eq(stockMovements.variantId, v.variantId), eq(stockMovements.reason, 'return')));
		expect(moves).toEqual([expect.objectContaining({ delta: 2, refId: order.number })]);
		expect((await db.select().from(orderLines).where(eq(orderLines.id, line.id)))[0].refundedQty).toBe(2);
		// too many units
		await expect(
			createRefund(d, order.id, { mode: 'lines', lines: [{ orderLineId: line.id, qty: 2 }] }, actor)
		).rejects.toThrow(/maximaal 1/);
		// the last unit completes the refund (shipping was free) → refunded
		const last = await createRefund(
			d,
			order.id,
			{ mode: 'lines', lines: [{ orderLineId: line.id, qty: 1 }], restock: true },
			actor
		);
		expect(last.full).toBe(true);
		expect(await stockOf(db, v.variantId)).toBe(stockAfterSale + 3);
		const o = await reload(order.id);
		expect(o.refundedTotal).toBe(o.total);
		const ev = await db
			.select()
			.from(orderEvents)
			.where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.type, 'refund')));
		expect(ev).toHaveLength(2);
		const rows = await db.select().from(refunds).where(eq(refunds.orderId, order.id));
		expect(rows.every((x) => x.status === 'refunded' && x.providerRef?.startsWith('re_mock_'))).toBe(true);
		// refund emails (FR order) are queued once per refund and render the amount
		const queued = await db
			.select()
			.from(jobs)
			.where(eq(jobs.dedupeKey, `email:refund_issued:${r.refundId}`));
		expect(queued).toHaveLength(1);
		await runJobs(d, { ids: [...r.jobIds, ...last.jobIds] });
		expect(d.email.sent.filter((e) => e.template === 'refund_issued')).toHaveLength(2);
		const mail = d.email.sent.find((e) => e.template === 'refund_issued')!;
		expect(mail.subject).toBe(`Remboursement de la commande ${order.number}`);
		expect(mail.html).toContain(
			new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(r.amount / 100)
		);
	});

	it('a provider failure leaves no trace in the totals', async () => {
		const { order, lines, d } = await paidOrder();
		const failing: PaymentsAdapter = {
			...d.payments,
			createRefund: async () => Promise.reject(new Error('Mollie down'))
		};
		await expect(
			createRefund(
				{ db, payments: failing },
				order.id,
				{ mode: 'lines', lines: [{ orderLineId: lines[0].id, qty: 1 }] },
				actor
			)
		).rejects.toThrow(/weigerde/);
		const o = await reload(order.id);
		expect(o).toMatchObject({ refundedTotal: 0, paymentStatus: 'paid' });
		expect((await db.select().from(orderLines).where(eq(orderLines.id, lines[0].id)))[0].refundedQty).toBe(0);
		const [row] = await db.select().from(refunds).where(eq(refunds.orderId, order.id));
		expect(row.status).toBe('failed');
	});

	it('a late Mollie "paid" webhook does not undo the refund state', async () => {
		const { order, payment, d } = await paidOrder();
		await createRefund(d, order.id, { mode: 'amount', amount: 500 }, actor);
		expect((await syncPayment(d, payment.providerRef)).outcome).toBe('noop');
		const [p] = await db.select().from(payments).where(eq(payments.id, payment.id));
		expect(p.status).toBe('partially_refunded');
		expect((await reload(order.id)).paymentStatus).toBe('partially_refunded');
	});
});

describe('permission orders:refund', () => {
	it('matrix: owner + support can refund; fulfilment + editor cannot', () => {
		expect(can('owner', 'orders:refund')).toBe(true);
		expect(can('support', 'orders:refund')).toBe(true);
		expect(can('fulfilment', 'orders:refund')).toBe(false);
		expect(can('editor', 'orders:refund')).toBe(false);
	});

	const call = async (role: 'support' | 'fulfilment' | 'editor', orderId: string) => {
		const d = deps(db);
		const body = new URLSearchParams({ mode: 'amount', amount: '1,00', reason: 'test' });
		const event = {
			request: new Request('http://localhost/admin/orders/x?/refund', { method: 'POST', body }),
			params: { id: orderId },
			url: new URL('http://localhost/admin/orders/x'),
			locals: {
				db,
				payments: d.payments,
				email: d.email,
				storage: undefined,
				ip: '127.0.0.1',
				admin: { id: crypto.randomUUID(), name: `DEMO ${role}`, email: `${role}@example.invalid`, role, sessionId: 's' }
			}
		};
		return (actions.refund as unknown as (e: typeof event) => Promise<unknown>)(event);
	};

	it('the refund action rejects fulfilment (403) and lets support refund', async () => {
		const { order } = await paidOrder();
		for (const role of ['fulfilment', 'editor'] as const) {
			const err = await call(role, order.id).catch((e) => e);
			expect(isHttpError(err) && err.status).toBe(403);
		}
		expect((await reload(order.id)).refundedTotal).toBe(0);
		const ok = await call('support', order.id);
		expect(ok).toMatchObject({ done: expect.stringContaining('terugbetaling') });
		expect((await reload(order.id)).refundedTotal).toBe(100);
	});
});
