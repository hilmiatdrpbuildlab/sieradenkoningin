/**
 * CSV import / export (P1-04). One CSV row = one variant; product columns repeat per row and are
 * merged per `product_slug` (first non-empty value wins). Flow: parse → plan (dry run, pure) →
 * commit (per-product savepoints, so one bad row never aborts the rest).
 */
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { categories, priceHistory, products, variants, type I18n } from '../db/schema.ts';
import { audit } from './audit.ts';
import { applyStockDelta, StockError } from './inventory.ts';
import { CsvError, parseCsvRecords, recordsToCsv } from '#lib/utils/csv.ts';
import { slugSchema } from '#lib/schemas/common.ts';
import { centsToInput } from '#lib/utils/format.ts';
import { METALS, parseTags, PRODUCT_STATUSES, type MetalValue, type ProductStatus } from '#lib/schemas/product.ts';

type Actor = Pick<App.Locals, 'admin' | 'ip'>;

export const IMPORT_COLUMNS = [
	'product_slug',
	'name_nl',
	'name_fr',
	'category',
	'status',
	'price',
	'compare_at_price',
	'material_nl',
	'material_fr',
	'description_nl',
	'description_fr',
	'tags',
	'featured',
	'sku',
	'metal',
	'size',
	'stock',
	'price_override',
	'low_stock_threshold'
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export const MAX_IMPORT_ROWS = 5000;

const CSV_OPTS = { delimiter: ';', bom: true, guardFormulas: true } as const;

export function templateCsv(): string {
	return recordsToCsv(IMPORT_COLUMNS, [
		{
			product_slug: 'demo-voorbeeld-ring',
			name_nl: 'DEMO Voorbeeldring',
			name_fr: 'DEMO Bague exemple',
			category: 'rings',
			status: 'draft',
			price: '49,95',
			compare_at_price: '',
			material_nl: '18k verguld edelstaal',
			material_fr: 'Acier inoxydable plaqué or 18k',
			description_nl: '',
			description_fr: '',
			tags: 'klaver, rood',
			featured: 'nee',
			sku: 'DEMO-VOORBEELD-RING-GO-52',
			metal: 'gold',
			size: '52',
			stock: '5',
			price_override: '',
			low_stock_threshold: '2'
		}
	], CSV_OPTS);
}

// ── Parsing (pure) ───────────────────────────────────────────────────────────────
export interface ProductFields {
	nameNl?: string;
	nameFr?: string;
	categoryKey?: string;
	status?: ProductStatus;
	price?: number;
	compareAtPrice?: number | null;
	materialNl?: string;
	materialFr?: string;
	descriptionNl?: string;
	descriptionFr?: string;
	tags?: string[];
	featured?: boolean;
}
export interface VariantFields {
	sku: string;
	metal?: MetalValue;
	size?: string | null;
	stock?: number;
	priceOverride?: number | null;
	lowStockThreshold?: number;
}
export interface ParsedRow {
	line: number;
	slug: string;
	product: ProductFields;
	variant: VariantFields | null;
	errors: string[];
}

export interface CategoryRef {
	key: string;
	slugs: { nl: string; fr: string };
	name: I18n;
}

/** "49,95" / "49.95" / "€ 1.249,95" → cents; '' → undefined; invalid → NaN */
export function parseEuro(v: string): number | undefined {
	const s = v.replace(/[€\s]/g, '');
	if (!s) return undefined;
	if (s.includes(',') && !s.includes('.') && !/,\d{1,2}$/.test(s)) return NaN; // '4,999' is ambiguous
	const normalized = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
	const n = Number(normalized);
	return Number.isFinite(n) && n >= 0 && /^\d+(\.\d{1,2})?$/.test(normalized) ? Math.round(n * 100) : NaN;
}

const parseIntStrict = (v: string) => (/^-?\d+$/.test(v) ? Number(v) : NaN);
const BOOL_TRUE = new Set(['1', 'ja', 'j', 'yes', 'y', 'true', 'oui', 'waar', 'x']);
const BOOL_FALSE = new Set(['0', 'nee', 'n', 'no', 'false', 'non', 'onwaar']);
const STATUS_ALIASES: Record<string, ProductStatus> = {
	draft: 'draft',
	concept: 'draft',
	active: 'active',
	actief: 'active',
	archived: 'archived',
	gearchiveerd: 'archived'
};
const METAL_ALIASES: Record<string, MetalValue> = {
	gold: 'gold',
	goud: 'gold',
	or: 'gold',
	rosegold: 'rosegold',
	'rose-gold': 'rosegold',
	'rosé goud': 'rosegold',
	rosegoud: 'rosegold',
	rosé: 'rosegold',
	silver: 'silver',
	zilver: 'silver',
	argent: 'silver'
};

export function resolveCategory(value: string, cats: CategoryRef[]): string | undefined {
	const v = value.trim().toLowerCase();
	return cats.find((c) => c.key === v || c.slugs.nl === v || c.slugs.fr === v || c.name.nl.toLowerCase() === v || c.name.fr?.toLowerCase() === v)?.key;
}

export function parseImportRecord(rec: Partial<Record<string, string>>, line: number, cats: CategoryRef[]): ParsedRow {
	const errors: string[] = [];
	const get = (k: ImportColumn) => (rec[k] ?? '').trim();
	const slug = get('product_slug').toLowerCase();
	if (!slug) errors.push('product_slug is verplicht');
	else if (!slugSchema.safeParse(slug).success) errors.push(`Ongeldige product_slug “${slug}” (kleine letters, cijfers, koppeltekens)`);

	const product: ProductFields = {};
	if (get('name_nl')) product.nameNl = get('name_nl').slice(0, 160);
	if (get('name_fr')) product.nameFr = get('name_fr').slice(0, 160);
	if (get('category')) {
		const key = resolveCategory(get('category'), cats);
		if (key) product.categoryKey = key;
		else errors.push(`Onbekende categorie “${get('category')}”`);
	}
	if (get('status')) {
		const st = STATUS_ALIASES[get('status').toLowerCase()];
		if (st && (PRODUCT_STATUSES as readonly string[]).includes(st)) product.status = st;
		else errors.push(`Ongeldige status “${get('status')}” (draft, active, archived)`);
	}
	const price = parseEuro(get('price'));
	if (price !== undefined) {
		if (Number.isNaN(price)) errors.push(`Ongeldige prijs “${get('price')}”`);
		else product.price = price;
	}
	const cap = get('compare_at_price');
	if (cap === '-' || cap === '0') product.compareAtPrice = null;
	else if (cap) {
		const c = parseEuro(cap);
		if (c === undefined || Number.isNaN(c)) errors.push(`Ongeldige van-prijs “${cap}”`);
		else product.compareAtPrice = c;
	}
	if (get('material_nl')) product.materialNl = get('material_nl').slice(0, 200);
	if (get('material_fr')) product.materialFr = get('material_fr').slice(0, 200);
	if (get('description_nl')) product.descriptionNl = get('description_nl').slice(0, 10_000);
	if (get('description_fr')) product.descriptionFr = get('description_fr').slice(0, 10_000);
	if (get('tags')) product.tags = parseTags(get('tags').replace(/\|/g, ','));
	if (get('featured')) {
		const f = get('featured').toLowerCase();
		if (BOOL_TRUE.has(f)) product.featured = true;
		else if (BOOL_FALSE.has(f)) product.featured = false;
		else errors.push(`Ongeldige waarde voor featured “${get('featured')}” (ja/nee)`);
	}

	let variant: VariantFields | null = null;
	const sku = get('sku').toUpperCase();
	if (sku) {
		variant = { sku };
		if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku) || sku.length > 64) errors.push(`Ongeldige SKU “${sku}”`);
		if (get('metal')) {
			const m = METAL_ALIASES[get('metal').toLowerCase()];
			if (m && (METALS as readonly string[]).includes(m)) variant.metal = m;
			else errors.push(`Ongeldig metaal “${get('metal')}” (gold, rosegold, silver)`);
		}
		if (get('size')) variant.size = get('size').slice(0, 16);
		if (get('stock')) {
			const s = parseIntStrict(get('stock'));
			if (Number.isNaN(s)) errors.push(`Ongeldige voorraad “${get('stock')}”`);
			else if (s < 0) errors.push('Voorraad kan niet negatief zijn');
			else variant.stock = s;
		}
		const po = get('price_override');
		if (po === '-') variant.priceOverride = null;
		else if (po) {
			const c = parseEuro(po);
			if (c === undefined || Number.isNaN(c)) errors.push(`Ongeldige prijs-override “${po}”`);
			else variant.priceOverride = c;
		}
		if (get('low_stock_threshold')) {
			const t = parseIntStrict(get('low_stock_threshold'));
			if (Number.isNaN(t) || t < 0) errors.push(`Ongeldige drempel “${get('low_stock_threshold')}”`);
			else variant.lowStockThreshold = t;
		}
	} else if (get('stock') || get('metal') || get('size')) {
		errors.push('SKU ontbreekt voor deze variant');
	}
	return { line, slug, product, variant, errors };
}

