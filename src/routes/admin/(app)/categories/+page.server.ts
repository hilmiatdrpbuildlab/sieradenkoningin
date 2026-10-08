import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { listCategories, moveCategory } from '#lib/server/services/collections.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requirePermission(locals, 'catalog:read');
	return {
		crumbs: [{ label: 'Catalogus' }, { label: 'Categorieën' }],
		categories: await listCategories(locals.db),
		canWrite: can(admin.role, 'catalog:write')
	};
};

const moveSchema = z.object({ id: z.uuid(), dir: z.enum(['up', 'down']) });

export const actions: Actions = {
	move: async ({ locals, request }) => {
		requirePermission(locals, 'catalog:write');
		const parsed = moveSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { message: 'Ongeldige actie' });
		await locals.db.transaction((tx) => moveCategory(tx, locals, parsed.data.id, parsed.data.dir));
		return { moved: parsed.data.id };
	}
};
