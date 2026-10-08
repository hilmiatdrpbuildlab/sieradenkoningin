/**
 * P3-08 accept: dashboard/report numbers reconcile with order totals.
 * Uses the test database with fixture orders dated in 2001 so it never collides with other data.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { inArray, like } from 'drizzle-orm';
import * as s from '#lib/server/db/schema.ts';
import { byCategory, byDay, delta, previousRange, summary, toCsv, vatByMonth } from '#lib/server/services/reports.ts';

const url = process.env.TEST_DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin_test';
const pool = new pg.Pool({ connectionString: url, max: 2 });
const db = drizzle(pool, { schema: s });
const range = { from: new Date('2001-03-01T00:00:00Z'), to: new Date('2001-04-01T00:00:00Z') };
const PREFIX = 'RPT-TEST-';

const fixtures = [
	{ day: '2001-03-02T10:00:00Z', lines: [[2500, 2], [1000, 1]], shipping: 495, discount: 0, refunded: 0, status: 'paid' },
	{ day: '2001-03-02T22:30:00Z', lines: [[4995, 1]], shipping: 0, discount: 500, refunded: 0, status: 'paid' }, // 23:30 Brussels → still 2 March
	{ day: '2001-03-15T09:00:00Z', lines: [[7900, 1]], shipping: 0, discount: 0, refunded: 2000, status: 'partially_refunded' },
	{ day: '2001-03-20T09:00:00Z', lines: [[3000, 1]], shipping: 495, discount: 0, refunded: 0, status: 'failed' } // not a sale
] as const;

let expectedGross = 0;
let expectedRefund = 0;

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle' });
	await cleanup();
	const [cat] = await db.insert(s.categories).values({ key: `${PREFIX}cat`, slugs: { nl: 'rpt-test-nl', fr: 'rpt-test-fr' }, name: { nl: 'RPT' }, icon: 'ring' }).onConflictDoNothing().returning();
	const catId = cat?.id ?? (await db.select().from(s.categories).where(like(s.categories.key, `${PREFIX}%`)))[0].id;
	const [product] = await db.insert(s.products).values({ slug: `${PREFIX.toLowerCase()}product`, name: { nl: 'RPT' }, categoryId: catId, price: 1000 }).returning();
	let n = 0;
	for (const f of fixtures) {
		const subtotal = f.lines.reduce((a, [p, q]) => a + p * q, 0);
		const total = subtotal - f.discount + f.shipping;
		const sold = f.status !== 'failed';
		if (sold) {
			expectedGross += total;
			expectedRefund += f.refunded;
		}
		const [o] = await db
			.insert(s.orders)
			.values({
				number: `${PREFIX}${++n}`,
				accessToken: 'x',
				email: 'rpt@example.invalid',
				status: sold ? 'paid' : 'cancelled',
				paymentStatus: f.status,
				subtotal,
				discountTotal: f.discount,
				shippingTotal: f.shipping,
				vatTotal: Math.round(total - total / 1.21),
				total,
				refundedTotal: f.refunded,
				shippingAddress: { name: 'x', line1: 'x', postalCode: '1000', city: 'x', country: 'BE' },
				billingAddress: { name: 'x', line1: 'x', postalCode: '1000', city: 'x', country: 'BE' },
				placedAt: new Date(f.day),
				paidAt: new Date(f.day)
			})
			.returning();
		await db.insert(s.orderLines).values(
			f.lines.map(([price, qty]) => ({ orderId: o.id, productId: product.id, sku: 'RPT', name: { nl: 'RPT' }, unitPrice: price, qty, vatAmount: 0, lineTotal: price * qty }))
		);
	}
});

async function cleanup() {
	const old = await db.select({ id: s.orders.id }).from(s.orders).where(like(s.orders.number, `${PREFIX}%`));
	if (old.length) await db.delete(s.orders).where(inArray(s.orders.id, old.map((o) => o.id)));
	await db.delete(s.products).where(like(s.products.slug, `${PREFIX.toLowerCase()}%`));
	await db.delete(s.categories).where(like(s.categories.key, `${PREFIX}%`));
}

afterAll(async () => {
	await cleanup();
	await pool.end();
});

describe('reports reconcile with orders', () => {
	it('summary totals equal the sum of sold order totals (failed payments excluded)', async () => {
		const r = await summary(db, range);
		expect(r.orders).toBe(3);
		expect(r.gross).toBe(expectedGross);
		expect(r.refunded).toBe(expectedRefund);
		expect(r.net).toBe(expectedGross - expectedRefund);
		expect(r.aov).toBe(Math.round(expectedGross / 3));
		expect(r.units).toBe(2 + 1 + 1 + 1);
	});

	it('daily buckets use Europe/Brussels and sum to the summary', async () => {
		const days = await byDay(db, range);
		expect(days).toHaveLength(31);
		expect(days.find((d) => d.day === '2001-03-02')?.orders).toBe(2);
		expect(days.reduce((a, d) => a + d.gross, 0)).toBe(expectedGross);
	});

	it('VAT per month reconciles and net ex VAT = gross − VAT', async () => {
		const [m] = await vatByMonth(db, range);
		expect(m.month).toBe('2001-03');
		expect(m.gross).toBe(expectedGross);
		expect(m.netExVat).toBe(m.gross - m.vat);
	});

	it('category revenue equals merchandise line totals', async () => {
		const cats = await byCategory(db, range);
		const merch = fixtures.filter((f) => f.status !== 'failed').reduce((a, f) => a + f.lines.reduce((b, [p, q]) => b + p * q, 0), 0);
		expect(cats.reduce((a, c) => a + c.revenue, 0)).toBe(merch);
	});

	it('delta and previous range helpers', () => {
		expect(delta(120, 100)).toBeCloseTo(0.2);
		expect(delta(5, 0)).toBeUndefined();
		const p = previousRange(range);
		expect(p.to).toEqual(range.from);
		expect(p.to.getTime() - p.from.getTime()).toBe(range.to.getTime() - range.from.getTime());
	});

	it('CSV export quotes separators and uses a BOM for Excel', () => {
		const csv = toCsv([{ a: 'x;y', b: 'he said "hi"' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
		expect(csv.startsWith('﻿A;B\r\n')).toBe(true);
		expect(csv).toContain('"x;y";"he said ""hi"""');
	});
});