// ── Plan (pure) ──────────────────────────────────────────────────────────────────
export interface ImportLookup {
	categories: CategoryRef[];
	/** existing products by slug */
	products: Map<string, { id: string; status: ProductStatus; hasImage: boolean; variantCount: number }>;
	/** existing variants by SKU */
	variants: Map<string, { id: string; productSlug: string; stock: number }>;
}

export type RowAction = 'create' | 'update' | 'error';
export interface RowPlan {
	line: number;
	slug: string;
	sku: string | null;
	action: RowAction;
	productAction: 'create' | 'update' | 'none';
	variantAction: 'create' | 'update' | 'none';
	stockDelta: number;
	errors: string[];
	warnings: string[];
}
export interface ProductPlan {
	slug: string;
	exists: boolean;
	fields: ProductFields;
	errors: string[];
	warnings: string[];
	rows: ParsedRow[];
}
export interface ImportPlan {
	rows: RowPlan[];
	products: ProductPlan[];
	summary: { rows: number; create: number; update: number; errors: number; productsCreate: number; productsUpdate: number };
}

export function planImport(parsed: ParsedRow[], lookup: ImportLookup): ImportPlan {
	const groups = new Map<string, ProductPlan>();
	const seenSku = new Map<string, number>();
	const rowErrors = new Map<number, string[]>();
	const pushErr = (line: number, msg: string) => rowErrors.set(line, [...(rowErrors.get(line) ?? []), msg]);

	for (const r of parsed) {
		if (r.errors.length) r.errors.forEach((e) => pushErr(r.line, e));
		if (!r.slug) continue;
		let g = groups.get(r.slug);
		if (!g) {
			g = { slug: r.slug, exists: lookup.products.has(r.slug), fields: {}, errors: [], warnings: [], rows: [] };
			groups.set(r.slug, g);
		}
		g.rows.push(r);
		for (const [k, v] of Object.entries(r.product) as [keyof ProductFields, never][]) if (g.fields[k] === undefined) g.fields[k] = v;
		if (r.variant) {
			const prevLine = seenSku.get(r.variant.sku);
			if (prevLine !== undefined) pushErr(r.line, `SKU ${r.variant.sku} komt al voor op regel ${prevLine}`);
			else seenSku.set(r.variant.sku, r.line);
			const existing = lookup.variants.get(r.variant.sku);
			if (existing && existing.productSlug !== r.slug) pushErr(r.line, `SKU ${r.variant.sku} hoort bij product “${existing.productSlug}”`);
		}
	}

	for (const g of groups.values()) {
		const existing = lookup.products.get(g.slug);
		if (!existing) {
			if (!g.fields.nameNl) g.errors.push('name_nl is verplicht voor een nieuw product');
			if (!g.fields.categoryKey) g.errors.push('category is verplicht voor een nieuw product');
			if (g.fields.price === undefined) g.errors.push('price is verplicht voor een nieuw product');
			if (g.fields.status === 'active') {
				g.warnings.push('Nieuw product wordt als concept aangemaakt: voeg eerst foto’s toe in de productfiche');
				g.fields.status = 'draft';
			}
		} else if (g.fields.status === 'active' && existing.status !== 'active') {
			const newVariants = g.rows.filter((r) => r.variant && !lookup.variants.has(r.variant.sku)).length;
			if (!existing.hasImage) g.errors.push('Kan niet activeren: product heeft geen foto met alt-tekst');
			if (existing.variantCount + newVariants === 0) g.errors.push('Kan niet activeren: product heeft geen varianten');
		}
		const price = g.fields.price;
		const cap = g.fields.compareAtPrice;
		if (price !== undefined && cap != null && cap <= price) g.errors.push('compare_at_price moet hoger zijn dan price');
	}

	const rows: RowPlan[] = parsed.map((r) => {
		const g = r.slug ? groups.get(r.slug) : undefined;
		const errors = [...(rowErrors.get(r.line) ?? []), ...(g?.errors ?? [])];
		const existingVariant = r.variant ? lookup.variants.get(r.variant.sku) : undefined;
		const isFirst = g?.rows[0] === r;
		const productAction = !g ? 'none' : g.exists ? (isFirst ? 'update' : 'none') : isFirst ? 'create' : 'none';
		const variantAction = !r.variant ? 'none' : existingVariant ? 'update' : 'create';
		const stockDelta = r.variant?.stock !== undefined ? r.variant.stock - (existingVariant?.stock ?? 0) : 0;
		const action: RowAction = errors.length ? 'error' : variantAction === 'create' || productAction === 'create' ? 'create' : 'update';
		return {
			line: r.line,
			slug: r.slug,
			sku: r.variant?.sku ?? null,
			action,
			productAction,
			variantAction,
			stockDelta,
			errors,
			warnings: isFirst ? (g?.warnings ?? []) : []
		};
	});
	const summary = {
		rows: rows.length,
		create: rows.filter((r) => r.action === 'create').length,
		update: rows.filter((r) => r.action === 'update').length,
		errors: rows.filter((r) => r.action === 'error').length,
		productsCreate: [...groups.values()].filter((g) => !g.exists && !g.errors.length).length,
		productsUpdate: [...groups.values()].filter((g) => g.exists && !g.errors.length).length
	};
	return { rows, products: [...groups.values()], summary };
}

