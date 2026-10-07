/**
 * Serves objects from the MOCK storage adapter (dev / previews without a media CDN).
 * - /media/<key>                          → public media (immutable cache)
 * - /media/private?key=…&exp=…&sig=…      → short-lived signed download (invoices, labels)
 * With real S3/R2 storage this route 404s: media is served from PUBLIC_MEDIA_URL instead.
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as env from '$app/env/private';
import { isSafeKey, verifyMockSignature } from '#lib/server/adapters/storage.ts';

const PRIVATE_PREFIXES = ['invoices/', 'labels/', 'exports/'];

export const GET: RequestHandler = async ({ params, locals, url }) => {
	if (locals.storage.kind !== 'mock') error(404);
	let key = params.key;
	let cache = 'public, max-age=31536000, immutable';
	if (key === 'private') {
		key = url.searchParams.get('key') ?? '';
		const exp = Number(url.searchParams.get('exp'));
		if (!(await verifyMockSignature(env.SESSION_SECRET, 'GET', key, exp, url.searchParams.get('sig') ?? ''))) error(403);
		cache = 'private, no-store';
	} else if (PRIVATE_PREFIXES.some((p) => key.startsWith(p))) {
		error(404);
	}
	if (!isSafeKey(key)) error(400);
	const obj = await locals.storage.get(key);
	if (!obj) error(404);
	return new Response(new Blob([new Uint8Array(obj.body)]), {
		headers: { 'content-type': obj.contentType, 'cache-control': cache, 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" }
	});
};
