/**
 * Admin product form (P1-01): zod schema shared by client and server, plus the plain-string form
 * model the ProductForm renders. Field names are dotted paths (`name.nl`, `variants.0.sku`) so the
 * form posts natively without JS; `formToObject()` turns FormData back into the nested shape.
 */
import { z } from 'zod';
import { euroToCents, slugSchema } from './common.ts';

// ── FormData → nested object ─────────────────────────────────────────────────────
type Tree = { [k: string]: Tree | Tree[] | string | string[] | undefined };

/**
 * `a.b=1&list.0.x=2&list.1.x=3&tag=a&tag=b` → `{ a: { b: '1' }, list: [{x:'2'},{x:'3'}], tag: ['a','b'] }`.
 * Objects whose keys are all integers become arrays (ordered by index, holes dropped). Repeated
 * keys become string arrays. Files are skipped (handle them separately).
 */
export function formToObject(fd: FormData): Tree {
	const root: Record<string, unknown> = {};
	for (const [key, value] of fd.entries()) {
		if (typeof value !== 'string') continue;
		if (key.startsWith('_')) continue; // control fields (_intent …)
		const parts = key.split('.');
		let node = root;
		for (let i = 0; i < parts.length - 1; i++) {
			const p = parts[i];
			if (typeof node[p] !== 'object' || node[p] === null || Array.isArray(node[p])) node[p] = {};
			node = node[p] as Record<string, unknown>;
		}
		const last = parts[parts.length - 1];
		const prev = node[last];
		if (prev === undefined) node[last] = value;
		else if (Array.isArray(prev)) prev.push(value);
		else if (typeof prev === 'string') node[last] = [prev, value];
	}
	return arrayify(root) as Tree;
}

function arrayify(node: unknown): unknown {
	if (Array.isArray(node) || typeof node !== 'object' || node === null) return node;
	const obj = node as Record<string, unknown>;
	const keys = Object.keys(obj);
	for (const k of keys) obj[k] = arrayify(obj[k]);
	if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
		return keys
			.map(Number)
			.sort((a, b) => a - b)
			.map((k) => obj[String(k)]);
	}
	return obj;
}

// ── Constants ────────────────────────────────────────────────────────────────────
export const METALS = ['gold', 'rosegold', 'silver'] as const;
export type MetalValue = (typeof METALS)[number];
export const METAL_LABELS: Record<MetalValue, string> = { gold: 'Goud', rosegold: 'Rosé goud', silver: 'Zilver' };
export const METAL_CODES: Record<MetalValue, string> = { gold: 'GO', rosegold: 'RG', silver: 'SI' };

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const STATUS_LABELS: Record<ProductStatus, string> = { draft: 'Concept', active: 'Actief', archived: 'Gearchiveerd' };

export const BADGES = ['limited', 'bestseller'] as const;
export const BADGE_LABELS: Record<(typeof BADGES)[number], string> = { limited: 'Limited', bestseller: 'Bestseller' };