// ── DB glue ──────────────────────────────────────────────────────────────────────
export class ImportError extends Error {}

export function parseImportCsv(text: string, cats: CategoryRef[]): ParsedRow[] {
	let parsed: ReturnType<typeof parseCsvRecords>;
	try {
		parsed = parseCsvRecords(text);
	} catch (e) {
		if (e instanceof CsvError) throw new ImportError(`CSV kon niet gelezen worden: ${e.message}`);
		throw e;
	}
	const missing = ['product_slug', 'sku'].filter((c) => !parsed.headers.includes(c));
	if (missing.length) throw new ImportError(`Kolommen ontbreken: ${missing.join(', ')}. Gebruik het sjabloon.`);
	if (!parsed.records.length) throw new ImportError('Het bestand bevat geen rijen');
	if (parsed.records.length > MAX_IMPORT_ROWS) throw new ImportError(`Maximaal ${MAX_IMPORT_ROWS} rijen per import`);
	return parsed.records.map((rec, i) => parseImportRecord(rec, i + 2, cats));
}

export async function loadLookup(db: Executor, parsed: ParsedRow[]): Promise<ImportLookup> {
	const slugs = [...new Set(parsed.map((r) => r.slug).filter(Boolean))];
	const skus = [...new Set(parsed.map((r) => r.variant?.sku).filter((s): s is string => !!s))];
	const cats = await db.select({ key: categories.key, slugs: categories.slugs, name: categories.name }).from(categories);
	const prods = slugs.length
		? await db
				.select({
					id: products.id,
					slug: products.slug,
					status: products.status,
					hasImage: sql<boolean>`exists (select 1 from product_images pi where pi.product_id = "products"."id" and coalesce(pi.alt->>'nl','') <> '')`,
					variantCount: sql<number>`(select count(*) from variants v where v.product_id = "products"."id")::int`
				})
				.from(products)
				.where(inArray(products.slug, slugs))
		: [];
	const vars = skus.length
		? await db
				.select({ id: variants.id, sku: variants.sku, stock: variants.stock, productSlug: products.slug })
				.from(variants)
				.innerJoin(products, eq(products.id, variants.productId))
				.where(inArray(variants.sku, skus))
		: [];
	return {
		categories: cats,
		products: new Map(prods.map((p) => [p.slug, { id: p.id, status: p.status, hasImage: p.hasImage, variantCount: p.variantCount }])),
		variants: new Map(vars.map((v) => [v.sku, { id: v.id, productSlug: v.productSlug, stock: v.stock }]))
	};
}

