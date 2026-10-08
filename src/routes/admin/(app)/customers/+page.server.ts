import type { PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { listCustomers, type CustomerSort } from '#lib/server/services/customers.ts';

const SORTS: CustomerSort[] = ['created', 'name', 'spent', 'orders'];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'customers:read');
	const sortParam = url.searchParams.get('sort') as CustomerSort | null;
	const r = await listCustomers(locals.db, {
		q: url.searchParams.get('q')?.trim() || undefined,
		newsletter: url.searchParams.get('newsletter') === '1',
		sort: sortParam && SORTS.includes(sortParam) ? sortParam : 'created',
		dir: url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc',
		page: Math.max(1, Number(url.searchParams.get('page')) || 1)
	});
	return { ...r, q: url.searchParams.get('q') ?? '', newsletter: url.searchParams.get('newsletter') === '1', crumbs: [{ label: 'Klanten' }] };
};