/** SKU convention (matches the seed): `KLAVER-RING-GO-52`. */
export function skuFor(slug: string, metal: MetalValue, size?: string | null): string {
	const base = slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
	const sz = (size ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
	return [base, METAL_CODES[metal], sz].filter(Boolean).join('-');
}

/** Metal × size matrix: every combination, in metal order then size order. */
export function variantMatrix(slug: string, metals: readonly MetalValue[], sizes: readonly string[]) {
	const sz = sizes.map((s) => s.trim()).filter(Boolean);
	const out: { sku: string; metal: MetalValue; size: string }[] = [];
	for (const metal of metals) {
		if (!sz.length) out.push({ sku: skuFor(slug, metal), metal, size: '' });
		for (const size of sz) out.push({ sku: skuFor(slug, metal, size), metal, size });
	}
	return out;
}

/** "50, 52 54;56" → ['50','52','54','56'] */
export const parseSizes = (s: string | undefined | null) =>
	(s ?? '')
		.split(/[\s,;]+/)
		.map((x) => x.trim())
		.filter(Boolean);

/** "klaver, Rood , klaver" → ['klaver','rood'] */
export const parseTags = (s: string | undefined | null) => [
	...new Set(
		(s ?? '')
			.split(/[,;\n]+/)
			.map((t) => t.trim().toLowerCase())
			.filter(Boolean)
	)
];

// ── Form model (all strings, the shape posted by the form) ───────────────────────
export interface I18nModel {
	nl: string;
	fr: string;
}
export interface ImageModel {
	mediaId?: string;
	key?: string;
	url: string;
	width?: string;
	height?: string;
	bytes?: string;
	alt: I18nModel;
	remove?: string;
	position?: string;
}
export interface VariantModel {
	id?: string;
	sku: string;
	metal: string;
	size: string;
	stock: string;
	priceOverride: string;
	lowStockThreshold: string;
	remove?: string;
}
export interface ProductFormModel {
	slug: string;
	name: I18nModel;
	description: I18nModel;
	meaning: I18nModel;
	care: I18nModel;
	material: I18nModel;
	categoryId: string;
	price: string;
	compareAtPrice: string;
	status: string;
	featured?: string;
	engravable?: string;
	badge: string;
	stoneColor: string;
	tags: string;
	gpsr: { manufacturer: string; address: string; contact: string; safetyInfo: I18nModel };
	seo: { title: I18nModel; description: I18nModel };
	images: ImageModel[];
	variants: VariantModel[];
	related: string[];
	completeSet: string[];
}

export const emptyI18n = (): I18nModel => ({ nl: '', fr: '' });

export function emptyProductModel(): ProductFormModel {
	return {
		slug: '',
		name: emptyI18n(),
		description: emptyI18n(),
		meaning: emptyI18n(),
		care: emptyI18n(),
		material: emptyI18n(),
		categoryId: '',
		price: '',
		compareAtPrice: '',
		status: 'draft',
		badge: '',
		stoneColor: '',
		tags: '',
		gpsr: { manufacturer: '', address: '', contact: '', safetyInfo: emptyI18n() },
		seo: { title: emptyI18n(), description: emptyI18n() },
		images: [],
		variants: [],
		related: [],
		completeSet: []
	};
}

/** Merge raw posted values onto an empty model so every path exists (form re-render after fail). */
export function normalizeModel(raw: Tree): ProductFormModel {
	const base = emptyProductModel();
	const r = raw as unknown as Partial<ProductFormModel> & Record<string, unknown>;
	const str = (v: unknown) => (typeof v === 'string' ? v : '');
	const i18n = (v: unknown): I18nModel => ({ nl: str((v as I18nModel | undefined)?.nl), fr: str((v as I18nModel | undefined)?.fr) });
	const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : typeof v === 'string' && v ? [v] : []) as string[];
	const objs = <T>(v: unknown) => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as T[]) : []);
	return {
		...base,
		slug: str(r.slug),
		name: i18n(r.name),
		description: i18n(r.description),
		meaning: i18n(r.meaning),
		care: i18n(r.care),
		material: i18n(r.material),
		categoryId: str(r.categoryId),
		price: str(r.price),
		compareAtPrice: str(r.compareAtPrice),
		status: str(r.status) || 'draft',
		featured: r.featured ? 'on' : undefined,
		engravable: r.engravable ? 'on' : undefined,
		badge: str(r.badge),
		stoneColor: str(r.stoneColor),
		tags: str(r.tags),
		gpsr: {
			manufacturer: str(r.gpsr?.manufacturer),
			address: str(r.gpsr?.address),
			contact: str(r.gpsr?.contact),
			safetyInfo: i18n(r.gpsr?.safetyInfo)
		},
		seo: { title: i18n(r.seo?.title), description: i18n(r.seo?.description) },
		images: objs<ImageModel>(r.images).map((i) => ({
			mediaId: str(i.mediaId) || undefined,
			key: str(i.key) || undefined,
			url: str(i.url),
			width: str(i.width),
			height: str(i.height),
			bytes: str(i.bytes),
			alt: i18n(i.alt),
			remove: i.remove ? 'on' : undefined,
			position: str(i.position)
		})),
		variants: objs<VariantModel>(r.variants).map((v) => ({
			id: str(v.id) || undefined,
			sku: str(v.sku),
			metal: str(v.metal) || 'gold',
			size: str(v.size),
			stock: str(v.stock),
			priceOverride: str(v.priceOverride),
			lowStockThreshold: str(v.lowStockThreshold),
			remove: v.remove ? 'on' : undefined
		})),
		related: list(r.related),
		completeSet: list(r.completeSet)
	};
}

// ── Validation ───────────────────────────────────────────────────────────────────
const text = (max = 5000) =>
	z
		.string()
		.trim()
		.max(max, `Maximaal ${max} tekens`)
		.optional()
		.transform((v) => v || undefined);

const i18nOptional = (max = 5000) =>
	z
		.object({ nl: text(max), fr: text(max) })
		.optional()
		.transform((v) => (v?.nl || v?.fr ? { nl: v.nl ?? '', ...(v.fr ? { fr: v.fr } : {}) } : null));

