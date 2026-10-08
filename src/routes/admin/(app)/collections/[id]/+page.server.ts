import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { deleteCollection, listCategories, loadCollection, previewRule, saveCollection } from '#lib/server/services/collections.ts';
import { productOptions, ValidationError } from '#lib/server/services/products-admin.ts';
import { listMedia } from '#lib/server/services/media.ts';
import { collectionSchema, ruleSchema, toCollectionModel } from '#lib/schemas/collection.ts';
import { applyListEdits, formToObject } from '#lib/schemas/product.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import type { CollectionRule } from '#lib/server/db/schema.ts';
import { img } from '#lib/utils/media.ts';

const NEW = 'nieuw';
function collectionId(param: string) {
	if (param === NEW) return null;
	if (!z.uuid().safeParse(param).success) error(404, 'Collectie niet gevonden');
	return param;
}

async function options(db: App.Locals['db']) {
	const [categories, products, media] = await Promise.all([
		listCategories(db),
		productOptions(db, (k) => img(k, 120)),
		listMedia(db, { pageSize: 200 })
	]);
	return {
		categories: categories.map((c) => ({ value: c.key, label: c.name.nl })),
		products,
		media: media.rows.map((m) => ({ id: m.id, label: m.alt.nl || m.key.split('/').pop()!, url: img(m.key, 400) }))
	};
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = requirePermission(locals, 'catalog:read');
	const id = collectionId(params.id);
	const opts = await options(locals.db);
	if (!id) {
		requirePermission(locals, 'catalog:write');
		return {
			crumbs: [{ label: 'Collecties', href: '/admin/collections' }, { label: 'Nieuwe collectie' }],
			isNew: true,
			collection: null,
			model: toCollectionModel({}),
			preview: null,
			...opts,
			canWrite: true
		};
	}
	const data = await loadCollection(locals.db, id);
	if (!data) error(404, 'Collectie niet gevonden');
	const c = data.collection;
	return {
		crumbs: [{ label: 'Collecties', href: '/admin/collections' }, { label: c.name.nl }],
		isNew: false,
		collection: { id: c.id, name: c.name.nl, slug: c.slugs.nl, type: c.type, updatedAt: c.updatedAt },
		model: toCollectionModel({ ...c, products: data.items.map((i) => i.id), active: c.active ? 'on' : 'off' } as unknown as Record<string, unknown>),
		preview: c.type === 'rule' ? await previewRule(locals.db, c.rule ?? {}) : null,
		...opts,
		canWrite: can(admin.role, 'catalog:write')
	};
};

function readForm(fd: FormData) {
	const raw = formToObject(fd) as Record<string, unknown>;
	raw.products = applyListEdits(raw, 'products');
	return raw;
}

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		requirePermission(locals, 'catalog:write');
		const id = collectionId(params.id);
		const raw = readForm(await request.formData());
		const values = toCollectionModel({ ...raw, active: raw.active ?? 'off' });
		const parsed = collectionSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });
		let savedId: string;
		try {
			savedId = await locals.db.transaction((tx) => saveCollection(tx, locals, id, parsed.data));
		} catch (e) {
			if (e instanceof ValidationError) return fail(400, { errors: e.errors, values });
			throw e;
		}
		redirect(303, `/admin/collections/${savedId}?saved=${id ? 1 : 'new'}`);
	},

	/** Shows which products a (not yet saved) rule would select. */
	preview: async ({ locals, request }) => {
		requirePermission(locals, 'catalog:read');
		const raw = readForm(await request.formData());
		const values = toCollectionModel({ ...raw, active: raw.active ?? 'off' });
		const rule = ruleSchema.safeParse(raw.rule);
		if (!rule.success) return fail(400, { errors: Object.fromEntries(Object.entries(fieldErrors(rule.error)).map(([k, v]) => [`rule.${k}`, v])), values });
		return { values, preview: await previewRule(locals.db, rule.data as CollectionRule) };
	},

	delete: async ({ locals, params }) => {
		requirePermission(locals, 'catalog:write');
		const id = collectionId(params.id);
		if (!id) error(404, 'Collectie niet gevonden');
		await locals.db.transaction((tx) => deleteCollection(tx, locals, id));
		redirect(303, '/admin/collections');
	}
};
