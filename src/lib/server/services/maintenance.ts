/**
 * Housekeeping (P5-04): the `storage.delete` job handler and the daily cleanup run by the 05:00 cron.
 * Every step is idempotent so a retried cron or job never does harm.
 */
import { and, eq, isNotNull, lt, or, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { jobs, magicLinks, media, rateLimits } from '../db/schema.ts';
import type { Storage } from '../adapters/storage.ts';
import { purgeExpiredSessions } from '../auth/session.ts';
import { purgeOldCarts } from './cart.ts';
import { usageSql } from './media.ts';

/**
 * Deletes a soft-deleted media object from storage, then its row — but only if it is still marked
 * deleted AND unused (someone may have re-used the image after it was queued).
 */
export async function storageDeleteJob(job: { payload: Record<string, unknown> }, deps: { db: Executor; storage?: Storage }) {
	const key = String(job.payload.key ?? '');
	if (!key) return;
	if (!deps.storage) throw new Error('storage.delete needs storage');
	const [row] = await deps.db
		.select({ id: media.id, deletedAt: media.deletedAt, usage: usageSql })
		.from(media)
		.where(eq(media.storageKey, key));
	if (row && (!row.deletedAt || row.usage > 0)) return; // restored or in use again: keep the object
	await deps.storage.delete(key);
	if (row) await deps.db.delete(media).where(eq(media.id, row.id));
}

export interface DailyResult {
	sessions: 'purged';
	carts: 'purged';
	rateLimits: number;
	magicLinks: number;
	jobs: number;
}

/** Daily cleanup: expired sessions, abandoned guest carts, stale rate limits, old tokens, finished jobs. */
export async function dailyMaintenance(db: Executor, now = new Date()): Promise<DailyResult> {
	await purgeExpiredSessions(db, now);
	await purgeOldCarts(db, 60);
	const rl = await db.delete(rateLimits).where(lt(rateLimits.resetAt, now)).returning({ k: rateLimits.key });
	const ml = await db
		.delete(magicLinks)
		.where(or(lt(magicLinks.expiresAt, new Date(now.getTime() - 86400_000)), and(isNotNull(magicLinks.usedAt), lt(magicLinks.usedAt, new Date(now.getTime() - 86400_000)))))
		.returning({ t: magicLinks.tokenHash });
	const jb = await db
		.delete(jobs)
		.where(and(sql`${jobs.status} in ('done')`, lt(jobs.createdAt, new Date(now.getTime() - 30 * 86400_000))))
		.returning({ id: jobs.id });
	return { sessions: 'purged', carts: 'purged', rateLimits: rl.length, magicLinks: ml.length, jobs: jb.length };
}

/** Tables included in the nightly logical export (business data; sessions/rate limits/jobs excluded). */
export const EXPORT_TABLES = [
	'categories', 'products', 'variants', 'product_images', 'media', 'price_history', 'collections', 'collection_products', 'product_relations',
	'customers', 'addresses', 'orders', 'order_lines', 'order_events', 'payments', 'refunds', 'shipments', 'discounts', 'discount_redemptions',
	'stock_movements', 'pages', 'page_blocks', 'menus', 'faqs', 'redirects', 'newsletter_subscribers', 'settings', 'shipping_zones', 'shipping_rates',
	'admin_users', 'audit_log'
] as const;
const SECRET_COLUMNS: Record<string, string[]> = { customers: ['password_hash'], admin_users: ['password_hash', 'totp_secret', 'recovery_codes', 'invite_token_hash'] };

/**
 * Nightly logical export (P5-04) → `exports/YYYY-MM-DD/<table>.json` in private storage. Complements
 * Neon point-in-time recovery; secrets (password hashes, TOTP secrets) are never exported.
 */
export async function dailyExport(db: Executor, storage: Storage, now = new Date()) {
	const day = now.toISOString().slice(0, 10);
	const summary: Record<string, number> = {};
	for (const table of EXPORT_TABLES) {
		const { rows } = await db.execute<Record<string, unknown>>(sql.raw(`select * from "${table}"`));
		const drop = SECRET_COLUMNS[table] ?? [];
		const clean = drop.length ? rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k)))) : rows;
		await storage.put(`exports/${day}/${table}.json`, JSON.stringify(clean), 'application/json');
		summary[table] = rows.length;
	}
	await storage.put(`exports/${day}/_manifest.json`, JSON.stringify({ createdAt: now.toISOString(), tables: summary }), 'application/json');
	return summary;
}
