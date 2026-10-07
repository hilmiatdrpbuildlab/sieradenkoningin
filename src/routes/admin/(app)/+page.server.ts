import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { can } from '#lib/permissions.ts';
import { homeForRole } from '#lib/admin-nav.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = locals.admin!;
	if (!can(admin.role, 'dashboard')) redirect(303, homeForRole(admin.role));
	return { crumbs: [{ label: 'Dashboard' }] };
};
