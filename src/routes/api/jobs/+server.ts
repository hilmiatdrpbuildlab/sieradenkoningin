/**
 * Cron endpoint (hourly — see wrangler.jsonc for why not more often; Cloudflare Cron Trigger → POST with `Authorization: Bearer $CRON_SECRET`):
 *  1. release expired stock reservations (P2-05)
 *  2. reconcile / expire stale pending orders
 *  3. find restocked variants with pending back-in-stock alerts (P3-09)
 *  4. process queued jobs (emails, invoices, alerts, media deletion …)
 * The daily trigger (`0 5 * * *`, sent as ?cron=… by cloudflare/worker.js) also runs housekeeping.
 * Without a configured CRON_SECRET the endpoint is closed.
 */
import { error, json } from '@sveltejs/kit';
import * as env from '$app/env/private';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { RequestHandler } from './$types';
import { safeEqual } from '#lib/server/crypto.ts';
import { releaseExpiredReservations } from '#lib/server/services/inventory-reservations.ts';
import { expireStaleOrders } from '#lib/server/services/orders.ts';
import { runJobs } from '#lib/server/jobs/index.ts';
import { scanRestocked } from '#lib/server/services/stock-alerts.ts';
import { dailyExport, dailyMaintenance } from '#lib/server/services/maintenance.ts';
import { sendDailyReport } from '#lib/server/services/daily-report.ts';
import { getSetting } from '#lib/server/services/settings.ts';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	if (!env.CRON_SECRET || !safeEqual(auth, `Bearer ${env.CRON_SECRET}`)) error(401, 'Unauthorized');
	const released = await releaseExpiredReservations(locals.db);
	const orders = await expireStaleOrders({ db: locals.db, payments: locals.payments });
	const restocked = await scanRestocked(locals.db);
	const isDaily = (url.searchParams.get('cron') ?? request.headers.get('x-cron')) === '0 5 * * *';
	const daily = isDaily
		? {
				cleanup: await dailyMaintenance(locals.db),
				export: await dailyExport(locals.db, locals.storage).catch((e: Error) => ({ error: e.message })),
				report: await sendDailyReport({
					db: locals.db,
					email: locals.email,
					to: (await getSetting(locals.db, 'store')).email || env.SHOP_INBOX,
					siteUrl: PUBLIC_SITE_URL
				}).catch((e: Error) => ({ error: e.message }))
			}
		: null;
	const jobs = await runJobs({
		db: locals.db,
		email: locals.email,
		siteUrl: PUBLIC_SITE_URL,
		payments: locals.payments,
		storage: locals.storage
	});
	return json({ released, orders, restocked, daily, jobs }, { headers: { 'cache-control': 'no-store' } });
};
