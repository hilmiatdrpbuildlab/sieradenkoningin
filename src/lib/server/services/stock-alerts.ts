/**
 * Back-in-stock alerts (P3-09).
 *
 *  subscribe   → upsert `stock_alerts (email, variant)` (re-arms a previously sent alert)
 *  restock     → `notifyRestock(db, variantIds)` from inventory code, and/or `scanRestocked(db)` from
 *                the cron: both enqueue a `stock.alert` job; the scan finds every pending alert whose
 *                variant has stock > 0, so alerts go out no matter which code path restocked.
 *  job         → `sendRestockAlerts`: each alert is CLAIMED with one atomic
 *                UPDATE … SET notified_at = now() WHERE notified_at IS NULL before sending, so
 *                concurrent / repeated jobs never send the same alert twice (unit-tested). A failed
 *                send releases the claim and the job retries.
 */
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { jobs, products, stockAlerts, variants } from '../db/schema.ts';
import type { EmailAdapter } from '../adapters/email.ts';
import { getSettings } from './settings.ts';
import { sendEmail } from './email.ts';
import { variantLabel } from './cart.ts';
import { tr } from '../../i18n/index.ts';
import { localizeHref, type Lang } from '../../i18n/paths.ts';

export const STOCK_ALERT_JOB = 'stock.alert';
export const STOCK_ALERT_LIMIT = { max: 10, windowSec: 3600 } as const;

export type SubscribeResult = 'ok' | 'in_stock' | 'not_found';

export async function subscribeStockAlert(
	db: Executor,
	input: { email: string; variantId: string; locale: Lang }
): Promise<SubscribeResult> {
	const [v] = await db
		.select({ id: variants.id, stock: variants.stock })
		.from(variants)
		.innerJoin(products, eq(products.id, variants.productId))
		.where(and(eq(variants.id, input.variantId), eq(products.status, 'active')));
	if (!v) return 'not_found';
	if (v.stock > 0) return 'in_stock';
	await db
		.insert(stockAlerts)
		.values({ email: input.email.trim().toLowerCase(), variantId: v.id, locale: input.locale })
		.onConflictDoUpdate({
			target: [stockAlerts.email, stockAlerts.variantId],
			set: { locale: input.locale, notifiedAt: null }
		});
	return 'ok';
}

/** Inserts a `stock.alert` job (direct insert: no import cycle with jobs/index.ts). */
async function enqueueAlertJob(db: Executor, variantIds: string[]) {
	const [row] = await db
		.insert(jobs)
		.values({ type: STOCK_ALERT_JOB, payload: { variantIds } })
		.returning({ id: jobs.id });
	return row?.id ?? null;
}

/** Variant ids (optionally restricted) that have stock > 0 AND at least one unsent alert. */
async function restockedWithPendingAlerts(db: Executor, variantIds?: string[]) {
	const rows = await db
		.selectDistinct({ id: stockAlerts.variantId })
		.from(stockAlerts)
		.innerJoin(variants, eq(variants.id, stockAlerts.variantId))
		.where(
			and(
				isNull(stockAlerts.notifiedAt),
				gt(variants.stock, 0),
				variantIds ? inArray(stockAlerts.variantId, variantIds) : undefined
			)
		);
	return rows.map((r) => r.id);
}

/**
 * Call after stock went up (admin adjust, import, return/refund restock). Cheap no-op when no alert
 * is pending for these variants. Returns the job id (run it inline with `runJobs({ ids })` if wanted).
 */
export async function notifyRestock(db: Executor, variantIds: string[]) {
	const ids = [...new Set(variantIds)].filter(Boolean);
	if (!ids.length) return null;
	const due = await restockedWithPendingAlerts(db, ids);
	return due.length ? enqueueAlertJob(db, due) : null;
}

/** Cron-safe safety net: enqueues one job for every restocked variant with pending alerts. */
export async function scanRestocked(db: Executor) {
	const due = await restockedWithPendingAlerts(db);
	if (!due.length) return { variants: 0, jobId: null };
	return { variants: due.length, jobId: await enqueueAlertJob(db, due) };
}

export type { BackInStockEmailData } from '../../components/email/account-types.ts';

export interface AlertDeps {
	db: Executor;
	email: EmailAdapter;
	siteUrl: string;
}

/** Sends every due alert (optionally for `variantIds` only). Throws after the loop when a send failed. */
export async function sendRestockAlerts(deps: AlertDeps, variantIds?: string[]) {
	const { db } = deps;
	const due = await db
		.select({
			id: stockAlerts.id,
			email: stockAlerts.email,
			locale: stockAlerts.locale,
			variantId: variants.id,
			metal: variants.metal,
			size: variants.size,
			slug: products.slug,
			name: products.name
		})
		.from(stockAlerts)
		.innerJoin(variants, eq(variants.id, stockAlerts.variantId))
		.innerJoin(products, eq(products.id, variants.productId))
		.where(
			and(
				isNull(stockAlerts.notifiedAt),
				gt(variants.stock, 0),
				eq(products.status, 'active'),
				variantIds?.length ? inArray(stockAlerts.variantId, variantIds) : undefined
			)
		)
		.limit(500);
	if (!due.length) return { sent: 0, failed: 0 };

	const { store } = await getSettings(db, ['store']);
	const site = deps.siteUrl.replace(/\/$/, '');
	let sent = 0;
	let failed = 0;
	for (const a of due) {
		// Claim first: only one runner can flip notified_at from NULL.
		const claimed = await db
			.update(stockAlerts)
			.set({ notifiedAt: sql`now()` })
			.where(and(eq(stockAlerts.id, a.id), isNull(stockAlerts.notifiedAt)))
			.returning({ id: stockAlerts.id });
		if (!claimed.length) continue;
		const locale: Lang = a.locale === 'fr' ? 'fr' : 'nl';
		try {
			await sendEmail(deps, {
				to: a.email,
				template: 'back_in_stock',
				locale,
				data: {
					productName: tr(a.name, locale),
					variantLabel: variantLabel(a.metal, a.size, locale),
					productUrl: `${site}${localizeHref(`/p/${a.slug}`, locale)}?variant=${a.variantId}`,
					shopUrl: `${site}/${locale}`,
					storeName: store.name || 'Sieradenkoningin',
					storeEmail: store.email || null
				},
				refId: a.id
			});
			sent++;
		} catch (err) {
			failed++;
			console.error('[stock-alerts] send failed', err);
			await db.update(stockAlerts).set({ notifiedAt: null }).where(eq(stockAlerts.id, a.id));
		}
	}
	if (failed) throw new Error(`stock.alert: ${failed} alert(s) failed, will retry`);
	return { sent, failed };
}

/** Job handler for `stock.alert` — payload `{ variantIds?: string[] }` (empty = scan everything). */
export async function stockAlertJob(job: { payload: Record<string, unknown> }, deps: AlertDeps) {
	const ids = Array.isArray(job.payload.variantIds) ? (job.payload.variantIds as string[]) : undefined;
	await sendRestockAlerts(deps, ids);
}
