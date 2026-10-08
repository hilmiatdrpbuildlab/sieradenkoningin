import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evaluateDiscount, lookupDiscount, normalizeCode, type DiscountRow } from '#lib/server/services/discounts.ts';
import { loadCart, setDiscountCode } from '#lib/server/services/cart.ts';
import { discountRedemptions, orders } from '#lib/server/db/schema.ts';
import { ensureShipping, makeCart, makeDiscount, makeVariant, openTestDb } from './checkout-fixtures.ts';

const now = new Date('2026-12-01T12:00:00Z');
const base: DiscountRow = {
	id: '00000000-0000-0000-0000-000000000001',
	code: 'KONINGIN10',
	type: 'percent',
	value: 10,
	minSubtotal: null,
	startsAt: null,
	endsAt: null,
	usageLimit: null,
	perCustomerLimit: null,
	active: true,
	createdAt: now,
	updatedAt: now
};
const d = (o: Partial<DiscountRow>): DiscountRow => ({ ...base, ...o });

describe('evaluateDiscount — every rule', () => {
	it('percent: rounds to the cent', () => {
		expect(evaluateDiscount(d({ value: 10 }), { subtotal: 4995, now })).toEqual({
			ok: true,
			code: 'KONINGIN10',
			type: 'percent',
			amount: 500,
			freeShipping: false
		});
		expect(evaluateDiscount(d({ value: 15 }), { subtotal: 3333, now })).toMatchObject({ ok: true, amount: 500 });
	});
	it('percent: clamps the value to 0–100', () => {
		expect(evaluateDiscount(d({ value: 150 }), { subtotal: 2000, now })).toMatchObject({ amount: 2000 });
		expect(evaluateDiscount(d({ value: -5 }), { subtotal: 2000, now })).toMatchObject({ amount: 0 });
	});
	it('amount: fixed cents, never more than the subtotal', () => {
		expect(evaluateDiscount(d({ type: 'amount', value: 1000 }), { subtotal: 4995, now })).toMatchObject({
			ok: true,
			amount: 1000,
			freeShipping: false
		});
		expect(evaluateDiscount(d({ type: 'amount', value: 1000 }), { subtotal: 600, now })).toMatchObject({
			ok: true,
			amount: 600
		});
	});
	it('free_shipping: no amount, flags free shipping', () => {
		expect(evaluateDiscount(d({ type: 'free_shipping', value: 0 }), { subtotal: 1000, now })).toMatchObject({
			ok: true,
			amount: 0,
			freeShipping: true
		});
	});
	it('min subtotal', () => {
		expect(evaluateDiscount(d({ minSubtotal: 5000 }), { subtotal: 4999, now })).toEqual({
			ok: false,
			reason: 'min_subtotal',
			minSubtotal: 5000
		});
		expect(evaluateDiscount(d({ minSubtotal: 5000 }), { subtotal: 5000, now })).toMatchObject({ ok: true });
	});
	it('date window: not started, expired, and the boundaries', () => {
		expect(evaluateDiscount(d({ startsAt: new Date('2026-12-02T00:00:00Z') }), { subtotal: 1000, now })).toEqual({
			ok: false,
			reason: 'not_started'
		});
		expect(evaluateDiscount(d({ endsAt: new Date('2026-11-30T23:59:59Z') }), { subtotal: 1000, now })).toEqual({
			ok: false,
			reason: 'expired'
		});
		expect(evaluateDiscount(d({ startsAt: now }), { subtotal: 1000, now })).toMatchObject({ ok: true });
		expect(evaluateDiscount(d({ endsAt: now }), { subtotal: 1000, now })).toEqual({ ok: false, reason: 'expired' });
		expect(
			evaluateDiscount(d({ startsAt: new Date('2026-11-01'), endsAt: new Date('2027-01-01') }), { subtotal: 1000, now })
		).toMatchObject({ ok: true });
	});
	it('usage limit', () => {
		expect(evaluateDiscount(d({ usageLimit: 3 }), { subtotal: 1000, now, totalUses: 3 })).toEqual({
			ok: false,
			reason: 'usage_limit'
		});
		expect(evaluateDiscount(d({ usageLimit: 3 }), { subtotal: 1000, now, totalUses: 2 })).toMatchObject({ ok: true });
	});
	it('per-customer limit', () => {
		expect(evaluateDiscount(d({ perCustomerLimit: 1 }), { subtotal: 1000, now, customerUses: 1 })).toEqual({
			ok: false,
			reason: 'customer_limit'
		});
		expect(evaluateDiscount(d({ perCustomerLimit: 1 }), { subtotal: 1000, now, customerUses: 0 })).toMatchObject({
			ok: true
		});
	});
	it('inactive', () => {
		expect(evaluateDiscount(d({ active: false }), { subtotal: 1000, now })).toEqual({ ok: false, reason: 'inactive' });
	});
	it('not found', () => {
		expect(evaluateDiscount(null, { subtotal: 1000, now })).toEqual({ ok: false, reason: 'not_found' });
		expect(evaluateDiscount(undefined, { subtotal: 1000, now })).toEqual({ ok: false, reason: 'not_found' });
	});
	it('normalises codes', () => {
		expect(normalizeCode('  koningin 10 ')).toBe('KONINGIN10');
	});
});

