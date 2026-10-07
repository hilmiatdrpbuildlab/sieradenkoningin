import { error } from '@sveltejs/kit';
import { and, inArray, lte, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { orders, variants } from '#lib/server/db/schema.ts';
import { navForRole } from '#lib/admin-nav.ts';
import { can, ROLE_LABELS } from '#lib/permissions.ts';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const admin = locals.admin;
	if (!admin) error(401, 'Niet aangemeld');
	const db = locals.db;
	const [toProcess] = can(admin.role, 'orders:read')
		? await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(inArray(orders.status, ['paid']))
		: [{ n: 0 }];
	const [low] = can(admin.role, 'inventory:read')
		? await db.select({ n: sql<number>`count(*)::int` }).from(variants).where(and(lte(variants.stock, variants.lowStockThreshold)))
		: [{ n: 0 }];
	return {
		admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, roleLabel: ROLE_LABELS[admin.role] },
		nav: navForRole(admin.role, { ordersToProcess: toProcess.n, lowStock: low.n }),
		sidebarCollapsed: cookies.get('sk_sidebar') === '1'
	};
};

