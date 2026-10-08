/** P5-04: queued media deletion only removes objects that are still deleted AND unused. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq, like } from 'drizzle-orm';
import * as s from '#lib/server/db/schema.ts';
import { dailyMaintenance, storageDeleteJob } from '#lib/server/services/maintenance.ts';
import type { Storage } from '#lib/server/adapters/storage.ts';

const pool = new pg.Pool({
	connectionString: process.env.TEST_DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin_test',
	max: 2
});
const db = drizzle(pool, { schema: s });
const deleted: string[] = [];
const storage = { delete: async (k: string) => void deleted.push(k) } as unknown as Storage;

async function cleanup() {
	await db.delete(s.products).where(eq(s.products.slug, 'maint-test-product'));
	await db.delete(s.categories).where(eq(s.categories.key, 'maint-test'));
	await db.delete(s.media).where(like(s.media.storageKey, 'maint-test/%'));
}

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle' });
	await cleanup();
});
afterAll(async () => {
	await cleanup();
	await pool.end();
});

describe('storage.delete job', () => {
	it('deletes a soft-deleted, unused object and its row', async () => {
		await db.insert(s.media).values({ storageKey: 'maint-test/a.jpg', mime: 'image/jpeg', deletedAt: new Date() });
		await storageDeleteJob({ payload: { key: 'maint-test/a.jpg' } }, { db, storage });
		expect(deleted).toContain('maint-test/a.jpg');
		expect(await db.select().from(s.media).where(eq(s.media.storageKey, 'maint-test/a.jpg'))).toHaveLength(0);
	});

	it('keeps objects that were restored or are in use again', async () => {
		await db.insert(s.media).values({ storageKey: 'maint-test/restored.jpg', mime: 'image/jpeg' });
		const [m] = await db
			.insert(s.media)
			.values({ storageKey: 'maint-test/used.jpg', mime: 'image/jpeg', deletedAt: new Date() })
			.returning();
		const [cat] = await db
			.insert(s.categories)
			.values({ key: 'maint-test', slugs: { nl: 'maint-nl', fr: 'maint-fr' }, name: { nl: 'x' }, icon: 'ring' })
			.returning();
		const [p] = await db
			.insert(s.products)
			.values({ slug: 'maint-test-product', name: { nl: 'x' }, categoryId: cat.id, price: 100 })
			.returning();
		await db.insert(s.productImages).values({ productId: p.id, mediaId: m.id, alt: { nl: 'maint-test' } });

		await storageDeleteJob({ payload: { key: 'maint-test/restored.jpg' } }, { db, storage });
		await storageDeleteJob({ payload: { key: 'maint-test/used.jpg' } }, { db, storage });
		expect(deleted).not.toContain('maint-test/restored.jpg');
		expect(deleted).not.toContain('maint-test/used.jpg');
	});

	it('daily maintenance runs idempotently', async () => {
		const a = await dailyMaintenance(db);
		const b = await dailyMaintenance(db);
		expect(a.sessions).toBe('purged');
		expect(b.rateLimits).toBe(0);
	});
});
