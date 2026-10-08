/** Announcement bar (P4-02): NL/FR text, optional link, schedule (Brussels time in, UTC stored). */
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { settings } from '#lib/server/db/schema.ts';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { getSetting, setSetting } from '#lib/server/services/settings.ts';
import { audit } from '#lib/server/services/audit.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { fromBrusselsInput } from '#lib/utils/brussels-time.ts';
import { can } from '#lib/permissions.ts';

const schema = z
	.object({
		text_nl: z.string().trim().max(140, 'Max. 140 tekens').default(''),
		text_fr: z.string().trim().max(140, 'Max. 140 tekens').default(''),
		href: z
			.string()
			.trim()
			.max(300)
			.refine((v) => !v || /^(\/(?!\/)|https:\/\/)/.test(v), 'Link moet beginnen met / of https://')
			.default(''),
		from: z.string().trim().default(''),
		until: z.string().trim().default('')
	})
	.superRefine((v, ctx) => {
		if (v.text_fr && !v.text_nl)
			ctx.addIssue({ code: 'custom', path: ['text_nl'], message: 'Nederlandse tekst is verplicht' });
		const f = v.from ? fromBrusselsInput(v.from) : null;
		const u = v.until ? fromBrusselsInput(v.until) : null;
		if (v.from && !f) ctx.addIssue({ code: 'custom', path: ['from'], message: 'Ongeldige datum' });
		if (v.until && !u) ctx.addIssue({ code: 'custom', path: ['until'], message: 'Ongeldige datum' });
		if (f && u && u <= f) ctx.addIssue({ code: 'custom', path: ['until'], message: 'Moet na de startdatum liggen' });
	});

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requirePermission(locals, 'content:read');
	return {
		announcement: await getSetting(locals.db, 'announcement'),
		canWrite: can(admin.role, 'content:write'),
		crumbs: [{ label: 'Content', href: '/admin/content' }, { label: 'Aankondiging' }]
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requirePermission(locals, 'content:write');
		const raw = Object.fromEntries(await request.formData()) as Record<string, string>;
		const parsed = schema.safeParse(raw);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values: raw });
		const v = parsed.data;
		const before = await getSetting(locals.db, 'announcement');
		const next = v.text_nl
			? {
					text: { nl: v.text_nl, ...(v.text_fr ? { fr: v.text_fr } : {}) },
					href: v.href || undefined,
					from: fromBrusselsInput(v.from),
					until: fromBrusselsInput(v.until)
				}
			: null;
		// No announcement = no settings row (value is NOT NULL jsonb; getSettings falls back to null).
		if (next) await setSetting(locals.db, 'announcement', next);
		else await locals.db.delete(settings).where(eq(settings.key, 'announcement'));
		await audit(locals.db, locals, {
			action: next ? 'update' : 'clear',
			entity: 'settings',
			entityId: 'announcement',
			diff: { before, after: next }
		});
		return { saved: true };
	}
};