describe('discounts against the database', () => {
	const { db, close } = openTestDb();
	beforeAll(() => ensureShipping(db));
	afterAll(() => close());

	it('counts only paid orders for the usage and per-customer limits', async () => {
		const disc = await makeDiscount(db, { type: 'percent', value: 10, usageLimit: 1, perCustomerLimit: 1 });
		const mk = async (paymentStatus: 'paid' | 'open', email: string) => {
			const addr = { name: 'DEMO', line1: 'x', postalCode: '1000', city: 'Brussel', country: 'BE' };
			const [o] = await db
				.insert(orders)
				.values({
					number: `SK-TEST-${crypto.randomUUID().slice(0, 8)}`,
					accessToken: 'x',
					email,
					subtotal: 1000,
					vatTotal: 0,
					total: 1000,
					shippingAddress: addr,
					billingAddress: addr,
					paymentStatus
				})
				.returning();
			await db.insert(discountRedemptions).values({ discountId: disc.id, orderId: o.id, email, amount: 100 });
		};
		await mk('open', 'a@example.com');
		let r = await lookupDiscount(db, disc.code.toLowerCase(), 'a@example.com');
		expect([r.totalUses, r.customerUses]).toEqual([0, 0]);
		await mk('paid', 'a@example.com');
		r = await lookupDiscount(db, disc.code, 'A@example.com');
		expect([r.totalUses, r.customerUses]).toEqual([1, 1]);
		expect(
			evaluateDiscount(r.discount, { subtotal: 5000, totalUses: r.totalUses, customerUses: r.customerUses })
		).toEqual({ ok: false, reason: 'usage_limit' });
		expect((await lookupDiscount(db, disc.code, 'b@example.com')).customerUses).toBe(0);
	});

	it('only one code applies per cart: a new code replaces the previous one (no stacking)', async () => {
		const v = await makeVariant(db, { stock: 5, price: 10000 });
		const ten = await makeDiscount(db, { type: 'percent', value: 10 });
		const fiver = await makeDiscount(db, { type: 'amount', value: 500 });
		const cartId = await makeCart(db, [{ variantId: v.variantId, qty: 1 }]);
		await setDiscountCode(db, cartId, ten.code);
		expect((await loadCart(db, cartId, 'nl')).discount).toBe(1000);
		await setDiscountCode(db, cartId, fiver.code);
		const view = await loadCart(db, cartId, 'nl');
		expect(view.discountCode).toBe(fiver.code);
		expect(view.discount).toBe(500);
		expect(view.total).toBe(10000 - 500);
	});

	it('a stored code that no longer qualifies gives no discount and a reason', async () => {
		const v = await makeVariant(db, { stock: 5, price: 2000 });
		const min = await makeDiscount(db, { type: 'amount', value: 500, minSubtotal: 5000 });
		const cartId = await makeCart(db, [{ variantId: v.variantId, qty: 1 }], min.code);
		const view = await loadCart(db, cartId, 'nl');
		expect(view.discount).toBe(0);
		expect(view.discountError).toBe('min_subtotal');
	});
});
