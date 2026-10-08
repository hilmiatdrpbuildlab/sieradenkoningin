import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { deleteMedia, listMedia, MediaError, registerUploads, storeFormFile, updateMediaAlt, type NewMedia } from '#lib/server/services/media.ts';
import { formToObject } from '#lib/schemas/product.ts';
import { img } from '#lib/utils/media.ts';

const PAGE_SIZE = 48;

export const load: PageServerLoad = async ({ locals, url }) => {
	const admin = requirePermission(locals, 'catalog:read');
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const unused = url.searchParams.get('unused') === '1';
	const sortParam = url.searchParams.get('sort');
	const sort = sortParam === 'old' || sortParam === 'usage' ? sortParam : 'new';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const result = await listMedia(locals.db, { q, unused, sort, page, pageSize: PAGE_SIZE });
	return {
		crumbs: [{ label: 'Catalogus' }, { label: 'Media' }],
		items: result.rows.map((m) => ({ ...m, url: img(m.key, 400), name: m.key.split('/').pop()! })),
		total: result.total,
		page,
		pages: Math.max(1, Math.ceil(result.total / PAGE_SIZE)),
		filters: { q, unused, sort },
		canWrite: can(admin.role, 'catalog:write')
	};
};

const altSchema = z.object({
	id: z.uuid(),
	nl: z.string().trim().max(250, 'Maximaal 250 tekens'),
	fr: z.string().trim().max(250, 'Maximaal 250 tekens').optional()
});

export const actions: Actions = {
	alt: async ({ locals, request }) => {
		requirePermission(locals, 'catalog:write');
		const parsed = altSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { action: 'alt', id: null, message: parsed.error.issues[0].message });
		const { id, nl, fr } = parsed.data;
		if (!nl) return fail(400, { action: 'alt', id, message: 'Alt-tekst (NL) is verplicht' });
		try {
			await updateMediaAlt(locals.db, locals, id, fr ? { nl, fr } : { nl });
		} catch (e) {
			if (e instanceof MediaError) return fail(400, { action: 'alt', id, message: e.message });
			throw e;
		}
		return { ok: true, action: 'alt', id, message: 'Alt-tekst opgeslagen' };
	},

	delete: async ({ locals, request }) => {
		requirePermission(locals, 'catalog:write');
		const id = String((await request.formData()).get('id') ?? '');
		if (!z.uuid().safeParse(id).success) return fail(400, { action: 'delete', id: null, message: 'Onbekende afbeelding' });
		try {
			await locals.db.transaction((tx) => deleteMedia(tx, locals, id));
		} catch (e) {
			if (e instanceof MediaError) return fail(400, { action: 'delete', id, message: e.message });
			throw e;
		}
		return { ok: true, action: 'delete', id, message: 'Afbeelding verwijderd. Het bestand wordt op de achtergrond opgeruimd.' };
	},

	upload: async ({ locals, request }) => {
		requirePermission(locals, 'catalog:write');
		const fd = await request.formData();
		const raw = formToObject(fd) as { images?: { key?: string; width?: string; height?: string; bytes?: string }[] };
		const items: NewMedia[] = (raw.images ?? [])
			.filter((i) => i.key)
			.map((i) => ({ key: i.key!, width: Number(i.width) || null, height: Number(i.height) || null, bytes: Number(i.bytes) || null }));
		const errors: string[] = [];
		for (const file of fd.getAll('newImages')) {
			if (!(file instanceof File) || file.size === 0) continue;
			const stored = await storeFormFile(locals.storage, file, 'media');
			if ('error' in stored) errors.push(stored.error!);
			else items.push({ key: stored.key, width: stored.width, height: stored.height, bytes: stored.bytes });
		}
		if (!items.length && !errors.length) return fail(400, { action: 'upload', id: null, message: 'Kies eerst een of meer foto’s' });
		try {
			if (items.length) await locals.db.transaction((tx) => registerUploads(tx, locals, items));
		} catch (e) {
			if (e instanceof MediaError) return fail(400, { action: 'upload', id: null, message: e.message });
			throw e;
		}
		if (errors.length) return fail(400, { action: 'upload', id: null, message: errors.join(' · ') });
		return { ok: true, action: 'upload', id: null, message: `${items.length} foto${items.length === 1 ? '' : '’s'} toegevoegd. Vul de alt-tekst in.` };
	}
};