export async function categoryRefs(db: Executor) {
	return db.select({ key: categories.key, slugs: categories.slugs, name: categories.name }).from(categories);
}

/** Dry run: parse + plan, no writes. */
export async function dryRun(db: Executor, text: string) {
	const parsed = parseImportCsv(text, await categoryRefs(db));
	return planImport(parsed, await loadLookup(db, parsed));
}

export interface CommitResult {
	rows: RowPlan[];
	summary: ImportPlan['summary'];
}

/**
 * Re-plans against the current DB state, then applies every product group in its own savepoint.
 * Rows with errors are skipped and reported; a DB failure inside a group marks that group's rows.
 */
export async function commitImport(db: Executor, actor: Actor, text: string): Promise<CommitResult> {
	const cats = await categoryRefs(db);
	const parsed = parseImportCsv(text, cats);
	const lookup = await loadLookup(db, parsed);
	const plan = planImport(parsed, lookup);
	const byLine = new Map(plan.rows.map((r) => [r.line, r]));
	const catIds = new Map((await db.select({ id: categories.id, key: categories.key }).from(categories)).map((c) => [c.key, c.id]));
	const actorName = actor.admin?.name ?? null;

	for (const g of plan.products) {
		const okRows = g.rows.filter((r) => byLine.get(r.line)!.action !== 'error');
		if (g.errors.length || !okRows.length) continue;
		try {
			await db.transaction(async (sp) => {
				const f = g.fields;
				let productId: string;
				const existing = lookup.products.get(g.slug);
				const i18n = (nl?: string, fr?: string, prev?: I18n | null): I18n | null | undefined =>
					nl === undefined && fr === undefined ? undefined : { ...(prev ?? { nl: '' }), ...(nl !== undefined ? { nl } : {}), ...(fr !== undefined ? { fr } : {}) };
				if (existing) {
					const [cur] = await sp.select().from(products).where(eq(products.id, existing.id)).for('update');
					productId = cur.id;
					const set: Partial<typeof products.$inferInsert> = {};
					const name = i18n(f.nameNl, f.nameFr, cur.name);
					if (name) set.name = name;
					const material = i18n(f.materialNl, f.materialFr, cur.material);
					if (material !== undefined) set.material = material;
					const description = i18n(f.descriptionNl, f.descriptionFr, cur.description);
					if (description !== undefined) set.description = description;
					if (f.categoryKey) set.categoryId = catIds.get(f.categoryKey)!;
					if (f.status) set.status = f.status;
					if (f.price !== undefined) set.price = f.price;
					if (f.compareAtPrice !== undefined) set.compareAtPrice = f.compareAtPrice;
					if (f.tags) set.tags = f.tags;
					if (f.featured !== undefined) set.featured = f.featured;
					if (Object.keys(set).length) await sp.update(products).set({ ...set, updatedAt: new Date() }).where(eq(products.id, productId));
					if (f.price !== undefined && f.price !== cur.price) await sp.insert(priceHistory).values({ productId, price: f.price });
				} else {
					const [row] = await sp
						.insert(products)
						.values({
							slug: g.slug,
							name: f.nameFr ? { nl: f.nameNl!, fr: f.nameFr } : { nl: f.nameNl! },
							material: i18n(f.materialNl, f.materialFr) ?? null,
							description: i18n(f.descriptionNl, f.descriptionFr) ?? null,
							categoryId: catIds.get(f.categoryKey!)!,
							status: f.status ?? 'draft',
							price: f.price!,
							compareAtPrice: f.compareAtPrice ?? null,
							tags: f.tags ?? [],
							featured: f.featured ?? false
						})
						.returning({ id: products.id });
					productId = row.id;
					await sp.insert(priceHistory).values({ productId, price: f.price! });
				}
				const [{ maxPos }] = await sp
					.select({ maxPos: sql<number>`coalesce(max(${variants.position}), -1)::int` })
					.from(variants)
					.where(eq(variants.productId, productId));
				let pos = maxPos + 1;
				for (const r of okRows) {
					if (!r.variant) continue;
					const v = r.variant;
					const ex = lookup.variants.get(v.sku);
					try {
						if (ex) {
							const set: Partial<typeof variants.$inferInsert> = {};
							if (v.metal) set.metal = v.metal;
							if (v.size !== undefined) set.size = v.size;
							if (v.priceOverride !== undefined) set.priceOverride = v.priceOverride;
							if (v.lowStockThreshold !== undefined) set.lowStockThreshold = v.lowStockThreshold;
							if (Object.keys(set).length) await sp.update(variants).set({ ...set, updatedAt: new Date() }).where(eq(variants.id, ex.id));
							if (v.stock !== undefined) {
								const [{ stock }] = await sp.select({ stock: variants.stock }).from(variants).where(eq(variants.id, ex.id)).for('update');
								if (v.stock !== stock)
									await applyStockDelta(sp, { variantId: ex.id, delta: v.stock - stock, reason: 'import', note: `CSV regel ${r.line}`, actor: actorName });
							}
						} else {
							const [row] = await sp
								.insert(variants)
								.values({
									productId,
									sku: v.sku,
									metal: v.metal ?? 'gold',
									size: v.size ?? null,
									priceOverride: v.priceOverride ?? null,
									lowStockThreshold: v.lowStockThreshold ?? 2,
									stock: 0,
									position: pos++
								})
								.returning({ id: variants.id });
							if (v.stock)
								await applyStockDelta(sp, { variantId: row.id, delta: v.stock, reason: 'import', note: `CSV regel ${r.line}`, actor: actorName });
						}
					} catch (e) {
						if (e instanceof StockError) throw new RowFailure(r.line, e.message);
						throw e;
					}
				}
			});
		} catch (e) {
			const msg = e instanceof RowFailure ? e.message : dbMessage(e);
			for (const r of okRows) {
				const plan = byLine.get(r.line)!;
				plan.action = 'error';
				plan.errors.push(e instanceof RowFailure && e.line !== r.line ? 'Product overgeslagen door fout op een andere regel' : msg);
			}
		}
	}

	const rows = plan.rows;
	const summary = {
		...plan.summary,
		create: rows.filter((r) => r.action === 'create').length,
		update: rows.filter((r) => r.action === 'update').length,
		errors: rows.filter((r) => r.action === 'error').length
	};
	await audit(db, actor, { action: 'import', entity: 'product', entityId: null, diff: summary });
	return { rows, summary };
}

