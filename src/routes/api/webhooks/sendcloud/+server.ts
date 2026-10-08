/**
 * Sendcloud tracking webhook (P3-05). Exempt from the CSRF origin check (/api/webhooks/*), so it
 * verifies itself: HMAC-SHA256 of the RAW body with the secret key, header `Sendcloud-Signature`.
 * Updates are idempotent and monotonic (fulfilment.applyTrackingUpdate): shipment → shipped /
 * delivered, the order follows, and the "shipped" email is queued once and sent right away.
 * Unknown parcels and irrelevant events get a 200 so Sendcloud does not retry them forever.
 */
import { error, json } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { RequestHandler } from './$types';
import { applyTrackingUpdate } from '#lib/server/services/fulfilment.ts';
import { runJobs } from '#lib/server/jobs/index.ts';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const raw = await request.text();
	if (raw.length > 100_000) error(413, 'Payload too large');
	if (!(await locals.shipping.verifyWebhook(raw, request.headers.get('sendcloud-signature'))))
		error(401, 'Invalid signature');
	let body: unknown;
	try {
		body = JSON.parse(raw);
	} catch {
		error(400, 'Invalid JSON');
	}
	const update = locals.shipping.parseWebhook(body);
	if (!update) return json({ ok: true, ignored: true });
	try {
		const r = await applyTrackingUpdate(locals.db, update);
		if (r.jobIds.length) {
			await runJobs(
				{
					db: locals.db,
					email: locals.email,
					siteUrl: PUBLIC_SITE_URL || url.origin,
					payments: locals.payments,
					storage: locals.storage
				},
				{ ids: r.jobIds }
			).catch((err) => console.error('[webhook sendcloud] jobs', err));
		}
		return json({ ok: true, outcome: r.outcome });
	} catch (err) {
		console.error('[webhook sendcloud]', err);
		return json({ ok: false }, { status: 500 });
	}
};
