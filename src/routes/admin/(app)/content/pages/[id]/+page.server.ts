/**
 * Page builder (P4-01): page meta (title, slugs, SEO per language, status, publish_at) + the complete
 * block list, saved together in one transaction. `nieuw` creates a page.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { collections, faqs, pages } from '#lib/server/db/schema.ts';
import {
	getBlocks,
	LEGAL_SLOT_LABELS,
	LEGAL_SLOTS,
	savePage,
	slugErrors,
	validateBlocks,
	type PageMeta
} from '#lib/server/services/content.ts';
import { audit } from '#lib/server/services/audit.ts';
import { fieldErrors, slugSchema } from '#lib/schemas/common.ts';
import { fromBrusselsInput } from '#lib/utils/brussels-time.ts';
import { can } from '#lib/permissions.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (max: number) => z.string().trim().max(max).default('');

const metaSchema = z.object({
	title_nl: z.string().trim().min(1, 'Nederlandse titel is verplicht').max(160),
	title_fr: text(160),
	slug_nl: z.string().trim().default(''),
	slug_fr: z.string().trim().default(''),
	type: z.enum(['home', 'page', 'legal', 'landing']).default('page'),
	status: z.enum(['draft', 'published']).default('draft'),
	publishAt: z.string().trim().default(''),
	seo_title_nl: text(70),
	seo_title_fr: text(70),
	seo_description_nl: text(170),
	seo_description_fr: text(170)
});

async function loadPage(db: App.Locals['db'], id: string) {
	if (!UUID.test(id)) error(404, 'Pagina niet gevonden');
	const [page] = await db.select().from(pages).where(eq(pages.id, id));
	if (!page) error(404, 'Pagina niet gevonden');
	return page;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = requirePermission(locals, 'content:read');
	const db = locals.db;
	const isNew = params.id === 'nieuw';
	const page = isNew ? null : await loadPage(db, params.id);
	const [blocks, cols, groups] = await Promise.all([
		page ? getBlocks(db, page.id, { includeHidden: true }) : Promise.resolve([]),
		db.select({ id: collections.id, name: collections.name }).from(collections).orderBy(asc(collections.createdAt)),
		db.selectDistinct({ group: faqs.group }).from(faqs).orderBy(asc(faqs.group))
	]);
	return {
		page: page
			? {
					id: page.id,
					key: page.key,
					type: page.type,
					title: page.title,
					slugs: page.slugs,
					status: page.status,
					publishAt: page.publishAt?.toISOString() ?? null,
					seo: page.seo ?? {},
					updatedAt: page.updatedAt.toISOString()
				}
			: null,
		blocks,
		collections: cols.map((c) => ({ id: c.id, name: c.name.nl })),
		faqGroups: groups.map((g) => g.group),
		legalSlots: LEGAL_SLOTS.map((key) => ({ key, label: LEGAL_SLOT_LABELS[key] })),
		canWrite: can(admin.role, 'content:write'),
		crumbs: [
			{ label: 'Content', href: '/admin/content' },
			{ label: "Pagina's", href: '/admin/content/pages' },
			{ label: page ? page.title.nl : 'Nieuwe pagina' }
		]
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		requirePermission(locals, 'content:write');
		const db = locals.db;
		const existing = params.id === 'nieuw' ? null : await loadPage(db, params.id);
		const form = await request.formData();
		const raw = Object.fromEntries([...form.entries()].filter(([k]) => k !== 'blocks')) as Record<string, string>;
		const blocksJson = String(form.get('blocks') ?? '[]');
		const values = { ...raw, blocks: blocksJson };

		const parsed = metaSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), blockErrors: {}, values });
		const f = parsed.data;
		const isHome = existing?.type === 'home';
		const type = isHome ? 'home' : f.type === 'home' ? 'page' : f.type;
		const errors: Record<string, string[]> = {};
		const slugs = isHome ? { nl: '', fr: '' } : { nl: f.slug_nl, fr: f.slug_fr || f.slug_nl };
		if (!isHome) {
			for (const lang of ['nl', 'fr'] as const) {
				const r = slugSchema.safeParse(slugs[lang]);
				if (!r.success) errors[`slug_${lang}`] = [r.error.issues[0].message];
			}
			if (!Object.keys(errors).length) Object.assign(errors, await slugErrors(db, slugs, existing?.id ?? null));
		}
		const publishAt = f.publishAt ? fromBrusselsInput(f.publishAt) : null;
		if (f.publishAt && !publishAt) errors.publishAt = ['Ongeldige datum'];

		let blocksInput: unknown;
		try {
			blocksInput = JSON.parse(blocksJson);
		} catch {
			blocksInput = null;
		}
		const { blocks, errors: blockMessages, byIndex } = validateBlocks(blocksInput);
		if (blockMessages.length) errors.blocks = blockMessages;
		if (Object.keys(errors).length) return fail(400, { errors, blockErrors: byIndex, values });

		const opt = (nl: string, fr: string) => (nl || fr ? { nl, ...(fr ? { fr } : {}) } : undefined);
		const seo = {
			title: opt(f.seo_title_nl, f.seo_title_fr),
			description: opt(f.seo_description_nl, f.seo_description_fr)
		};
		const meta: PageMeta = {
			title: { nl: f.title_nl, ...(f.title_fr ? { fr: f.title_fr } : {}) },
			slugs,
			type,
			status: f.status,
			publishAt: publishAt ? new Date(publishAt) : null,
			seo: JSON.parse(JSON.stringify(seo))
		};
		const id = await savePage(db, existing?.id ?? null, meta, blocks);
		await audit(db, locals, {
			action: existing ? 'update' : 'create',
			entity: 'page',
			entityId: id,
			diff: {
				title: [existing?.title.nl ?? null, meta.title.nl],
				status: [existing?.status ?? null, meta.status],
				publishAt: [existing?.publishAt?.toISOString() ?? null, publishAt],
				slugs: [existing?.slugs ?? null, slugs],
				blocks: blocks.map((b) => b.type)
			}
		});
		if (!existing) redirect(303, `/admin/content/pages/${id}?created=1`);
		return { saved: true };
	},

	delete: async ({ locals, params }) => {
		requirePermission(locals, 'content:write');
		const page = await loadPage(locals.db, params.id);
		if (page.key)
			return fail(400, {
				errors: { _: ['Systeempagina’s (home, juridisch, help) kunnen niet verwijderd worden. Zet ze op concept.'] },
				blockErrors: {},
				values: null
			});
		await locals.db.delete(pages).where(eq(pages.id, page.id));
		await audit(locals.db, locals, {
			action: 'delete',
			entity: 'page',
			entityId: page.id,
			diff: { title: page.title.nl, slugs: page.slugs }
		});
		redirect(303, '/admin/content/pages');
	}
};