class RowFailure extends Error {
	constructor(
		public line: number,
		message: string
	) {
		super(message);
	}
}

function dbMessage(e: unknown): string {
	const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
	const code = err.code ?? err.cause?.code;
	const constraint = err.constraint ?? err.cause?.constraint;
	if (code === '23505') return constraint?.includes('sku') ? 'SKU bestaat al' : constraint?.includes('slug') ? 'Slug bestaat al' : 'Dubbele waarde';
	if (code === '23514') return 'Waarde niet toegelaten (bv. negatieve voorraad of prijs)';
	console.error('import row failed', e);
	return 'Onverwachte fout bij het opslaan van deze rij';
}

// ── Export ───────────────────────────────────────────────────────────────────────
export async function exportCsv(db: Executor): Promise<string> {
	const rows = await db
		.select({
			slug: products.slug,
			name: products.name,
			category: categories.key,
			status: products.status,
			price: products.price,
			compareAtPrice: products.compareAtPrice,
			material: products.material,
			description: products.description,
			tags: products.tags,
			featured: products.featured,
			sku: variants.sku,
			metal: variants.metal,
			size: variants.size,
			stock: variants.stock,
			priceOverride: variants.priceOverride,
			lowStockThreshold: variants.lowStockThreshold
		})
		.from(products)
		.innerJoin(categories, eq(categories.id, products.categoryId))
		.leftJoin(variants, eq(variants.productId, products.id))
		.orderBy(asc(products.slug), asc(variants.position), asc(variants.sku));
	return recordsToCsv(
		IMPORT_COLUMNS,
		rows.map((r) => ({
			product_slug: r.slug,
			name_nl: r.name.nl,
			name_fr: r.name.fr ?? '',
			category: r.category,
			status: r.status,
			price: centsToInput(r.price),
			compare_at_price: centsToInput(r.compareAtPrice),
			material_nl: r.material?.nl ?? '',
			material_fr: r.material?.fr ?? '',
			description_nl: r.description?.nl ?? '',
			description_fr: r.description?.fr ?? '',
			tags: r.tags.join(', '),
			featured: r.featured ? 'ja' : 'nee',
			sku: r.sku ?? '',
			metal: r.metal ?? '',
			size: r.size ?? '',
			stock: r.stock ?? '',
			price_override: centsToInput(r.priceOverride),
			low_stock_threshold: r.lowStockThreshold ?? ''
		})),
		CSV_OPTS
	);
}

