/** P3-04: public order tracking reveals nothing for a wrong email; customer timeline rules. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { like } from 'drizzle-orm';
import * as s from '#lib/server/db/schema.ts';
import { buildTimeline, lookupOrderForTracking } from '#lib/server/services/tracking.ts';
import { trackSchema } from '#lib/schemas/account.ts';

const url = process.env.TEST_DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin_test';
const pool = new pg.Pool({ connectionString: url, max: 2 });
const db = drizzle(pool, { schema: s });
const NUMBER = 'SK-1999-424242';
const EMAIL = 'track-test@example.invalid';

async function cleanup() {
	await db.delete(s.orders).where(like(s.orders.email, '%track-test%'));
}

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle' });
	await cleanup();
	const addr = { name: 'Ann Test', line1: 'Straat 1', postalCode: '9000', city: 'Gent', country: 'BE' };
	const placedAt = new Date('2026-10-01T10:00:00Z');
	const [o] = await db
		.insert(s.orders)
		.values({
			number: NUMBER,
			accessToken: 't',
			email: EMAIL,
			status: 'shipped',
			paymentStatus: 'paid',
			subtotal: 4900,
			vatTotal: 850,
			total: 4900,
			shippingAddress: addr,
			billingAddress: addr,
			placedAt,
			paidAt: new Date('2026-10-01T10:05:00Z')
		})
		.returning();
	await db.insert(s.orderLines).values({ orderId: o.id, sku: 'X', name: { nl: 'DEMO Ring', fr: 'DEMO Bague' }, unitPrice: 4900, qty: 1, vatAmount: 850, lineTotal: 4900 });
	await db.insert(s.shipments).values({
		orderId: o.id,
		carrier: 'bpost',
		trackingNumber: '3SABC123',
		trackingUrl: 'https://track.bpost.cloud/btr/web/#/search?itemCode=3SABC123',
		status: 'shipped'
	});
	await db.insert(s.orderEvents).values({ orderId: o.id, type: 'shipped', createdAt: new Date('2026-10-02T09:00:00Z') });
});
afterAll(async () => {
	await cleanup();
	await pool.end();
});

describe('lookupOrderForTracking', () => {
	it('finds the order with number + email (case-insensitive) and returns timeline + tracking', async () => {
		const r = await lookupOrderForTracking(db, NUMBER.toLowerCase(), EMAIL.toUpperCase(), 'fr');
		expect(r?.number).toBe(NUMBER);
		expect(r?.lines[0].name).toBe('DEMO Bague');
		expect(r?.shipments[0]).toMatchObject({ carrier: 'bpost', trackingNumber: '3SABC123' });
		expect(r?.timeline.map((x) => `${x.key}:${x.state}`)).toEqual(['placed:done', 'paid:done', 'processing:done', 'shipped:current', 'delivered:upcoming']);
		expect(r?.timeline.find((x) => x.key === 'shipped')?.at).toBe('2026-10-02T09:00:00.000Z');
	});

	it('a wrong email reveals nothing: identical to a non-existent order', async () => {
		const wrongEmail = await lookupOrderForTracking(db, NUMBER, 'someone-else@example.invalid', 'nl');
		const noOrder = await lookupOrderForTracking(db, 'SK-1999-000000', EMAIL, 'nl');
		expect(wrongEmail).toBeNull();
		expect(noOrder).toBeNull();
		expect(wrongEmail).toStrictEqual(noOrder);
	});

	it('normalises the order number from the form', () => {
		expect(trackSchema.parse({ number: ' sk-2026-000123 ', email: 'A@B.be' })).toEqual({ number: 'SK-2026-000123', email: 'a@b.be' });
		expect(trackSchema.safeParse({ number: '123', email: 'a@b.be' }).success).toBe(false);
	});
});

describe('buildTimeline', () => {
	const placedAt = new Date('2026-10-01T10:00:00Z');
	it('pending order: placed is current, the rest upcoming', () => {
		const t = buildTimeline({ status: 'pending', placedAt, paidAt: null }, []);
		expect(t.map((x) => x.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
	});
	it('delivered via shipment status when no event exists', () => {
		const updatedAt = new Date('2026-10-03T12:00:00Z');
		const t = buildTimeline({ status: 'delivered', placedAt, paidAt: placedAt }, [], [
			{ carrier: 'bpost', trackingNumber: null, trackingUrl: null, status: 'delivered', createdAt: placedAt, updatedAt }
		]);
		expect(t.at(-1)).toEqual({ key: 'delivered', state: 'current', at: updatedAt.toISOString() });
	});
	it('cancelled order ends with a cancelled step after what happened', () => {
		const t = buildTimeline({ status: 'cancelled', placedAt, paidAt: null }, [{ type: 'status', data: { to: 'cancelled' }, createdAt: placedAt }]);
		expect(t.map((x) => x.key)).toEqual(['placed', 'cancelled']);
		expect(t[1].state).toBe('current');
	});
});
