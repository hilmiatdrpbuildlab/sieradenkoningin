/**
 * Same-origin relay for browser errors (hooks.client.ts → here → Sentry). Keeps the DSN server-side
 * and needs no extra CSP host. Rate-limited per IP; payload is size-capped and scrubbed.
 */
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import * as env from '$app/env/private';
import { version } from '$app/env';
import type { RequestHandler } from './$types';
import { reportError } from '#lib/server/monitoring.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';

const Body = z.object({
	message: z.string().max(1000),
	stack: z.string().max(5000).optional(),
	path: z.string().max(300)
});

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!env.SENTRY_DSN) return json({ ok: true });
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ ok: false }, { status: 400 });
	const limit = await rateLimit(locals.db, `client-error:${locals.ip}`, 20, 3600);
	if (!limit.allowed) return json({ ok: false }, { status: 429 });
	const task = reportError(
		env.SENTRY_DSN,
		{ ...parsed.data, source: 'client', userAgent: request.headers.get('user-agent') },
		version
	);
	if (platform?.ctx) platform.ctx.waitUntil(task);
	else await task;
	return json({ ok: true });
};
