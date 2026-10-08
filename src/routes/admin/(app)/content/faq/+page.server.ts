/** FAQ admin (P4-02): CRUD with groups and ordering within a group. Works without JS. */
import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { faqs } from '#lib/server/db/schema.ts';
import { moveFaq, nextFaqPosition } from '#lib/server/services/content.ts';
import { audit, diffObjects } from '#lib/server/services/audit.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { can } from '#lib/permissions.ts';

const FAQ_GROUPS = ['general', 'orders', 'shipping', 'returns', 'products', 'payment'];

const schema = z.object({
	group: z
		.string()
		.trim()
		.toLowerCase()
		.regex(/^[a-z0-9-]{2,40}$/, 'Gebruik kleine letters, cijfers en koppeltekens (bv. orders)'),
	question_nl: z.string().trim().min(3, 'Vraag (NL) is verplicht').max(300),
	question_fr: z.string().trim().max(300).default(''),
	answer_nl: z.string().trim().min(3, 'Antwoord (NL) is verplicht').max(4000),
	answer_fr: z.string().trim().max(4000).default('')
});
const idSchema = z.string().uuid();

const toRow = (v: z.infer<typeof schema>) => ({
	group: v.group,
	question: { nl: v.question_nl, ...(v.question_fr ? { fr: v.question_fr } : {}) },
	answer: { nl: v.answer_nl, ...(v.answer_fr ? { fr: v.answer_fr } : {}) }
});

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requirePermission(locals, 'content:read');
	const rows = await locals.db.select().from(faqs).orderBy(asc(faqs.group), asc(faqs.position), asc(faqs.createdAt));
	const groups = [...new Set(rows.map((r) => r.group))];
	return {
		groups: groups.map((g) => ({
			group: g,
			items: rows
				.filter((r) => r.group === g)
				.map((r) => ({ id: r.id, group: r.group, question: r.question, answer: r.answer }))
		})),
		suggestions: [...new Set([...FAQ_GROUPS, ...groups])],
		canWrite: can(admin.role, 'content:write'),
		crumbs: [{ label: 'Content', href: '/admin/content' }, { label: 'FAQ' }]
	};
};

async function readForm(request: Request) {
	const raw = Object.fromEntries(await request.formData()) as Record<string, string>;
	return { raw, parsed: schema.safeParse(raw) };
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requirePermission(locals, 'content:write');
		const { raw, parsed } = await readForm(request);
		if (!parsed.success) return fail(400, { form: 'new', errors: fieldErrors(parsed.error), values: raw });
		const row = toRow(parsed.data);
		const [created] = await locals.db
			.insert(faqs)
			.values({ ...row, position: await nextFaqPosition(locals.db, row.group) })
			.returning({ id: faqs.id });
		await audit(locals.db, locals, {
			action: 'create',
			entity: 'faq',
			entityId: created.id,
			diff: { question: row.question.nl, group: row.group }
		});
		return { form: 'new', saved: true };
	},
	update: async ({ request, locals }) => {
		requirePermission(locals, 'content:write');
		const { raw, parsed } = await readForm(request);
		const id = idSchema.safeParse(raw.id);
		if (!id.success) error(400, 'Ongeldige vraag');
		if (!parsed.success) return fail(400, { form: id.data, errors: fieldErrors(parsed.error), values: raw });
		const [before] = await locals.db.select().from(faqs).where(eq(faqs.id, id.data));
		if (!before) error(404, 'Vraag niet gevonden');
		const row = toRow(parsed.data);
		const position = row.group !== before.group ? await nextFaqPosition(locals.db, row.group) : before.position;
		await locals.db
			.update(faqs)
			.set({ ...row, position })
			.where(eq(faqs.id, id.data));
		await audit(locals.db, locals, {
			action: 'update',
			entity: 'faq',
			entityId: id.data,
			diff: diffObjects(before as never, row)
		});
		return { form: id.data, saved: true };
	},
	delete: async ({ request, locals }) => {
		requirePermission(locals, 'content:write');
		const id = idSchema.safeParse((await request.formData()).get('id'));
		if (!id.success) error(400, 'Ongeldige vraag');
		const [before] = await locals.db.delete(faqs).where(eq(faqs.id, id.data)).returning();
		if (before)
			await audit(locals.db, locals, {
				action: 'delete',
				entity: 'faq',
				entityId: id.data,
				diff: { question: before.question.nl, group: before.group }
			});
		return { form: 'deleted', saved: true };
	},
	move: async ({ request, locals }) => {
		requirePermission(locals, 'content:write');
		const f = await request.formData();
		const id = idSchema.safeParse(f.get('id'));
		const dir = f.get('dir') === 'up' ? 'up' : 'down';
		if (!id.success) error(400, 'Ongeldige vraag');
		await moveFaq(locals.db, id.data, dir);
		await audit(locals.db, locals, { action: 'reorder', entity: 'faq', entityId: id.data, diff: { dir } });
		return { form: 'moved', saved: true };
	}
};
