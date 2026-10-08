import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { adjustStock, INVENTORY_SORTS, listInventory, recentMovements, StockError, type InventorySort } from '#lib/server/services/inventory.ts';
import { categoryOptions } from '#lib/server/services/products-admin.ts';
import { stockAdjustSchema } from '#lib/schemas/inventory.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { img } from '#lib/utils/media.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const admin = requirePermission(locals, 'inventory:read');
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const low = url.searchParams.get('low') === '1';
	const out = url.searchParams.get('out') === '1';
	const categories = await categoryOptions(locals.db);
	const categoryParam = url.searchParams.get('category') ?? '';
	const category = categories.some((c) => c.value === categoryParam) ? categoryParam : '';
	const sortParam = url.searchParams.get('sort') ?? '';
	const sort = (INVENTORY_SORTS as readonly string[]).includes(sortParam) ? (sortParam as InventorySort) : undefined;
	const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const [result, movements] = await Promise.all([
		listInventory(locals.db, { q, low, out, category, sort, dir, page }),
		recentMovements(locals.db, 12)
	]);
	return {
		crumbs: [{ label: 'Catalogus' }, { label: 'Voorraad' }],
		rows: result.rows.map((r) => ({ ...r, image: r.image ? img(r.image, 120) : null })),
		total: result.total,
		pageSize: result.pageSize,
		filters: { q, low, out, category },
		sort: { key: sort ?? '', dir },
		categories,
		movements,
		canWrite: can(admin.role, 'inventory:write')
	};
};

export const actions: Actions = {
	adjust: async ({ locals, request }) => {
		requirePermission(locals, 'inventory:write');
		const raw = Object.fromEntries(await request.formData());
		const variantId = typeof raw.variantId === 'string' ? raw.variantId : null;
		const parsed = stockAdjustSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { variantId, errors: fieldErrors(parsed.error), values: raw as Record<string, string> });
		try {
			const stock = await locals.db.transaction((tx) => adjustStock(tx, locals, parsed.data));
			return { ok: true, variantId, stock, message: `Voorraad aangepast (${parsed.data.delta > 0 ? '+' : ''}${parsed.data.delta}) → ${stock}` };
		} catch (e) {
			if (e instanceof StockError) return fail(400, { variantId, errors: { delta: [e.message] }, values: raw as Record<string, string> });
			throw e;
		}
	}
};
