/** P3-09: back-in-stock alerts are sent once — no duplicates across repeated or concurrent runs. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, like } from 'drizzle-orm';
import * as s from '#lib/server/db/schema.ts';
import type { EmailAdapter, OutgoingEmail } from '#lib/server/adapters/email.ts';
import { runJobs } from '#lib/server/jobs/index.ts';
import {
	notifyRestock,
	scanRestocked,
	sendRestockAlerts,
	subscribeStockAlert
} from '#lib/server/services/stock-alerts.ts';

const url = process.env.TEST_DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin_test';
const pool = new pg.Pool({ connectionString: url, max: 6 });
const db = drizzle(pool, { schema: s });
let variantId = '';

function mailbox(fail = false) {
	const sent: OutgoingEmail[] = [];
	const adapter: EmailAdapter = {
		provider: 'mock',
		async send(e) {
			if (fail) throw new Error('smtp down');
			sent.push(e);
			return { id: `t-${sent.length}` };
		}
	};
	return { sent, adapter };
}
const deps = (email: EmailAdapter) => ({ db, email, siteUrl: 'https://shop.example' });

async function cleanup() {
	await db.delete(s.jobs).where(eq(s.jobs.type, 'stock.alert'));
	await db.delete(s.products).where(eq(s.products.slug, 'bis-test-ring'));
	await db.delete(s.categories).where(eq(s.categories.key, 'bis-test'));
	await db.delete(s.emailLog).where(like(s.emailLog.to, '%bis-test%'));
}

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle' });
	await cleanup();
	const [cat] = await db.insert(s.categories).values({ key: 'bis-test', slugs: { nl: 'bis-nl', fr: 'bis-fr' }, name: { nl: 'x' }, icon: 'ring' }).returning();
	const [p] = await db
		.insert(s.products)
		.values({ slug: 'bis-test-ring', name: { nl: 'DEMO Klaverring', fr: 'DEMO Bague trèfle' }, categoryId: cat.id, price: 4900, status: 'active' })
		.returning();
	const [v] = await db.insert(s.variants).values({ productId: p.id, sku: 'BIS-TEST-1', metal: 'gold', size: '52', stock: 0 }).returning();
	variantId = v.id;
});
afterAll(async () => {
	await cleanup();
	await pool.end();
});
beforeEach(async () => {
	await db.delete(s.stockAlerts).where(eq(s.stockAlerts.variantId, variantId));
	await db.delete(s.jobs).where(eq(s.jobs.type, 'stock.alert'));
	await db.update(s.variants).set({ stock: 0 }).where(eq(s.variants.id, variantId));
});

const setStock = (stock: number) => db.update(s.variants).set({ stock }).where(eq(s.variants.id, variantId));

describe('back-in-stock alerts', () => {
	it('subscribing is idempotent per email + variant and refused while in stock', async () => {
		expect(await subscribeStockAlert(db, { email: 'A@bis-test.invalid', variantId, locale: 'nl' })).toBe('ok');
		expect(await subscribeStockAlert(db, { email: 'a@bis-test.invalid', variantId, locale: 'fr' })).toBe('ok');
		const rows = await db.select().from(s.stockAlerts).where(eq(s.stockAlerts.variantId, variantId));
		expect(rows).toHaveLength(1);
		expect(rows[0].locale).toBe('fr');
		await setStock(3);
		expect(await subscribeStockAlert(db, { email: 'b@bis-test.invalid', variantId, locale: 'nl' })).toBe('in_stock');
		expect(await subscribeStockAlert(db, { email: 'b@bis-test.invalid', variantId: '00000000-0000-0000-0000-000000000000', locale: 'nl' })).toBe('not_found');
	});

	it('sends nothing while the variant is still out of stock', async () => {
		await subscribeStockAlert(db, { email: 'c@bis-test.invalid', variantId, locale: 'nl' });
		const { sent, adapter } = mailbox();
		expect(await notifyRestock(db, [variantId])).toBeNull();
		await sendRestockAlerts(deps(adapter), [variantId]);
		expect(sent).toHaveLength(0);
	});

	it('sends each alert exactly once — repeated runs, scan + notify, and concurrent runners', async () => {
		for (const x of ['d', 'e', 'f']) await subscribeStockAlert(db, { email: `${x}@bis-test.invalid`, variantId, locale: x === 'f' ? 'fr' : 'nl' });
		await setStock(2);
		const { sent, adapter } = mailbox();

		// Both trigger paths enqueue a job; a third runner calls the sender directly at the same time.
		const jobA = await notifyRestock(db, [variantId]);
		const scan = await scanRestocked(db);
		expect(jobA).not.toBeNull();
		expect(scan.variants).toBe(1);
		// Only our jobs (the shared test DB may hold other queued jobs).
		const ids = [jobA!, scan.jobId!];
		await Promise.all([runJobs(deps(adapter), { ids }), runJobs(deps(adapter), { ids }), sendRestockAlerts(deps(adapter), [variantId])]);
		await runJobs(deps(adapter), { ids });
		await sendRestockAlerts(deps(adapter), [variantId]);
		const jobRows = await db.select().from(s.jobs).where(eq(s.jobs.type, 'stock.alert'));
		expect(jobRows.every((j) => j.status === 'done')).toBe(true);

		expect(sent.map((e) => e.to).sort()).toEqual(['d@bis-test.invalid', 'e@bis-test.invalid', 'f@bis-test.invalid']);
		expect(sent.find((e) => e.to === 'f@bis-test.invalid')?.subject).toContain('DEMO Bague trèfle');
		expect(sent[0].html).toContain('https://shop.example/');
		const pending = await db.select().from(s.stockAlerts).where(and(eq(s.stockAlerts.variantId, variantId)));
		expect(pending.every((a) => a.notifiedAt !== null)).toBe(true);
		expect(await notifyRestock(db, [variantId])).toBeNull();
	});

	it('a failed send releases the claim so a retry delivers it (still once)', async () => {
		await subscribeStockAlert(db, { email: 'g@bis-test.invalid', variantId, locale: 'nl' });
		await setStock(1);
		await expect(sendRestockAlerts(deps(mailbox(true).adapter), [variantId])).rejects.toThrow(/retry/);
		const [row] = await db.select().from(s.stockAlerts).where(eq(s.stockAlerts.variantId, variantId));
		expect(row.notifiedAt).toBeNull();
		const { sent, adapter } = mailbox();
		await sendRestockAlerts(deps(adapter), [variantId]);
		await sendRestockAlerts(deps(adapter), [variantId]);
		expect(sent).toHaveLength(1);
	});

	it('re-subscribing after a sent alert re-arms it for the next restock', async () => {
		await subscribeStockAlert(db, { email: 'h@bis-test.invalid', variantId, locale: 'nl' });
		await setStock(1);
		const first = mailbox();
		await sendRestockAlerts(deps(first.adapter), [variantId]);
		expect(first.sent).toHaveLength(1);
		await setStock(0);
		await subscribeStockAlert(db, { email: 'h@bis-test.invalid', variantId, locale: 'nl' });
		await setStock(4);
		const second = mailbox();
		await sendRestockAlerts(deps(second.adapter), [variantId]);
		await sendRestockAlerts(deps(second.adapter), [variantId]);
		expect(second.sent).toHaveLength(1);
	});
});
