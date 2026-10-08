/**
 * POST /admin/api/uploads — step 1 of a direct-to-storage upload (DESIGN_SYSTEM §4.5).
 * Validates type + size, returns a presigned PUT url (5 min) and the immutable object key.
 * Nothing is written to the database here: the `media` row is created when a form that references
 * the key is saved (product form, media library).
 */
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { mediaKey } from '#lib/server/adapters/storage.ts';
import { MAX_UPLOAD_MB, RASTER_TYPES } from '#lib/schemas/product.ts';

const bodySchema = z.object({
	filename: z.string().max(255).optional(),
	contentType: z.enum(RASTER_TYPES, { error: 'Alleen JPG, PNG, WebP of AVIF' }),
	size: z
		.number()
		.int()
		.positive()
		.max(MAX_UPLOAD_MB * 1024 * 1024, `Maximaal ${MAX_UPLOAD_MB} MB`),
	folder: z.enum(['products', 'media']).optional()
});

export const POST: RequestHandler = async ({ locals, request }) => {
	requirePermission(locals, 'catalog:write');
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Ongeldige upload');
	const { contentType, folder = 'products' } = parsed.data;
	const key = mediaKey(contentType, folder);
	const uploadUrl = await locals.storage.presignPut(key, contentType, 300);
	return json({ key, uploadUrl, publicUrl: locals.storage.publicUrl(key) }, { headers: { 'cache-control': 'no-store' } });
};
