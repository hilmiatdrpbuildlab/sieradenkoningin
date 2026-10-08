import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { customers } from '#lib/server/db/schema.ts';
import { anonymizeCustomer, getCustomer } from '#lib/server/services/customers.ts';
import { audit, diffObjects } from '#lib/server/services/audit.ts';
import { fieldErrors } from '#lib/schemas/common.ts';

const Notes = z.object({
	notes: z.string().max(5000).default(''),
	tags: z
		.string()
		.default('')
		.transform((s) => [...new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20))
});

export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = requirePermission(locals, 'customers:read');
	const data = await getCustomer(locals.db, params.id);
	if (!data || data.customer.deletedAt) error(404, 'Klant niet gevonden');
	const { passwordHash: _pw, ...customer } = data.customer;
	const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email;
	return {
		...data,
		customer: { ...customer, hasPassword: !!_pw },
		canWrite: admin.role !== 'fulfilment',
		isOwner: admin.role === 'owner',
		crumbs: [{ label: 'Klanten', href: '/admin/customers' }, { label: name }]
	};
};

export const actions: Actions = {
	notes: async ({ request, locals, params }) => {
		requirePermission(locals, 'customers:write');
		const parsed = Notes.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		const [before] = await locals.db.select({ notes: customers.notes, tags: customers.tags }).from(customers).where(eq(customers.id, params.id));
		if (!before) error(404);
		await locals.db.update(customers).set({ notes: parsed.data.notes || null, tags: parsed.data.tags, updatedAt: new Date() }).where(eq(customers.id, params.id));
		await audit(locals.db, locals, { action: 'update', entity: 'customer', entityId: params.id, diff: diffObjects(before, { notes: parsed.data.notes || null, tags: parsed.data.tags }) });
		return { saved: true };
	},
	delete: async ({ request, locals, params }) => {
		const admin = requirePermission(locals, 'customers:write');
		if (admin.role !== 'owner') error(403, 'Alleen de eigenaar kan klantgegevens verwijderen.');
		const confirm = String((await request.formData()).get('confirm') ?? '').trim().toLowerCase();
		const [c] = await locals.db.select({ email: customers.email }).from(customers).where(eq(customers.id, params.id));
		if (!c) error(404);
		if (confirm !== c.email.toLowerCase()) return fail(400, { deleteError: 'Typ het e-mailadres van de klant exact over om te bevestigen.' });
		await locals.db.transaction(async (tx) => {
			await anonymizeCustomer(tx, params.id);
			await audit(tx, locals, { action: 'gdpr_delete', entity: 'customer', entityId: params.id });
		});
		redirect(303, '/admin/customers?deleted=1');
	}
};
