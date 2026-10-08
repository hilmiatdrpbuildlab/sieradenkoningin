import type { PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { byCategory, byDay, discountPerformance, summary, topProducts, vatByMonth } from '#lib/server/services/reports.ts';
import { parseRange } from '#lib/server/services/report-range.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'reports');
	const { range, from, to } = parseRange(url);
	const db = locals.db;
	const [sum, days, cats, top, vat, codes] = await Promise.all([
		summary(db, range),
		byDay(db, range),
		byCategory(db, range),
		topProducts(db, range, 15),
		vatByMonth(db, range),
		discountPerformance(db, range)
	]);
	return {
		from,
		to,
		summary: sum,
		days,
		categories: cats.map((c) => ({ label: c.name?.nl ?? 'Zonder categorie', units: c.units, revenue: c.revenue })),
		top: top.map((t) => ({ label: t.name?.nl ?? '—', units: t.units, revenue: t.revenue })),
		vat,
		codes,
		crumbs: [{ label: 'Rapporten' }]
	};
};
