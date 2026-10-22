/**
 * Uptime check (P5-04). No secrets, no PII.
 *   GET /api/health       → 200 without touching the database — safe for a frequent uptime monitor.
 *   GET /api/health?db=1  → also pings the database: 200 `db: 'up'`, 503 when unreachable.
 * The DB ping is opt-in because every query wakes the Neon compute (it suspends after 5 idle minutes);
 * a monitor pinging it every minute would keep the database running 24/7.
 */
import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { version } from '$app/env';

export const GET: RequestHandler = async ({ locals, url }) => {
	const headers = { 'cache-control': 'no-store' };
	if (!url.searchParams.has('db')) return json({ ok: true, version, time: new Date().toISOString() }, { headers });
	const started = Date.now();
	try {
		await locals.db.execute(sql`select 1`);
		return json(
			{ ok: true, db: 'up', dbMs: Date.now() - started, version, time: new Date().toISOString() },
			{ headers }
		);
	} catch {
		return json({ ok: false, db: 'down', version, time: new Date().toISOString() }, { status: 503, headers });
	}
};
