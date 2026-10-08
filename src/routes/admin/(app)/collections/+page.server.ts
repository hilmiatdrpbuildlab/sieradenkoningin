import type { PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { describeRule, listCategories, listCollections } from '#lib/server/services/collections.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requirePermission(locals, 'catalog:read');
	const [rows, cats] = await Promise.all([listCollections(locals.db), listCategories(locals.db)]);
	const catName = (key: string) => cats.find((c) => c.key === key)?.name.nl ?? key;
	return {
		crumbs: [{ label: 'Catalogus' }, { label: 'Collecties' }],
		collections: rows.map((c) => ({
			id: c.id,
			name: c.name.nl,
			slug: c.slugs.nl,
			type: c.type,
			active: c.active,
			summary: c.type === 'rule' ? describeRule(c.rule, catName) : `${c.manualCount} product${c.manualCount === 1 ? '' : 'en'}`,
			updatedAt: c.updatedAt
		})),
		canWrite: can(admin.role, 'catalog:write')
	};
};