const intField = (label: string, { min = 0, max = 1_000_000, fallback }: { min?: number; max?: number; fallback?: number } = {}) =>
	z
		.string()
		.trim()
		.optional()
		.transform((v, ctx) => {
			if (!v) {
				if (fallback !== undefined) return fallback;
				ctx.addIssue({ code: 'custom', message: `${label} is verplicht` });
				return z.NEVER;
			}
			const n = Number(v);
			if (!Number.isInteger(n)) {
				ctx.addIssue({ code: 'custom', message: `${label} moet een geheel getal zijn` });
				return z.NEVER;
			}
			if (n < min) {
				ctx.addIssue({ code: 'custom', message: min === 0 ? `${label} kan niet negatief zijn` : `${label} moet minstens ${min} zijn` });
				return z.NEVER;
			}
			if (n > max) {
				ctx.addIssue({ code: 'custom', message: `${label} is te groot` });
				return z.NEVER;
			}
			return n;
		});

const money = euroToCents.optional().transform((v) => v ?? null);
const flag = z
	.unknown()
	.optional()
	.transform((v) => v === 'on' || v === 'true' || v === '1');
const idList = z
	.union([z.string(), z.array(z.string())])
	.optional()
	.transform((v) => [...new Set((Array.isArray(v) ? v : v ? [v] : []).filter((x) => z.uuid().safeParse(x).success))]);

export const imageSchema = z
	.object({
		mediaId: z.uuid().optional().or(z.literal('').transform(() => undefined)),
		key: z
			.string()
			.optional()
			.transform((v) => v || undefined),
		width: intField('Breedte', { fallback: 0 }),
		height: intField('Hoogte', { fallback: 0 }),
		bytes: intField('Grootte', { fallback: 0, max: 100_000_000 }),
		alt: z.object({ nl: text(250), fr: text(250) }).optional(),
		remove: flag,
		position: z.string().optional()
	})
	.superRefine((i, ctx) => {
		if (i.remove) return;
		if (!i.mediaId && !i.key) ctx.addIssue({ code: 'custom', path: ['key'], message: 'Afbeelding ontbreekt' });
		if (!i.alt?.nl) ctx.addIssue({ code: 'custom', path: ['alt', 'nl'], message: 'Alt-tekst (NL) is verplicht' });
	})
	.transform((i) => ({
		mediaId: i.mediaId,
		key: i.key,
		width: i.width || null,
		height: i.height || null,
		bytes: i.bytes || null,
		alt: { nl: i.alt?.nl ?? '', ...(i.alt?.fr ? { fr: i.alt.fr } : {}) },
		remove: i.remove,
		position: i.position ? Number(i.position) : NaN
	}));

export const variantSchema = z.object({
	id: z.uuid().optional().or(z.literal('').transform(() => undefined)),
	sku: z
		.string()
		.trim()
		.toUpperCase()
		.max(64, 'Maximaal 64 tekens')
		.regex(/^[A-Z0-9][A-Z0-9._-]*$|^$/, 'Alleen letters, cijfers, punt, - en _'),
	metal: z.enum(METALS, { error: 'Kies een metaal' }),
	size: z
		.string()
		.trim()
		.max(16, 'Maximaal 16 tekens')
		.optional()
		.transform((v) => v || null),
	stock: intField('Voorraad', { fallback: 0 }),
	priceOverride: money,
	lowStockThreshold: intField('Drempel', { fallback: 2, max: 10_000 }),
	remove: flag
}).superRefine((v, ctx) => {
	if (!v.remove && !v.sku) ctx.addIssue({ code: 'custom', path: ['sku'], message: 'SKU is verplicht' });
});

export const productSchema = z
	.object({
		slug: slugSchema,
		name: z.object({
			nl: z.string().trim().min(1, 'Naam (NL) is verplicht').max(160, 'Maximaal 160 tekens'),
			fr: text(160)
		}),
		description: i18nOptional(10_000),
		meaning: i18nOptional(5000),
		care: i18nOptional(5000),
		material: i18nOptional(200),
		categoryId: z.uuid({ error: 'Kies een categorie' }),
		price: euroToCents.optional().transform((v, ctx) => {
			if (v === undefined) {
				ctx.addIssue({ code: 'custom', message: 'Prijs is verplicht' });
				return z.NEVER;
			}
			return v;
		}),
		compareAtPrice: money,
		status: z.enum(PRODUCT_STATUSES, { error: 'Ongeldige status' }),
		featured: flag,
		engravable: flag,
		badge: z
			.enum(['', ...BADGES])
			.optional()
			.transform((v) => v || null),
		stoneColor: z
			.string()
			.trim()
			.toLowerCase()
			.max(40)
			.optional()
			.transform((v) => v || null),
		tags: z
			.string()
			.optional()
			.transform((v) => parseTags(v)),
		gpsr: z
			.object({
				manufacturer: text(200),
				address: text(400),
				contact: text(200),
				safetyInfo: i18nOptional(2000)
			})
			.optional(),
		seo: z.object({ title: i18nOptional(70), description: i18nOptional(170) }).optional(),
		images: z.array(imageSchema).optional().default([]),
		variants: z.array(variantSchema).optional().default([]),
		related: idList,
		completeSet: idList
	})
	.superRefine((p, ctx) => {
		if (p.compareAtPrice !== null && p.compareAtPrice <= p.price)
			ctx.addIssue({ code: 'custom', path: ['compareAtPrice'], message: 'Van-prijs moet hoger zijn dan de prijs' });
		const seen = new Map<string, number>();
		const combos = new Map<string, number>();
		p.variants.forEach((v, i) => {
			if (v.remove) return;
			if (!v.sku) return;
			if (seen.has(v.sku)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'SKU komt dubbel voor' });
			else seen.set(v.sku, i);
			const combo = `${v.metal}|${v.size ?? ''}`;
			if (combos.has(combo)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'size'], message: 'Deze combinatie metaal × maat bestaat al' });
			else combos.set(combo, i);
		});
	});

