/**
 * Legal texts (P4-03): the owner pastes the lawyer-provided NL/FR text per slot. We never write legal
 * content ourselves — empty slots show the storefront placeholder. Stored in settings.legal.
 */
import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { pages } from '#lib/server/db/schema.ts';
import { getSetting, setSetting } from '#lib/server/services/settings.ts';
import { LEGAL_SLOT_LABELS, LEGAL_SLOTS, type LegalSlotKey } from '#lib/server/services/content.ts';
import { audit } from '#lib/server/services/audit.ts';
import { checkbox } from '#lib/schemas/common.ts';

const schema = z.object({
	slot: z.enum(LEGAL_SLOTS),
	body_nl: z.string().trim().max(100_000).default(''),
	body_fr: z.string().trim().max(100_000).default(''),
	reviewed: checkbox
});

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings');
	const [legal, legalPages] = await Promise.all([
		getSetting(locals.db, 'legal'),
		locals.db
			.select({ key: pages.key, slugs: pages.slugs })
			.from(pages)
			.where(and(eq(pages.type, 'legal')))
	]);
	return {
		slots: LEGAL_SLOTS.map((key) => {
			const entry = legal[key];
			const page = legalPages.find((p) => p.key === key);
			return {
				key,
				label: LEGAL_SLOT_LABELS[key],
				body: entry?.body ?? { nl: '', fr: '' },
				reviewed: entry?.reviewed ?? false,
				paths: page ? { nl: `/nl/${page.slugs.nl}`, fr: `/fr/${page.slugs.fr}` } : null
			};
		}),
		crumbs: [{ label: 'Instellingen', href: '/admin/settings' }, { label: 'Juridisch' }]
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const raw = Object.fromEntries(await request.formData()) as Record<string, string>;
		const parsed = schema.safeParse(raw);
		if (!parsed.success) return fail(400, { slot: raw.slot, error: 'Ongeldige invoer' });
		const { slot, body_nl, body_fr, reviewed } = parsed.data;
		if (body_fr && !body_nl) return fail(400, { slot, error: 'Vul eerst de Nederlandse tekst in.' });
		if (reviewed && (!body_nl || !body_fr))
			return fail(400, { slot, error: '“Nagelezen door jurist” kan pas als de NL- én FR-tekst ingevuld zijn.' });
		const legal = await getSetting(locals.db, 'legal');
		const before = legal[slot as LegalSlotKey];
		const next = { ...legal, [slot]: { body: { nl: body_nl, ...(body_fr ? { fr: body_fr } : {}) }, reviewed } };
		await setSetting(locals.db, 'legal', next);
		await audit(locals.db, locals, {
			action: 'update',
			entity: 'legal_text',
			entityId: slot,
			diff: {
				lengthNl: [before?.body.nl.length ?? 0, body_nl.length],
				lengthFr: [before?.body.fr?.length ?? 0, body_fr.length],
				reviewed: [before?.reviewed ?? false, reviewed]
			}
		});
		return { slot, saved: true };
	}
};
