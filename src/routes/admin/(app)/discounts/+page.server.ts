import { error, fail } from '@sveltejs/kit';
import { desc, eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { discounts, discountRedemptions, orders } from '#lib/server/db/schema.ts';
import { audit, diffObjects } from '#lib/server/services/audit.ts';
import { discountSchema } from '#lib/schemas/discount.ts';
import { fieldErrors } from '#lib/schemas/common.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requirePermission(locals, 'discounts:read');
	const sold = sql`${orders.paymentStatus} in ('paid','partially_refunded','refunded')`;
	const rows = await locals.db
		.select({
			d: discounts,
			uses: sql<number>`count(${orders.id}) filter (where ${sold})::int`,
			discounted: sql<number>`coalesce(sum(${orders.discountTotal}) filter (where ${sold}), 0)::int`,
			revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${sold}), 0)::int`
		})
		.from(discounts)
		.leftJoin(discountRedemptions, eq(discountRedemptions.discountId, discounts.id))
		.leftJoin(orders, eq(orders.id, discountRedemptions.orderId))
		.groupBy(discounts.id)
		.orderBy(desc(discounts.createdAt));
	return {
		discounts: rows.map((r) => ({ ...r.d, uses: r.uses, discounted: r.discounted, revenue: r.revenue })),
		canWrite: admin.role === 'owner' || admin.role === 'editor',
		crumbs: [{ label: 'Kortingscodes' }]
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requirePermission(locals, 'discounts:write');
		const raw = Object.fromEntries(await request.formData());
		const id = String(raw.id ?? '');
		const parsed = discountSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values: raw, id });
		const v = parsed.data;
		const [dupe] = await locals.db.select({ id: discounts.id }).from(discounts).where(eq(discounts.code, v.code));
		if (dupe && dupe.id !== id) return fail(400, { errors: { code: ['Deze code bestaat al'] }, values: raw, id });
		if (id) {
			const [before] = await locals.db.select().from(discounts).where(eq(discounts.id, id));
			if (!before) error(404);
			await locals.db.update(discounts).set({ ...v, updatedAt: new Date() }).where(eq(discounts.id, id));
			await audit(locals.db, locals, { action: 'update', entity: 'discount', entityId: id, diff: diffObjects(before as never, v) });
		} else {
			const [row] = await locals.db.insert(discounts).values(v).returning();
			await audit(locals.db, locals, { action: 'create', entity: 'discount', entityId: row.id, diff: v });
		}
		return { saved: v.code };
	},
	toggle: async ({ request, locals }) => {
		requirePermission(locals, 'discounts:write');
		const id = String((await request.formData()).get('id'));
		const [d] = await locals.db.select().from(discounts).where(eq(discounts.id, id));
		if (!d) error(404);
		await locals.db.update(discounts).set({ active: !d.active, updatedAt: new Date() }).where(eq(discounts.id, id));
		await audit(locals.db, locals, { action: d.active ? 'deactivate' : 'activate', entity: 'discount', entityId: id });
		return { toggled: d.code };
	},
	delete: async ({ request, locals }) => {
		requirePermission(locals, 'discounts:write');
		const id = String((await request.formData()).get('id'));
		const [{ n }] = await locals.db.select({ n: sql<number>`count(*)::int` }).from(discountRedemptions).where(eq(discountRedemptions.discountId, id));
		if (n > 0) return fail(400, { deleteError: 'Een gebruikte code kan niet verwijderd worden (boekhouding). Deactiveer ze in de plaats.' });
		await locals.db.delete(discounts).where(eq(discounts.id, id));
		await audit(locals.db, locals, { action: 'delete', entity: 'discount', entityId: id });
		return { deleted: true };
	}
};
