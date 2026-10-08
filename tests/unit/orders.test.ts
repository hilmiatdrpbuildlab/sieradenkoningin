/** P2-06 / P2-07 — order creation and the payment state machine, against the test database. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
	cartLines,
	discountRedemptions,
	emailLog,
	jobs,
	orderEvents,
	orderLines,
	orders,
	payments,
	stockMovements,
	stockReservations
} from '#lib/server/db/schema.ts';
import { placeOrder } from '#lib/server/services/checkout.ts';
import {
	applyPaymentStatus,
	estimateDelivery,
	expireStaleOrders,
	formatInvoiceNumber,
	formatOrderNumber,
	retryPayment,
	syncPayment
} from '#lib/server/services/orders.ts';
import { runJobs } from '#lib/server/jobs/index.ts';
import { isValidBeVat, validateCheckout } from '#lib/schemas/checkout.ts';
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

async function newOrder(
	opts: {
		stock?: number;
		qty?: number;
		price?: number;
		code?: string | null;
		email?: string;
		method?: 'home' | 'pickup';
	} = {}
) {
	const v = await makeVariant(db, { stock: opts.stock ?? 5, price: opts.price ?? 2995 });
	const cartId = await makeCart(db, [{ variantId: v.variantId, qty: opts.qty ?? 1 }], opts.code ?? null);
	const d = deps(db);
	const r = await placeOrder(d, {
		cartId,
		lang: 'nl',
		customerId: null,
		data: checkoutData({
			email: opts.email ?? 'demo@example.com',
			shippingMethod: opts.method ?? 'home',
			servicePointId: opts.method === 'pickup' ? '100001' : undefined,
			spPostalCode: '1000'
		})
	});
	if (!r.ok) throw new Error(`placeOrder failed: ${r.error}`);
	const [payment] = await db.select().from(payments).where(eq(payments.orderId, r.order.id));
	return { ...r, v, cartId, d, payment };
}

const reload = async (id: string) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

describe('numbering', () => {
	it('formats order and invoice numbers', () => {
		expect(formatOrderNumber(2026, 123)).toBe('SK-2026-000123');
		expect(formatInvoiceNumber(2027, 1)).toBe('SK-INV-2027-000001');
	});
	it('takes order numbers from the sequence', async () => {
		const a = await newOrder();
		const b = await newOrder();
		expect(a.order.number).toMatch(/^SK-\d{4}-\d{6}$/);
		expect(Number(b.order.number.slice(-6))).toBeGreaterThan(Number(a.order.number.slice(-6)));
		expect(a.order.accessToken.length).toBeGreaterThanOrEqual(24);
	});
});

describe('order creation', () => {
	it('snapshots lines and reconciles totals to the cent', async () => {
		const code = await makeDiscount(db, { type: 'percent', value: 15 });
		const v1 = await makeVariant(db, { stock: 5, price: 3333 });
		const v2 = await makeVariant(db, { stock: 5, price: 1999 });
		const cartId = await makeCart(
			db,
			[
				{ variantId: v1.variantId, qty: 2 },
				{ variantId: v2.variantId, qty: 1, giftWrap: true }
			],
			code.code
		);
		const r = await placeOrder(deps(db), {
			cartId,
			lang: 'fr',
			customerId: null,
			data: checkoutData({ giftMessage: 'Joyeux anniversaire', vatNumber: 'BE0123456749', company: 'DEMO bv' })
		});
		if (!r.ok) throw new Error(r.error);
		const o = r.order;
		const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, o.id));
		expect(lines).toHaveLength(2);
		const l1 = lines.find((l) => l.sku === v1.sku)!;
		expect(l1).toMatchObject({ unitPrice: 3333, qty: 2, lineTotal: 6666, vatRate: 2100 });
		expect(l1.name.fr).toMatch(/^DEMO Bague/);
		expect(l1.variantLabel).toEqual({ nl: 'Goud · maat 52', fr: 'Or · taille 52' });
		const sumLines = lines.reduce((s, l) => s + l.lineTotal, 0);
		const sumDisc = lines.reduce((s, l) => s + l.discountAmount, 0);
		expect(o.subtotal).toBe(sumLines);
		expect(o.discountTotal).toBe(sumDisc);
		expect(o.discountTotal).toBe(Math.round(8665 * 0.15));
		expect(sumLines + o.shippingTotal - o.discountTotal).toBe(o.total);
		expect(o.shippingTotal).toBe(0); // 86,65 − 13,00 ≥ 50 → free
		expect(lines.reduce((s, l) => s + l.vatAmount, 0)).toBe(o.vatTotal);
		expect(o).toMatchObject({
			status: 'pending',
			paymentStatus: 'open',
			locale: 'fr',
			giftWrap: true,
			giftMessage: 'Joyeux anniversaire',
			vatNumber: 'BE0123456749',
			discountCode: code.code
		});
		expect(o.billingAddress.company).toBe('DEMO bv');
		const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, o.id));
		expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['placed', 'payment_created']));
	});

	it('creates the provider payment with the order number, thank-you redirect and webhook', async () => {
		const { order, payment, checkoutUrl } = await newOrder();
		expect(payment).toMatchObject({ provider: 'mock', amount: order.total, status: 'open', method: 'bancontact' });
		expect(checkoutUrl).toBe(`/nl/betalen/mock?id=${payment.providerRef}`);
		const raw = payment.raw as { redirectUrl: string; webhookUrl: string };
		expect(raw.redirectUrl).toBe(`http://localhost:5173/nl/bedankt/${order.number}?t=${order.accessToken}`);
		expect(raw.webhookUrl).toBe('http://localhost:5173/api/webhooks/mollie');
	});

	it('stores the pickup point re-fetched from the carrier', async () => {
		const { order } = await newOrder({ method: 'pickup' });
		expect(order.shippingMethod).toBe('pickup');
		expect(order.servicePoint).toMatchObject({ id: '100001', name: 'DEMO punt' });
		expect(order.shippingTotal).toBe(395);
	});
});

describe('payment state machine', () => {
	it('paid: decrements stock once, consumes the reservation, assigns an invoice number, queues the email, clears the cart', async () => {
		const code = await makeDiscount(db, { type: 'amount', value: 500 });
		const { order, payment, v, cartId, d } = await newOrder({ stock: 4, qty: 2, code: code.code });
		await setMockStatus(db, payment.providerRef, 'paid');

		const first = await syncPayment(d, payment.providerRef);
		expect(first.outcome).toBe('paid');
		const after = await reload(order.id);
		expect(after).toMatchObject({ status: 'paid', paymentStatus: 'paid' });
		expect(after.paidAt).toBeInstanceOf(Date);
		expect(after.invoiceNumber).toMatch(/^SK-INV-\d{4}-\d{6}$/);
		expect(await stockOf(db, v.variantId)).toBe(2);
		expect(await db.select().from(stockReservations).where(eq(stockReservations.orderId, order.id))).toHaveLength(0);
		const moves = await db.select().from(stockMovements).where(eq(stockMovements.variantId, v.variantId));
		expect(moves).toEqual([expect.objectContaining({ delta: -2, reason: 'sale', refId: order.number })]);
		expect(await db.select().from(discountRedemptions).where(eq(discountRedemptions.orderId, order.id))).toEqual([
			expect.objectContaining({ discountId: code.id, amount: 500, email: 'demo@example.com' })
		]);
		expect(await db.select().from(cartLines).where(eq(cartLines.cartId, cartId))).toHaveLength(0);
		// The confirmation email was sent inline and logged
		expect(d.email.sent).toHaveLength(1);
		expect(d.email.sent[0]).toMatchObject({ to: 'demo@example.com', template: 'order_confirmation' });
		expect(d.email.sent[0].subject).toContain(order.number);
		const log = await db.select().from(emailLog).where(eq(emailLog.refId, order.number));
		expect(log).toEqual([expect.objectContaining({ template: 'order_confirmation', status: 'sent', locale: 'nl' })]);

		// Duplicate webhooks are no-ops
		for (let i = 0; i < 3; i++) expect((await syncPayment(d, payment.providerRef)).outcome).toBe('noop');
		expect(await stockOf(db, v.variantId)).toBe(2);
		expect(await db.select().from(stockMovements).where(eq(stockMovements.variantId, v.variantId))).toHaveLength(1);
		expect((await reload(order.id)).invoiceNumber).toBe(after.invoiceNumber);
		expect(
			await db
				.select()
				.from(orderEvents)
				.where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.type, 'paid')))
		).toHaveLength(1);
		expect(
			await db
				.select()
				.from(jobs)
				.where(eq(jobs.dedupeKey, `email:order_confirmation:${order.id}`))
		).toHaveLength(1);
		expect(d.email.sent).toHaveLength(1);
	});

	it('parallel duplicate webhooks still apply "paid" exactly once', async () => {
		const { order, payment, v, d } = await newOrder({ stock: 3, qty: 1 });
		await setMockStatus(db, payment.providerRef, 'paid');
		const results = await Promise.all(Array.from({ length: 5 }, () => syncPayment(d, payment.providerRef)));
		expect(results.filter((r) => r.outcome === 'paid')).toHaveLength(1);
		expect(await stockOf(db, v.variantId)).toBe(2);
		expect((await reload(order.id)).status).toBe('paid');
	});

	it('invoice numbers are consecutive without gaps', async () => {
		const a = await newOrder();
		const b = await newOrder();
		await setMockStatus(db, a.payment.providerRef, 'paid');
		await setMockStatus(db, b.payment.providerRef, 'paid');
		await syncPayment(a.d, a.payment.providerRef);
		await syncPayment(b.d, b.payment.providerRef);
		const ia = Number((await reload(a.order.id)).invoiceNumber!.slice(-6));
		const ib = Number((await reload(b.order.id)).invoiceNumber!.slice(-6));
		expect(ib).toBe(ia + 1);
	});

	for (const status of ['failed', 'canceled', 'expired'] as const) {
		it(`${status}: cancels the order, releases the reservation, keeps stock, queues the payment-failed email; duplicates are no-ops`, async () => {
			const { order, payment, v, d } = await newOrder({ stock: 1, qty: 1 });
			await setMockStatus(db, payment.providerRef, status);
			expect((await syncPayment(d, payment.providerRef)).outcome).toBe('failed');
			expect(await reload(order.id)).toMatchObject({ status: 'cancelled', paymentStatus: status, invoiceNumber: null });
			expect(await db.select().from(stockReservations).where(eq(stockReservations.orderId, order.id))).toHaveLength(0);
			expect(await stockOf(db, v.variantId)).toBe(1);
			expect(d.email.sent.map((e) => e.template)).toEqual(['payment_failed']);
			expect((await syncPayment(d, payment.providerRef)).outcome).toBe('noop');
			expect(d.email.sent).toHaveLength(1);
		});
	}

	it('open / pending statuses change nothing', async () => {
		const { order, payment } = await newOrder();
		const r = await applyPaymentStatus(db, { provider: 'mock', providerRef: payment.providerRef, status: 'pending' });
		expect(r.outcome).toBe('noop');
		expect(await reload(order.id)).toMatchObject({ status: 'pending', paymentStatus: 'open' });
	});

	it('unknown payment ids are ignored', async () => {
		const d = deps(db);
		expect((await syncPayment(d, 'mock_doesnotexist')).outcome).toBe('unknown');
		expect((await syncPayment(d, 'tr_notmock')).outcome).toBe('unknown');
		expect(
			(await applyPaymentStatus(db, { provider: 'mollie', providerRef: 'tr_unknown', status: 'paid' })).outcome
		).toBe('unknown');
	});

	it('a late "failed" for an older attempt does not cancel a newer one', async () => {
		const { order, payment, d } = await newOrder();
		await setMockStatus(db, payment.providerRef, 'canceled');
		await syncPayment(d, payment.providerRef);
		const retry = await retryPayment(d, order.id);
		expect(retry).not.toBeNull();
		expect(await reload(order.id)).toMatchObject({ status: 'pending', paymentStatus: 'open' });
		// the old payment reports again (e.g. delayed webhook) — the order stays pending
		expect(
			(await applyPaymentStatus(db, { provider: 'mock', providerRef: payment.providerRef, status: 'expired' })).outcome
		).toBe('noop');
		expect((await reload(order.id)).status).toBe('pending');
		// the retry gets paid
		await setMockStatus(db, retry!.payment.providerRef, 'paid');
		expect((await syncPayment(d, retry!.payment.providerRef)).outcome).toBe('paid');
		expect(await db.select().from(stockReservations).where(eq(stockReservations.orderId, order.id))).toHaveLength(0);
	});

	it('retry fails cleanly when the stock was sold meanwhile', async () => {
		const { order, payment, v, d } = await newOrder({ stock: 1 });
		await setMockStatus(db, payment.providerRef, 'failed');
		await syncPayment(d, payment.providerRef);
		const other = await makeCart(db, [{ variantId: v.variantId, qty: 1 }]);
		const r = await placeOrder(d, { cartId: other, lang: 'nl', customerId: null, data: checkoutData() });
		expect(r.ok).toBe(true);
		await expect(retryPayment(d, order.id)).rejects.toThrow(/Insufficient stock/);
		expect((await reload(order.id)).status).toBe('cancelled');
	});

	it('cron expiry: stale pending orders are expired; paid ones at the provider are booked', async () => {
		const stale = await newOrder();
		const paidLate = await newOrder();
		await db
			.update(orders)
			.set({ placedAt: new Date(Date.now() - 3 * 3600_000) })
			.where(eq(orders.id, stale.order.id));
		await db
			.update(orders)
			.set({ placedAt: new Date(Date.now() - 3 * 3600_000) })
			.where(eq(orders.id, paidLate.order.id));
		await setMockStatus(db, paidLate.payment.providerRef, 'paid');
		const r = await expireStaleOrders(stale.d);
		expect(r.expired).toBeGreaterThanOrEqual(1);
		expect(r.paid).toBeGreaterThanOrEqual(1);
		expect(await reload(stale.order.id)).toMatchObject({ status: 'cancelled', paymentStatus: 'expired' });
		expect(await reload(paidLate.order.id)).toMatchObject({ status: 'paid' });
		// queued emails are processed by the job runner
		const run = await runJobs({ db, email: stale.d.email, siteUrl: 'http://localhost:5173' }, { limit: 50 });
		expect(run.failed).toBe(0);
	});

	it('superseding: checking out again with the same cart cancels the previous attempt', async () => {
		const first = await newOrder({ stock: 1 });
		const r = await placeOrder(first.d, { cartId: first.cartId, lang: 'nl', customerId: null, data: checkoutData() });
		expect(r.ok).toBe(true);
		expect((await reload(first.order.id)).status).toBe('cancelled');
	});
});

describe('estimateDelivery', () => {
	const ship = { cutoffHour: 16, deliveryDays: 1 };
	const day = (d: Date) => d.toISOString().slice(0, 10);
	it('before the cut-off on a weekday → next working day', () => {
		expect(day(estimateDelivery(new Date('2026-10-07T10:00:00Z'), ship))).toBe('2026-10-08'); // Wed 12:00 Brussels → Thu
	});
	it('after the cut-off → one day later', () => {
		expect(day(estimateDelivery(new Date('2026-10-07T15:30:00Z'), ship))).toBe('2026-10-09'); // Wed 17:30 → Fri
	});
	it('skips the weekend', () => {
		expect(day(estimateDelivery(new Date('2026-10-09T15:30:00Z'), ship))).toBe('2026-10-13'); // Fri 17:30 → ship Mon → Tue
		expect(day(estimateDelivery(new Date('2026-10-10T10:00:00Z'), ship))).toBe('2026-10-13'); // Sat → ship Mon → Tue
	});
});

describe('checkout validation (schemas/checkout.ts)', () => {
	const opts = { countries: ['BE'], paymentMethods: ['bancontact', 'creditcard'] };
	const valid = {
		email: ' Ann@Example.com ',
		firstName: 'Ann',
		lastName: 'DEMO',
		line1: 'Demostraat 1',
		postalCode: '1000',
		city: 'Brussel',
		country: 'BE',
		shippingMethod: 'home',
		paymentMethod: 'bancontact',
		billingSame: 'on',
		terms: 'on'
	};
	it('validates Belgian VAT numbers with the mod-97 check', () => {
		expect(isValidBeVat('BE0123456749')).toBe(true);
		expect(isValidBeVat('be 0123.456.749')).toBe(true);
		expect(isValidBeVat('BE0123456748')).toBe(false);
		expect(isValidBeVat('BE2123456749')).toBe(false);
		expect(isValidBeVat('NL0123456749')).toBe(false);
	});
	it('accepts a valid guest checkout and normalises it', () => {
		const r = validateCheckout(valid, opts);
		expect(r.ok).toBe(true);
		if (r.ok)
			expect(r.data).toMatchObject({ email: 'ann@example.com', billingSame: true, giftWrap: false, terms: true });
	});
	it('reports every problem in one pass', () => {
		const r = validateCheckout(
			{
				...valid,
				email: 'x',
				postalCode: '123',
				country: 'NL',
				terms: '',
				vatNumber: 'BE0123456748',
				billingSame: '',
				shippingMethod: 'pickup',
				paymentMethod: 'paypal',
				giftMessage: 'x'.repeat(201)
			},
			opts
		);
		expect(r.ok).toBe(false);
		if (!r.ok)
			expect(r.errors).toMatchObject({
				email: ['email'],
				country: ['country'],
				terms: ['terms'],
				vatNumber: ['vat'],
				paymentMethod: ['payment'],
				servicePointId: ['service_point'],
				billingLine1: ['required'],
				billingCountry: ['country'],
				giftMessage: ['too_long']
			});
	});
	it('checks the postal code format per country', () => {
		const r = validateCheckout({ ...valid, postalCode: '0999' }, opts);
		expect(!r.ok && r.errors.postalCode).toEqual(['postal']);
	});
});
