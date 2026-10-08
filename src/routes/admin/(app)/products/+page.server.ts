import type { PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { categoryOptions, listProducts, PRODUCT_SORTS, type ProductSort } from '#lib/server/services/products-admin.ts';
import { PRODUCT_STATUSES, type ProductStatus } from '#lib/schemas/product.ts';
import { img } from '#lib/utils/media.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const admin = requirePermission(locals, 'catalog:read');
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const statusParam = url.searchParams.get('status') ?? '';
	const status = (PRODUCT_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as ProductStatus) : '';
	const category = url.searchParams.get('category') ?? '';
	const sortParam = url.searchParams.get('sort') ?? '';
	const sort = (PRODUCT_SORTS as readonly string[]).includes(sortParam) ? (sortParam as ProductSort) : undefined;
	const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const categories = await categoryOptions(locals.db);
	const validCategory = categories.some((c) => c.value === category) ? category : '';
	const result = await listProducts(locals.db, { q, status, category: validCategory, sort, dir, page });

	return {
		crumbs: [{ label: 'Catalogus' }, { label: 'Producten' }],
		rows: result.rows.map((r) => ({ ...r, image: r.image ? img(r.image, 120) : null })),
		total: result.total,
		pageSize: result.pageSize,
		filters: { q, status, category: validCategory },
		sort: { key: sort ?? '', dir },
		categories,
		canWrite: can(admin.role, 'catalog:write')
	};
};
