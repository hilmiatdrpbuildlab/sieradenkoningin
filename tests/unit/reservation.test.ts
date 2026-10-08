/** P2-05 — stock reservations, against the test database. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { stockReservations } from '#lib/server/db/schema.ts';
import { placeOrder } from '#lib/server/services/checkout.ts';
import { availableStock } from '#lib/server/services/cart.ts';
import {
	InsufficientStockError,
	lockAndCheck,
	releaseExpiredReservations,
	releaseReservations,
	reserveStock
} from '#lib/server/services/inventory-reservations.ts';
import { checkoutData, deps, ensureShipping, makeCart, makeVariant, openTestDb, stockOf } from './checkout-fixtures.ts';

const { db, close } = openTestDb();
beforeAll(() => ensureShipping(db));
afterAll(() => close());

describe('stock reservation', () => {
	it('two parallel checkouts for the last unit → exactly one succeeds', async () => {
		const v = await makeVariant(db, { stock: 1 });
		const [cartA, cartB] = await Promise.all([
			makeCart(db, [{ variantId: v.variantId, qty: 1 }]),
			makeCart(db, [{ variantId: v.variantId, qty: 1 }])
		]);
		const d = deps(db);
		const results = await Promise.all([
			placeOrder(d, { cartId: cartA, lang: 'nl', customerId: null, data: checkoutData({ email: 'a@example.com' }) }),
			placeOrder(d, { cartId: cartB, lang: 'nl', customerId: null, data: checkoutData({ email: 'b@example.com' }) })
		]);
		const ok = results.filter((r) => r.ok);
		const failed = results.filter((r) => !r.ok);
		expect(ok).toHaveLength(1);
		expect(failed).toHaveLength(1);
		const f = failed[0];
		expect(f.ok === false && f.error).toBe('stock');
		if (!f.ok && f.error === 'stock')
			expect(f.shortages[0]).toMatchObject({ variantId: v.variantId, requested: 1, available: 0 });

		const held = await db.select().from(stockReservations).where(eq(stockReservations.variantId, v.variantId));
		expect(held).toHaveLength(1);
		expect(held[0].qty).toBe(1);
		expect(held[0].expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
		// Real stock is untouched until the order is paid
		expect(await stockOf(db, v.variantId)).toBe(1);
	});

	it('ten parallel checkouts for 3 units → exactly three succeed', async () => {
		const v = await makeVariant(db, { stock: 3 });
		const carts = await Promise.all(
			Array.from({ length: 10 }, () => makeCart(db, [{ variantId: v.variantId, qty: 1 }]))
		);
		const d = deps(db);
		const results = await Promise.all(
			carts.map((cartId, i) =>
				placeOrder(d, { cartId, lang: 'nl', customerId: null, data: checkoutData({ email: `p${i}@example.com` }) })
			)
		);
		expect(results.filter((r) => r.ok)).toHaveLength(3);
	});

	it('a reservation reduces what other carts can buy, but not what its own cart sees', async () => {
		const v = await makeVariant(db, { stock: 2 });
		const cart = await makeCart(db, [{ variantId: v.variantId, qty: 2 }]);
		const r = await placeOrder(deps(db), { cartId: cart, lang: 'nl', customerId: null, data: checkoutData() });
		expect(r.ok).toBe(true);
		expect((await availableStock(db, [v.variantId], cart)).get(v.variantId)).toBe(2);
		expect((await availableStock(db, [v.variantId], null)).get(v.variantId)).toBe(0);
	});

	it('rolls back the whole transaction (no order, no reservation) when stock is short', async () => {
		const v = await makeVariant(db, { stock: 1 });
		const cart = await makeCart(db, [{ variantId: v.variantId, qty: 2 }]);
		await expect(
			db.transaction((tx) =>
				reserveStock(tx, { cartId: cart, orderId: crypto.randomUUID(), lines: [{ variantId: v.variantId, qty: 2 }] })
			)
		).rejects.toBeInstanceOf(InsufficientStockError);
		expect(await db.select().from(stockReservations).where(eq(stockReservations.variantId, v.variantId))).toHaveLength(
			0
		);
	});

	it('expired reservations no longer count and are released by the cron', async () => {
		const v = await makeVariant(db, { stock: 1 });
		const cartA = await makeCart(db, [{ variantId: v.variantId, qty: 1 }]);
		const orderId = crypto.randomUUID();
		await db.transaction((tx) =>
			reserveStock(tx, { cartId: cartA, orderId, lines: [{ variantId: v.variantId, qty: 1 }], ttlMs: -1000 })
		);
		const shortage = await db.transaction((tx) =>
			lockAndCheck(tx, [{ variantId: v.variantId, qty: 1 }], crypto.randomUUID())
		);
		expect(shortage).toEqual([]);
		expect(await releaseExpiredReservations(db)).toBeGreaterThanOrEqual(1);
		expect(await db.select().from(stockReservations).where(eq(stockReservations.orderId, orderId))).toHaveLength(0);
	});

	it('releaseReservations frees the units of an order', async () => {
		const v = await makeVariant(db, { stock: 1 });
		const cart = await makeCart(db, [{ variantId: v.variantId, qty: 1 }]);
		const r = await placeOrder(deps(db), { cartId: cart, lang: 'nl', customerId: null, data: checkoutData() });
		if (!r.ok) throw new Error('expected order');
		expect((await availableStock(db, [v.variantId], null)).get(v.variantId)).toBe(0);
		expect(await releaseReservations(db, r.order.id)).toBe(1);
		expect((await availableStock(db, [v.variantId], null)).get(v.variantId)).toBe(1);
	});
});
