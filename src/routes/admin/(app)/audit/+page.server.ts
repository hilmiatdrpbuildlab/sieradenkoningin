import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { auditLog } from '#lib/server/db/schema.ts';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'audit');
	const q = url.searchParams.get('q')?.trim() ?? '';
	const entity = url.searchParams.get('entity') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const where: SQL[] = [];
	if (entity) where.push(eq(auditLog.entity, entity));
	if (q) where.push(or(ilike(auditLog.actorName, `%${q}%`), ilike(auditLog.action, `%${q}%`), ilike(auditLog.entityId, `%${q}%`))!);
	if (from) where.push(gte(auditLog.createdAt, new Date(`${from}T00:00:00`)));
	if (to) where.push(lte(auditLog.createdAt, new Date(`${to}T23:59:59`)));
	const cond = where.length ? and(...where) : undefined;

	const [rows, [{ total }], entities] = await Promise.all([
		locals.db.select().from(auditLog).where(cond).orderBy(desc(auditLog.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
		locals.db.select({ total: count() }).from(auditLog).where(cond),
		locals.db.selectDistinct({ entity: auditLog.entity }).from(auditLog).orderBy(auditLog.entity)
	]);
	return {
		rows: rows.map((r) => ({ ...r, id: r.id, diff: r.diff ? JSON.stringify(r.diff) : '' })),
		total,
		pageSize: PAGE_SIZE,
		entities: entities.map((e) => e.entity),
		filters: { q, entity, from, to },
		crumbs: [{ label: 'Auditlog' }]
	};
};
