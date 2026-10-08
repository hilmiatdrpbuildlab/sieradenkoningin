/** Uptime check (P5-04): 200 when the app and database respond, 503 otherwise. No secrets, no PII. */
import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { version } from '$app/env';

export const GET: RequestHandler = async ({ locals }) => {
	const started = Date.now();
	try {
		await locals.db.execute(sql`select 1`);
		return json({ ok: true, db: 'up', dbMs: Date.now() - started, version, time: new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json({ ok: false, db: 'down', version, time: new Date().toISOString() }, { status: 503, headers: { 'cache-control': 'no-store' } });
	}
};
