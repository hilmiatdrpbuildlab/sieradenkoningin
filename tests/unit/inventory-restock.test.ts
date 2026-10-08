/** P3-09 integration: any stock increase from 0 (admin adjust, import, refund restock) queues back-in-stock alerts. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, sql } from 'drizzle-orm';
import * as s from '#lib/server/db/schema.ts';
import { applyStockDelta } from '#lib/server/services/inventory.ts';

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin_test', max: 2 });
const db = drizzle(pool, { schema: s });
let variantId = '';

async function cleanup() {
	await db.delete(s.jobs).where(and(eq(s.jobs.type, 'stock.alert'), sql`${s.jobs.payload}::text like '%restock-test%'`));
	await db.delete(s.products).where(eq(s.products.slug, 'restock-test-product'));
	await db.delete(s.categories).where(eq(s.categories.key, 'restock-test'));
}

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle' });
	await cleanup();
	const [cat] = await db.insert(s.categories).values({ key: 'restock-test', slugs: { nl: 'restock-nl', fr: 'restock-fr' }, name: { nl: 'x' }, icon: 'ring' }).returning();
	const [p] = await db.insert(s.products).values({ slug: 'restock-test-product', name: { nl: 'x' }, categoryId: cat.id, price: 100, status: 'active' }).returning();
	const [v] = await db.insert(s.variants).values({ productId: p.id, sku: 'RESTOCK-TEST-1', stock: 0 }).returning();
	variantId = v.id;
	await db.insert(s.stockAlerts).values({ email: 'restock-test@example.invalid', variantId });
});

afterAll(async () => {
	await cleanup();
	await pool.end();
});

const alertJobs = () => db.select().from(s.jobs).where(and(eq(s.jobs.type, 'stock.alert'), sql`${s.jobs.payload}::text like ${'%' + variantId + '%'}`));

describe('applyStockDelta → back-in-stock alerts', () => {
	it('queues an alert job when stock goes from 0 to > 0', async () => {
		await applyStockDelta(db, { variantId, delta: 3, reason: 'adjust', note: 'restock-test' });
		expect((await alertJobs()).length).toBe(1);
	});

	it('does not queue again for further increases or decreases', async () => {
		await applyStockDelta(db, { variantId, delta: 2, reason: 'adjust' });
		await applyStockDelta(db, { variantId, delta: -1, reason: 'adjust' });
		expect((await alertJobs()).length).toBe(1);
	});
});

