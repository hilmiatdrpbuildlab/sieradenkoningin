import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import {
	categoryOptions,
	duplicateProduct,
	loadProduct,
	modelFromProduct,
	productOptions,
	saveProduct,
	setProductStatus,
	stoneColorOptions,
	ValidationError,
	withImageUrls,
	type ExtraImage
} from '#lib/server/services/products-admin.ts';
import { storeFormFile } from '#lib/server/services/media.ts';
import { emptyProductModel, formToObject, normalizeModel, prepareProductForm, productSchema } from '#lib/schemas/product.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { img } from '#lib/utils/media.ts';

const NEW = 'nieuw';
const thumb = (key: string) => img(key, 400);
const small = (key: string) => img(key, 120);

function productId(param: string) {
	if (param === NEW) return null;
	if (!z.uuid().safeParse(param).success) error(404, 'Product niet gevonden');
	return param;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const admin = requirePermission(locals, 'catalog:read');
	const id = productId(params.id);
	const db = locals.db;
	const [categories, products, stoneColors] = await Promise.all([categoryOptions(db), productOptions(db, small, id ?? undefined), stoneColorOptions(db)]);

	if (!id) {
		requirePermission(locals, 'catalog:write');
		const model = emptyProductModel();
		const cat = url.searchParams.get('category');
		if (cat && categories.some((c) => c.value === cat)) model.categoryId = cat;
		return {
			crumbs: [{ label: 'Producten', href: '/admin/products' }, { label: 'Nieuw product' }],
			isNew: true as const,
			product: null,
			model,
			version: 'new',
			categories,
			products,
			stoneColors,
			canWrite: true
		};
	}

	const data = await loadProduct(db, id);
	if (!data) error(404, 'Product niet gevonden');
	const p = data.product;
	return {
		crumbs: [{ label: 'Producten', href: '/admin/products' }, { label: p.name.nl }],
		isNew: false as const,
		product: { id: p.id, name: p.name.nl, slug: p.slug, status: p.status, updatedAt: p.updatedAt, createdAt: p.createdAt },
		model: modelFromProduct(data, thumb),
		version: p.updatedAt.toISOString(),
		categories,
		products,
		stoneColors,
		canWrite: can(admin.role, 'catalog:write')
	};
};

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		requirePermission(locals, 'catalog:write');
		const id = productId(params.id);
		const fd = await request.formData();
		const raw = prepareProductForm(formToObject(fd) as Record<string, unknown>);

		// No-JS photo fallback: files posted with the form are stored first so they survive a failed save.
		const extra: ExtraImage[] = [];
		const uploadErrors: string[] = [];
		for (const file of fd.getAll('newImages')) {
			if (!(file instanceof File) || file.size === 0) continue;
			const stored = await storeFormFile(locals.storage, file);
			if ('error' in stored) uploadErrors.push(stored.error!);
			else extra.push({ key: stored.key, width: stored.width, height: stored.height, bytes: stored.bytes });
		}

		const values = () => {
			const model = withImageUrls(normalizeModel(raw as never), thumb);
			model.images.push(...extra.map((x) => ({ key: x.key, url: thumb(x.key), width: String(x.width), height: String(x.height), bytes: String(x.bytes), alt: { nl: '', fr: '' } })));
			return model;
		};

		const parsed = productSchema.safeParse(raw);
		if (!parsed.success || uploadErrors.length) {
			const errors = parsed.success ? {} : fieldErrors(parsed.error);
			if (uploadErrors.length) errors.images = uploadErrors;
			return fail(400, { errors, values: values() });
		}
		if (extra.length) {
			// New photos need alt text before they can be saved: return them so the editor can fill it in.
			const model = values();
			return fail(400, {
				errors: Object.fromEntries(model.images.map((im, i) => [im.alt.nl ? '' : `images.${i}.alt.nl`, ['Alt-tekst (NL) is verplicht']]).filter(([k]) => k)),
				values: model,
				uploaded: extra.length
			});
		}

		let savedId: string;
		try {
			savedId = await locals.db.transaction((tx) => saveProduct(tx, locals, id, parsed.data));
		} catch (e) {
			if (e instanceof ValidationError) return fail(400, { errors: e.errors, values: values() });
			throw e;
		}
		redirect(303, `/admin/products/${savedId}?saved=${id ? 1 : 'new'}`);
	},

	duplicate: async ({ locals, params }) => {
		requirePermission(locals, 'catalog:write');
		const id = productId(params.id);
		if (!id) error(404, 'Product niet gevonden');
		const newId = await locals.db.transaction((tx) => duplicateProduct(tx, locals, id));
		redirect(303, `/admin/products/${newId}?saved=duplicate`);
	},

	archive: async ({ locals, params }) => {
		requirePermission(locals, 'catalog:write');
		const id = productId(params.id);
		if (!id) error(404, 'Product niet gevonden');
		await locals.db.transaction((tx) => setProductStatus(tx, locals, id, 'archived'));
		redirect(303, `/admin/products/${id}?saved=archived`);
	},

	restore: async ({ locals, params }) => {
		requirePermission(locals, 'catalog:write');
		const id = productId(params.id);
		if (!id) error(404, 'Product niet gevonden');
		await locals.db.transaction((tx) => setProductStatus(tx, locals, id, 'draft'));
		redirect(303, `/admin/products/${id}?saved=restored`);
	}
};
