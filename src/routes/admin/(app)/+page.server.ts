import { redirect } from '@sveltejs/kit';
import { and, asc, eq, lte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { can } from '#lib/permissions.ts';
import { homeForRole } from '#lib/admin-nav.ts';
import { products, variants } from '#lib/server/db/schema.ts';
import { byCategory, byDay, lastDays, previousRange, summary, toProcess, topProducts, delta } from '#lib/server/services/reports.ts';

const PERIODS = { today: 1, '7d': 7, '30d': 30 } as const;
type Period = keyof typeof PERIODS;

export const load: PageServerLoad = async ({ locals, url }) => {
	const admin = locals.admin!;
	if (!can(admin.role, 'dashboard')) redirect(303, homeForRole(admin.role));
	const db = locals.db;
	const period: Period = (url.searchParams.get('period') as Period) in PERIODS ? (url.searchParams.get('period') as Period) : '30d';
	const range = lastDays(PERIODS[period]);
	const prev = previousRange(range);
	const trendRange = lastDays(Math.max(14, PERIODS[period]));

	const [cur, before, days, cats, top, queue, low] = await Promise.all([
		summary(db, range),
		summary(db, prev),
		byDay(db, trendRange),
		byCategory(db, range),
		topProducts(db, range, 5),
		toProcess(db, 8),
		db
			.select({ id: variants.id, sku: variants.sku, stock: variants.stock, threshold: variants.lowStockThreshold, name: products.name, productId: products.id })
			.from(variants)
			.innerJoin(products, eq(products.id, variants.productId))
			.where(and(lte(variants.stock, variants.lowStockThreshold), eq(products.status, 'active')))
			.orderBy(asc(variants.stock))
			.limit(8)
	]);

	return {
		period,
		kpis: {
			revenue: { value: cur.net, delta: delta(cur.net, before.net) },
			orders: { value: cur.orders, delta: delta(cur.orders, before.orders) },
			aov: { value: cur.aov, delta: delta(cur.aov, before.aov) },
			refunded: { value: cur.refunded, delta: delta(cur.refunded, before.refunded) }
		},
		trend: days.map((d) => ({ day: d.day, net: d.net, orders: d.orders })),
		categories: cats.map((c) => ({ label: c.name?.nl ?? 'Zonder categorie', value: c.revenue, units: c.units })),
		top: top.map((t) => ({ label: t.name?.nl ?? '—', value: t.revenue, units: t.units })),
		queue,
		low: low.map((l) => ({ ...l, name: l.name.nl })),
		crumbs: [{ label: 'Dashboard' }]
	};
};
