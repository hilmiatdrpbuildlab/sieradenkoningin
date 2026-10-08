/** Admin schemas for categories and collections (P1-02). */
import { z } from 'zod';
import { euroToCents, slugSchema } from './common.ts';

const text = (max: number) =>
	z
		.string()
		.trim()
		.max(max, `Maximaal ${max} tekens`)
		.optional()
		.transform((v) => v || undefined);

const i18nOptional = (max: number) =>
	z
		.object({ nl: text(max), fr: text(max) })
		.optional()
		.transform((v) => (v?.nl || v?.fr ? { nl: v.nl ?? '', ...(v.fr ? { fr: v.fr } : {}) } : null));

const nameSchema = z.object({
	nl: z.string().trim().min(1, 'Naam (NL) is verplicht').max(120, 'Maximaal 120 tekens'),
	fr: z.string().trim().min(1, 'Naam (FR) is verplicht').max(120, 'Maximaal 120 tekens')
});
const slugsSchema = z.object({ nl: slugSchema, fr: slugSchema });
const seoSchema = z.object({ title: i18nOptional(70), description: i18nOptional(170) }).optional();

/**
 * First path segments the storefront already uses (§7.1 / i18n/paths.ts) — a category or collection
 * slug may not shadow them.
 */
export const RESERVED_SLUGS = new Set([
	'p', 'c', 'api', 'admin', 'media', 'zoeken', 'recherche', 'verlanglijst', 'liste-de-souhaits', 'winkelmand', 'panier',
	'afrekenen', 'commande', 'bedankt', 'merci', 'betalen', 'paiement', 'bestelling-volgen', 'suivi-commande', 'collectie',
	'collection', 'account', 'compte', 'nieuwsbrief', 'newsletter', 'faq', 'contact', 'journal'
]);

const notReserved = (s: { nl: string; fr: string }, ctx: z.RefinementCtx) => {
	for (const lang of ['nl', 'fr'] as const)
		if (RESERVED_SLUGS.has(s[lang])) ctx.addIssue({ code: 'custom', path: ['slugs', lang], message: 'Deze slug is gereserveerd door de winkel' });
};

export const categorySchema = z
	.object({
		name: nameSchema,
		slugs: slugsSchema,
		description: i18nOptional(5000),
		seo: seoSchema,
		position: z
			.string()
			.trim()
			.optional()
			.transform((v) => (v && Number.isInteger(Number(v)) ? Number(v) : 0))
	})
	.superRefine((c, ctx) => notReserved(c.slugs, ctx));
export type CategoryInput = z.output<typeof categorySchema>;

const optInt = z
	.string()
	.trim()
	.optional()
	.transform((v, ctx) => {
		if (!v) return undefined;
		const n = Number(v);
		if (!Number.isInteger(n) || n < 1 || n > 3650) {
			ctx.addIssue({ code: 'custom', message: 'Geef een aantal dagen tussen 1 en 3650' });
			return z.NEVER;
		}
		return n;
	});

export const ruleSchema = z
	.object({
		category: text(40),
		tag: z
			.string()
			.trim()
			.toLowerCase()
			.max(40)
			.optional()
			.transform((v) => v || undefined),
		newWithinDays: optInt,
		onSale: z
			.unknown()
			.optional()
			.transform((v) => (v === 'on' || v === 'true' ? true : undefined)),
		priceLt: euroToCents.optional()
	})
	.optional()
	.transform((r) => {
		const out: { category?: string; tag?: string; newWithinDays?: number; onSale?: boolean; priceLt?: number } = {};
		if (r?.category) out.category = r.category;
		if (r?.tag) out.tag = r.tag;
		if (r?.newWithinDays) out.newWithinDays = r.newWithinDays;
		if (r?.onSale) out.onSale = true;
		if (r?.priceLt) out.priceLt = r.priceLt;
		return out;
	});

export const collectionSchema = z
	.object({
		name: nameSchema,
		slugs: slugsSchema,
		description: i18nOptional(5000),
		seo: seoSchema,
		type: z.enum(['manual', 'rule'], { error: 'Kies een type' }),
		rule: ruleSchema,
		active: z
			.unknown()
			.optional()
			.transform((v) => v === 'on' || v === 'true'),
		heroMediaId: z
			.string()
			.optional()
			.transform((v) => (v && z.uuid().safeParse(v).success ? v : null)),
		products: z
			.union([z.string(), z.array(z.string())])
			.optional()
			.transform((v) => [...new Set((Array.isArray(v) ? v : v ? [v] : []).filter((x) => z.uuid().safeParse(x).success))])
	})
	.superRefine((c, ctx) => {
		notReserved(c.slugs, ctx);
		if (c.type === 'rule' && !Object.keys(c.rule).length)
			ctx.addIssue({ code: 'custom', path: ['rule'], message: 'Stel minstens één regel in' });
	});
export type CollectionInput = z.output<typeof collectionSchema>;

// ── Form models (strings, as posted) ─────────────────────────────────────────────
type I18nPair = { nl: string; fr: string };
export interface EntityModel {
	name: I18nPair;
	slugs: I18nPair;
	description: I18nPair;
	seo: { title: I18nPair; description: I18nPair };
}
export interface CollectionModel extends EntityModel {
	type: string;
	active?: string;
	heroMediaId: string;
	rule: { category: string; tag: string; newWithinDays: string; onSale?: string; priceLt: string };
	products: string[];
}

const pair = (v: unknown): I18nPair => {
	const o = (v ?? {}) as Partial<I18nPair>;
	return { nl: typeof o.nl === 'string' ? o.nl : '', fr: typeof o.fr === 'string' ? o.fr : '' };
};

/** Raw posted values / DB values → a complete entity model. */
export function toEntityModel(raw: Record<string, unknown>): EntityModel {
	const seo = (raw.seo ?? {}) as Record<string, unknown>;
	return {
		name: pair(raw.name),
		slugs: pair(raw.slugs),
		description: pair(raw.description),
		seo: { title: pair(seo.title), description: pair(seo.description) }
	};
}

export function toCollectionModel(raw: Record<string, unknown>): CollectionModel {
	const rule = (raw.rule ?? {}) as Record<string, unknown>;
	const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
	const products = raw.products;
	return {
		...toEntityModel(raw),
		type: s(raw.type) || 'manual',
		active: raw.active === undefined || raw.active === 'on' || raw.active === true ? 'on' : undefined,
		heroMediaId: s(raw.heroMediaId),
		rule: {
			category: s(rule.category),
			tag: s(rule.tag),
			newWithinDays: s(rule.newWithinDays),
			onSale: rule.onSale === true || rule.onSale === 'on' ? 'on' : undefined,
			priceLt: typeof rule.priceLt === 'number' ? (rule.priceLt / 100).toFixed(2).replace('.', ',') : s(rule.priceLt)
		},
		products: Array.isArray(products) ? products.filter((x): x is string => typeof x === 'string') : typeof products === 'string' ? [products] : []
	};
}
