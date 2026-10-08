/** P2-09 / P3-05 — admin order list, status transitions, labels, shipped email, tracking webhook updates. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
	jobs,
	orderEvents,
	orders,
	payments,
	shipments,
	stockMovements,
	stockReservations
} from '#lib/server/db/schema.ts';
import { placeOrder } from '#lib/server/services/checkout.ts';
import { syncPayment } from '#lib/server/services/orders.ts';
import {
	addNote,
	applyTrackingUpdate,
	cancelOrder,
	canTransition,
	createLabel,
	FulfilmentError,
	getOrderDetail,
	listOrders,
	markDelivered,
	markProcessing,
	markShipped
} from '#lib/server/services/fulfilment.ts';
import { runJobs } from '#lib/server/jobs/index.ts';
import { createShipping, mockWebhookSignature } from '#lib/server/adapters/shipping.ts';
import { createStorage } from '#lib/server/adapters/storage.ts';
import {
	checkoutData,
	deps,
	ensureShipping,
	makeCart,
	makeVariant,
	openTestDb,
	setMockStatus,
	stockOf
} from './checkout-fixtures.ts';

const { db, close } = openTestDb();
const storage = createStorage({
	STORAGE_ENDPOINT: '',
	STORAGE_BUCKET: '',
	STORAGE_ACCESS_KEY_ID: '',
	STORAGE_SECRET_ACCESS_KEY: '',
	PUBLIC_MEDIA_URL: '',
	SESSION_SECRET: 'test'
});
const shipping = createShipping('', '');
beforeAll(() => ensureShipping(db));
afterAll(() => close());
const actor = { name: 'DEMO Fulfilment' };
const uid = () => crypto.randomUUID().slice(0, 8);

async function order(opts: { paid?: boolean; email?: string; name?: string; pickup?: boolean } = {}) {
	const v = await makeVariant(db, { stock: 5, price: 3000 });
	const cartId = await makeCart(db, [{ variantId: v.variantId, qty: 2 }]);
	const d = deps(db);
	const r = await placeOrder(d, {
		cartId,
		lang: 'nl',
		customerId: null,
		data: checkoutData({
			email: opts.email ?? 'ship@example.com',
			lastName: opts.name ?? 'DEMO',
			shippingMethod: opts.pickup ? 'pickup' : 'home',
			servicePointId: opts.pickup ? '100001' : undefined,
			spPostalCode: '1000'
		})
	});
	if (!r.ok) throw new Error(r.error);
	if (opts.paid !== false) {
		const [p] = await db.select().from(payments).where(eq(payments.orderId, r.order.id));
		await setMockStatus(db, p.providerRef, 'paid');
		await syncPayment(d, p.providerRef);
	}
	return { order: r.order, v, d };
}
const reload = async (id: string) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

describe('listOrders', () => {
	it('searches number / email / name and filters status, payment and dates', async () => {
		const tag = uid();
		const a = await order({ email: `list-${tag}@example.com`, name: `Zoeknaam${tag}` });
		const b = await order({ paid: false, email: `list-${tag}-b@example.com` });
		expect((await listOrders(db, { q: `list-${tag}` })).total).toBe(2);
		expect((await listOrders(db, { q: `Zoeknaam${tag}` })).rows.map((r) => r.id)).toEqual([a.order.id]);
		expect((await listOrders(db, { q: a.order.number })).rows[0]).toMatchObject({
			id: a.order.id,
			items: 2,
			status: 'paid'
		});
		expect((await listOrders(db, { q: `list-${tag}`, status: 'pending' })).rows.map((r) => r.id)).toEqual([b.order.id]);
		expect((await listOrders(db, { q: `list-${tag}`, payment: 'paid' })).rows.map((r) => r.id)).toEqual([a.order.id]);
		const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
		expect((await listOrders(db, { q: `list-${tag}`, from: today, to: today })).total).toBe(2);
		expect((await listOrders(db, { q: `list-${tag}`, to: '2000-01-01' })).total).toBe(0);
		expect((await listOrders(db, { q: '%' })).total).toBe(0); // LIKE wildcards are escaped
	});
});

describe('status transitions', () => {
	it('transition table', () => {
		expect(canTransition('paid', 'processing')).toBe(true);
		expect(canTransition('pending', 'processing')).toBe(false);
		expect(canTransition('shipped', 'cancelled')).toBe(false);
		expect(canTransition('shipped', 'delivered')).toBe(true);
	});

	it('bulk "mark processing" only moves paid orders and logs a status event', async () => {
		const a = await order();
		const b = await order({ paid: false });
		const changed = await markProcessing(db, [a.order.id, b.order.id], actor);
		expect(changed).toEqual([a.order.id]);
		expect((await reload(a.order.id)).status).toBe('processing');
		expect((await reload(b.order.id)).status).toBe('pending');
		expect(await markProcessing(db, [a.order.id], actor)).toEqual([]); // idempotent
		const ev = await db
			.select()
			.from(orderEvents)
			.where(and(eq(orderEvents.orderId, a.order.id), eq(orderEvents.type, 'status')));
		expect(ev).toEqual([expect.objectContaining({ actor: actor.name, data: { from: 'paid', to: 'processing' } })]);
	});

	it('cancel: pending releases the reservation; paid puts the units back in stock once', async () => {
		const p = await order({ paid: false });
		await cancelOrder(db, p.order.id, actor, 'klant belde');
		expect((await reload(p.order.id)).status).toBe('cancelled');
		expect(await db.select().from(stockReservations).where(eq(stockReservations.orderId, p.order.id))).toHaveLength(0);

		const q = await order();
		const before = await stockOf(db, q.v.variantId);
		const r = await cancelOrder(db, q.order.id, actor);
		expect(r).toMatchObject({ restocked: 2, needsRefund: true });
		expect(await stockOf(db, q.v.variantId)).toBe(before + 2);
		expect(
			await db
				.select()
				.from(stockMovements)
				.where(and(eq(stockMovements.refId, q.order.number), eq(stockMovements.reason, 'return')))
		).toHaveLength(1);
		await expect(cancelOrder(db, q.order.id, actor)).rejects.toBeInstanceOf(FulfilmentError);
	});

	it('notes land in the timeline', async () => {
		const { order: o } = await order();
		await addNote(db, o.id, actor, 'Klant vraagt levering na 17u');
		const d = await getOrderDetail(db, o.id);
		expect(d!.events.find((e) => e.type === 'note')).toMatchObject({
			actor: actor.name,
			data: { text: 'Klant vraagt levering na 17u' }
		});
		expect(await getOrderDetail(db, 'not-a-uuid')).toBeNull();
	});
});

describe('labels, shipping and tracking (mock Sendcloud)', () => {
	it('label → processing + shipment created (idempotent) → shipped email with track & trace → delivered via webhook', async () => {
		const { order: o, d } = await order({ pickup: true });
		const first = await createLabel({ db, shipping, storage }, o.id, actor);
		expect(first.created).toBe(true);
		expect(first.shipment).toMatchObject({
			status: 'created',
			carrier: 'bpost',
			servicePoint: expect.objectContaining({ id: '100001' })
		});
		expect(first.shipment.labelKey).toMatch(/^labels\/\d{4}\/SK-\d{4}-\d{6}-mockparcel_[a-z0-9]+\.pdf$/);
		expect((await storage.get(first.shipment.labelKey!))?.contentType).toBe('application/pdf');
		expect((await reload(o.id)).status).toBe('processing');
		const again = await createLabel({ db, shipping, storage }, o.id, actor);
		expect(again).toMatchObject({ created: false, shipment: { id: first.shipment.id } });

		const jobIds = await markShipped(db, o.id, actor);
		expect((await reload(o.id)).status).toBe('shipped');
		expect((await db.select().from(shipments).where(eq(shipments.id, first.shipment.id)))[0].status).toBe('shipped');
		await runJobs(d, { ids: jobIds });
		const mail = d.email.sent.find((e) => e.template === 'order_shipped')!;
		expect(mail.subject).toBe(`Je bestelling ${o.number} is onderweg`);
		expect(mail.html).toContain(first.shipment.trackingNumber!);
		expect(mail.html).toContain('Volg je pakje');
		expect(mail.html).toContain('DEMO punt'); // pickup point

		// Webhook: shipped again → noop (no second email); delivered → order delivered; replay → noop
		expect(
			(await applyTrackingUpdate(db, { providerRef: first.shipment.providerRef!, status: 'shipped' })).outcome
		).toBe('noop');
		expect(
			(await applyTrackingUpdate(db, { providerRef: first.shipment.providerRef!, status: 'delivered' })).outcome
		).toBe('updated');
		expect((await reload(o.id)).status).toBe('delivered');
		expect(
			(await applyTrackingUpdate(db, { providerRef: first.shipment.providerRef!, status: 'delivered' })).outcome
		).toBe('noop');
		expect((await applyTrackingUpdate(db, { providerRef: 'mockparcel_unknown', status: 'delivered' })).outcome).toBe(
			'unknown'
		);
		expect(
			await db
				.select()
				.from(jobs)
				.where(eq(jobs.dedupeKey, `email:order_shipped:${o.id}`))
		).toHaveLength(1);
	});

	it('the tracking webhook alone moves a labelled order to shipped and queues the email once', async () => {
		const { order: o, d } = await order();
		const { shipment } = await createLabel({ db, shipping, storage }, o.id, actor);
		const r = await applyTrackingUpdate(db, { providerRef: shipment.providerRef!, status: 'shipped' });
		expect(r).toMatchObject({ outcome: 'updated', jobIds: [expect.any(String)] });
		expect((await reload(o.id)).status).toBe('shipped');
		const dup = await applyTrackingUpdate(db, { providerRef: shipment.providerRef!, status: 'shipped' });
		expect(dup).toMatchObject({ outcome: 'noop', jobIds: [] });
		await runJobs(d, { ids: r.jobIds });
		expect(d.email.sent.filter((e) => e.template === 'order_shipped')).toHaveLength(1);
		// exception is recorded but does not move the order
		await applyTrackingUpdate(db, { providerRef: shipment.providerRef!, status: 'exception' });
		expect((await reload(o.id)).status).toBe('shipped');
		await markDelivered(db, o.id, actor);
		expect((await reload(o.id)).status).toBe('delivered');
	});

	it('manual "mark shipped" without a label creates a manual shipment; unpaid orders cannot ship', async () => {
		const { order: o } = await order();
		await markShipped(db, o.id, actor, {
			carrier: 'bpost',
			trackingNumber: 'DEMO123',
			trackingUrl: 'https://example.invalid/t/DEMO123'
		});
		const [s] = await db.select().from(shipments).where(eq(shipments.orderId, o.id));
		expect(s).toMatchObject({ status: 'shipped', trackingNumber: 'DEMO123', labelKey: null });
		const u = await order({ paid: false });
		await expect(createLabel({ db, shipping, storage }, u.order.id, actor)).rejects.toBeInstanceOf(FulfilmentError);
		await expect(markShipped(db, u.order.id, actor)).rejects.toBeInstanceOf(FulfilmentError);
	});

	it('webhook signatures: HMAC of the raw body', async () => {
		const body = JSON.stringify({
			action: 'parcel_status_changed',
			parcel: { id: 'mockparcel_x', status: { id: 11 } }
		});
		const sig = await mockWebhookSignature(body);
		expect(await shipping.verifyWebhook(body, sig)).toBe(true);
		expect(await shipping.verifyWebhook(body + ' ', sig)).toBe(false);
		expect(await shipping.verifyWebhook(body, null)).toBe(false);
		expect(shipping.parseWebhook(JSON.parse(body))).toEqual({ providerRef: 'mockparcel_x', status: 'delivered' });
	});
});
