import type { PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { listPagesAdmin } from '#lib/server/services/content.ts';
import { can } from '#lib/permissions.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requirePermission(locals, 'content:read');
	const pages = await listPagesAdmin(locals.db);
	return {
		pages: pages.map((p) => ({
			id: p.id,
			key: p.key,
			type: p.type,
			title: p.title,
			slugs: p.slugs,
			status: p.status,
			publishAt: p.publishAt?.toISOString() ?? null,
			updatedAt: p.updatedAt.toISOString(),
			blockCount: p.blockCount,
			missingFr: p.missingFr
		})),
		canWrite: can(admin.role, 'content:write'),
		crumbs: [{ label: 'Content', href: '/admin/content' }, { label: "Pagina's" }]
	};
};
