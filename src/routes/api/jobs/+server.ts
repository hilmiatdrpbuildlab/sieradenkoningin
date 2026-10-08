/**
 * Cron endpoint (every 5 min, Cloudflare Cron Trigger → POST with `Authorization: Bearer $CRON_SECRET`):
 *  1. release expired stock reservations (P2-05)
 *  2. reconcile / expire stale pending orders
 *  3. process queued jobs (emails, …)
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

export const POST: RequestHandler = async ({ request, locals }) => {
	const auth = request.headers.get('authorization') ?? '';
	if (!env.CRON_SECRET || !safeEqual(auth, `Bearer ${env.CRON_SECRET}`)) error(401, 'Unauthorized');
	const released = await releaseExpiredReservations(locals.db);
	const orders = await expireStaleOrders({ db: locals.db, payments: locals.payments });
	const jobs = await runJobs({
		db: locals.db,
		email: locals.email,
		siteUrl: PUBLIC_SITE_URL,
		payments: locals.payments,
		storage: locals.storage
	});
	return json({ released, orders, jobs }, { headers: { 'cache-control': 'no-store' } });
};
