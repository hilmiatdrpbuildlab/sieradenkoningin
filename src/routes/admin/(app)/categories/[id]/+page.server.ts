import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { categories } from '#lib/server/db/schema.ts';
import { saveCategory } from '#lib/server/services/collections.ts';
import { ValidationError } from '#lib/server/services/products-admin.ts';
import { categorySchema, toEntityModel } from '#lib/schemas/collection.ts';
import { formToObject } from '#lib/schemas/product.ts';
import { fieldErrors } from '#lib/schemas/common.ts';

const uuid = (id: string) => {
	if (!z.uuid().safeParse(id).success) error(404, 'Categorie niet gevonden');
	return id;
};

export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = requirePermission(locals, 'catalog:read');
	const [c] = await locals.db.select().from(categories).where(eq(categories.id, uuid(params.id)));
	if (!c) error(404, 'Categorie niet gevonden');
	return {
		crumbs: [{ label: 'Categorieën', href: '/admin/categories' }, { label: c.name.nl }],
		category: { id: c.id, key: c.key, icon: c.icon, position: c.position, updatedAt: c.updatedAt },
		model: toEntityModel(c as unknown as Record<string, unknown>),
		canWrite: can(admin.role, 'catalog:write')
	};
};

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		requirePermission(locals, 'catalog:write');
		const id = uuid(params.id);
		const raw = formToObject(await request.formData()) as Record<string, unknown>;
		const values = toEntityModel(raw);
		const parsed = categorySchema.safeParse(raw);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });
		try {
			await locals.db.transaction((tx) => saveCategory(tx, locals, id, parsed.data));
		} catch (e) {
			if (e instanceof ValidationError) return fail(400, { errors: e.errors, values });
			throw e;
		}
		redirect(303, `/admin/categories/${id}?saved=1`);
	}
};
