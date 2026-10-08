/**
 * Redirects (P4-04): CRUD on `redirects` (301/302) with hit counter. The hook applies them only when no
 * route matched (404), so a redirect can never shadow a live page.
 */
import { error, fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { redirects } from '#lib/server/db/schema.ts';
import { audit } from '#lib/server/services/audit.ts';
import { fieldErrors } from '#lib/schemas/common.ts';

const fromPath = z
	.string()
	.trim()
	.transform((v) => (v.length > 1 ? v.replace(/\/+$/, '') : v))
	.pipe(
		z
			.string()
			.max(500)
			.regex(/^\/(?!\/)[^\s?#]*$/, 'Pad moet beginnen met / (zonder domein, ? of #)')
			.refine(
				(v) => !/^\/(admin|api|_app|media)(\/|$)/.test(v),
				'Systeempaden (/admin, /api …) kunnen niet doorverwezen worden'
			)
	);
const toPath = z
	.string()
	.trim()
	.max(1000)
	.regex(/^(\/(?!\/)\S*|https:\/\/\S+)$/, 'Doel moet beginnen met / of https://');

const schema = z.object({ fromPath, toPath, code: z.coerce.number().pipe(z.union([z.literal(301), z.literal(302)])) });

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'settings');
	const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
	const rows = await locals.db.select().from(redirects).orderBy(desc(redirects.createdAt));
	const filtered = q
		? rows.filter((r) => r.fromPath.toLowerCase().includes(q) || r.toPath.toLowerCase().includes(q))
		: rows;
	return {
		q,
		total: rows.length,
		redirects: filtered.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
		crumbs: [{ label: 'Instellingen', href: '/admin/settings' }, { label: 'Redirects' }]
	};
};

async function validate(db: App.Locals['db'], raw: Record<string, string>, editing: string | null) {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) return { errors: fieldErrors(parsed.error) };
	const v = parsed.data;
	const errors: Record<string, string[]> = {};
	if (v.fromPath === v.toPath) errors.toPath = ['Doel is gelijk aan het oude pad'];
	const [chain] = await db.select().from(redirects).where(eq(redirects.fromPath, v.toPath));
	if (chain && chain.fromPath !== editing)
		errors.toPath = [`Dit doel wordt zelf doorverwezen naar ${chain.toPath} — verwijs meteen naar het eindadres`];
	if (editing === null) {
		const [dup] = await db.select().from(redirects).where(eq(redirects.fromPath, v.fromPath));
		if (dup) errors.fromPath = ['Er bestaat al een redirect voor dit pad'];
	}
	return Object.keys(errors).length ? { errors } : { data: v };
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const raw = Object.fromEntries(await request.formData()) as Record<string, string>;
		const r = await validate(locals.db, raw, null);
		if (!r.data) return fail(400, { form: 'new', errors: r.errors, values: raw });
		await locals.db.insert(redirects).values(r.data);
		await audit(locals.db, locals, { action: 'create', entity: 'redirect', entityId: r.data.fromPath, diff: r.data });
		return { form: 'new', saved: true };
	},
	update: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const raw = Object.fromEntries(await request.formData()) as Record<string, string>;
		const [before] = await locals.db
			.select()
			.from(redirects)
			.where(eq(redirects.fromPath, raw.fromPath ?? ''));
		if (!before) error(404, 'Redirect niet gevonden');
		const r = await validate(locals.db, raw, before.fromPath);
		if (!r.data) return fail(400, { form: before.fromPath, errors: r.errors, values: raw });
		await locals.db
			.update(redirects)
			.set({ toPath: r.data.toPath, code: r.data.code })
			.where(eq(redirects.fromPath, before.fromPath));
		await audit(locals.db, locals, {
			action: 'update',
			entity: 'redirect',
			entityId: before.fromPath,
			diff: { toPath: [before.toPath, r.data.toPath], code: [before.code, r.data.code] }
		});
		return { form: before.fromPath, saved: true };
	},
	delete: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const from = String((await request.formData()).get('fromPath') ?? '');
		const [gone] = await locals.db.delete(redirects).where(eq(redirects.fromPath, from)).returning();
		if (gone)
			await audit(locals.db, locals, {
				action: 'delete',
				entity: 'redirect',
				entityId: from,
				diff: { toPath: gone.toPath, code: gone.code, hits: gone.hits }
			});
		return { form: 'deleted', saved: true };
	}
};