export type ProductInput = z.output<typeof productSchema>;
export type ImageInput = ProductInput['images'][number];
export type VariantInput = ProductInput['variants'][number];

/** Keys produced by `mediaKey()` for raster uploads. Anything else is rejected on save. */
export const UPLOAD_KEY_RE = /^(products|media)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;
export const RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const MAX_UPLOAD_MB = 15;
export const MIN_EDGE_PX = 1600;

/**
 * Activation rule (§9.1 P1-01): an active product needs ≥ 1 image with Dutch alt text and ≥ 1 variant.
 * Returns field errors (empty object = ok).
 */
export function activationErrors(p: {
	status: string;
	images: { alt: { nl?: string }; remove?: boolean }[];
	variants: { remove?: boolean }[];
}): Record<string, string[]> {
	if (p.status !== 'active') return {};
	const errors: Record<string, string[]> = {};
	const images = p.images.filter((i) => !i.remove);
	const variants = p.variants.filter((v) => !v.remove);
	if (!images.some((i) => i.alt.nl?.trim()))
		(errors.images ??= []).push('Een actief product heeft minstens één foto met Nederlandse alt-tekst nodig');
	if (!variants.length) (errors.variants ??= []).push('Een actief product heeft minstens één variant nodig');
	if (Object.keys(errors).length) errors.status = ['Kan niet activeren: voeg eerst een foto met alt-tekst en een variant toe'];
	return errors;
}

// ── No-JS form edits ─────────────────────────────────────────────────────────────
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' && v ? [v] : []);

/** Applies `${name}Remove` / `${name}Add` (posted by RelationPicker without JS) to an ordered id list. */
export function applyListEdits(raw: Record<string, unknown>, name: string): string[] {
	const remove = new Set(asList(raw[`${name}Remove`]));
	const list = asList(raw[name]).filter((id) => !remove.has(id));
	for (const id of asList(raw[`${name}Add`])) if (!list.includes(id)) list.push(id);
	delete raw[`${name}Remove`];
	delete raw[`${name}Add`];
	return list;
}

/**
 * Normalises a posted product form before validation: relation list edits, metal × size matrix
 * expansion (`matrix.metals`, `matrix.sizes`) and dropping untouched blank variant rows.
 */
export function prepareProductForm(raw: Record<string, unknown>): Record<string, unknown> {
	raw.related = applyListEdits(raw, 'related');
	raw.completeSet = applyListEdits(raw, 'completeSet');
	const rows = (Array.isArray(raw.variants) ? raw.variants : []) as Partial<VariantModel>[];
	const kept = rows.filter((v) => v && (v.id || v.sku?.trim() || v.size?.trim()));
	const matrix = raw.matrix as { metals?: unknown; sizes?: unknown } | undefined;
	const metals = asList(matrix?.metals).filter((m): m is MetalValue => (METALS as readonly string[]).includes(m));
	if (metals.length) {
		const slug = typeof raw.slug === 'string' && raw.slug ? raw.slug : 'product';
		const existing = new Set(kept.map((v) => `${v.metal ?? 'gold'}|${(v.size ?? '').trim()}`));
		for (const r of variantMatrix(slug, metals, parseSizes(typeof matrix?.sizes === 'string' ? matrix.sizes : '')))
			if (!existing.has(`${r.metal}|${r.size}`)) kept.push({ sku: r.sku, metal: r.metal, size: r.size, stock: '0', priceOverride: '', lowStockThreshold: '2' });
	}
	delete raw.matrix;
	raw.variants = kept;
	return raw;
}
