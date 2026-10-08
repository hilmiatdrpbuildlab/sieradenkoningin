/**
 * PUT /admin/api/uploads/put?key=&exp=&sig= — upload target of the MOCK storage adapter (dev, tests,
 * previews). Stands in for an S3 presigned PUT: the HMAC signature binds method + key + expiry.
 */
import { error } from '@sveltejs/kit';
import * as env from '$app/env/private';
import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { isSafeKey, verifyMockSignature } from '#lib/server/adapters/storage.ts';
import { MAX_UPLOAD_MB, RASTER_TYPES } from '#lib/schemas/product.ts';
import { imageInfo } from '#lib/server/services/media.ts';

export const PUT: RequestHandler = async ({ locals, request, url }) => {
	requirePermission(locals, 'catalog:write');
	if (locals.storage.kind !== 'mock') error(404, 'Niet gevonden');
	const key = url.searchParams.get('key') ?? '';
	const exp = Number(url.searchParams.get('exp'));
	const sig = url.searchParams.get('sig') ?? '';
	if (!isSafeKey(key) || !Number.isFinite(exp) || !(await verifyMockSignature(env.SESSION_SECRET, 'PUT', key, exp, sig)))
		error(403, 'Ongeldige of verlopen upload-URL');

	const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim();
	if (!(RASTER_TYPES as readonly string[]).includes(contentType)) error(415, 'Alleen JPG, PNG, WebP of AVIF');
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_UPLOAD_MB * 1024 * 1024) error(413, `Maximaal ${MAX_UPLOAD_MB} MB`);
	const body = new Uint8Array(await request.arrayBuffer());
	if (body.byteLength > MAX_UPLOAD_MB * 1024 * 1024) error(413, `Maximaal ${MAX_UPLOAD_MB} MB`);
	const info = imageInfo(body);
	if (!info || info.mime !== contentType) error(415, 'Bestand komt niet overeen met het opgegeven type');

	await locals.storage.put(key, body, contentType);
	return new Response(null, { status: 200 });
};
