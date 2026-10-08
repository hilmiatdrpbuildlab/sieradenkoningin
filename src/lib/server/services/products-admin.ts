/**
 * Admin write side for products (P1-01/P1-02): list query, form model, save (with images, variants,
 * relations and price history), duplicate and archive. Storefront reads live in catalog.ts.
 */
import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import {
	categories,
	media,
	priceHistory,
	productImages,
	productRelations,
	products,
	variants,
	type Gpsr,
	type I18n,
	type Seo
} from '../db/schema.ts';
import { audit, diffObjects } from './audit.ts';
import { ensureMedia, MediaError } from './media.ts';
import { applyStockDelta, StockError } from './inventory.ts';
import { activationErrors, emptyI18n, type I18nModel, type ProductFormModel, type ProductInput } from '#lib/schemas/product.ts';
import { centsToInput } from '#lib/utils/format.ts';
import { uniqueSlug } from '#lib/utils/slug.ts';

type Actor = Pick<App.Locals, 'admin' | 'ip'>;

/** Thrown by save(): field errors keyed by dotted path, rendered inline by the form. */
export class ValidationError extends Error {
	constructor(public errors: Record<string, string[]>) {
		super('validation');
	}
}

// ── List ─────────────────────────────────────────────────────────────────────────
export const PRODUCT_SORTS = ['name', 'price', 'stock', 'status', 'updated', 'created'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductListParams {
	q?: string;
	status?: 'draft' | 'active' | 'archived' | '';
	category?: string;
	sort?: ProductSort;
	dir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

const stockSql = sql<number>`coalesce((select sum(v.stock) from variants v where v.product_id = "products"."id"), 0)::int`;
const variantCountSql = sql<number>`(select count(*) from variants v where v.product_id = "products"."id")::int`;
const primaryImageSql = sql<string | null>`(select m.storage_key from product_images pi join media m on m.id = pi.media_id
	where pi.product_id = "products"."id" order by pi.position limit 1)`;

export async function listProducts(db: Executor, p: ProductListParams = {}) {
	const pageSize = p.pageSize ?? 25;
	const page = Math.max(1, p.page ?? 1);
	const conds: (SQL | undefined)[] = [];
	if (p.q) {
		const like = `%${p.q}%`;
		conds.push(
			or(
				sql`sk_unaccent(${products.name}->>'nl') ilike sk_unaccent(${like})`,
				sql`sk_unaccent(coalesce(${products.name}->>'fr','')) ilike sk_unaccent(${like})`,
				ilike(products.slug, like),
				sql`exists (select 1 from variants v where v.product_id = "products"."id" and v.sku ilike ${like})`
			)
		);
	}
	if (p.status) conds.push(eq(products.status, p.status));
	else conds.push(ne(products.status, 'archived'));
	if (p.category) conds.push(eq(products.categoryId, p.category));
	const where = and(...conds);
	const dirFn = p.dir === 'asc' ? asc : desc;
	const sortCol = {
		name: sql`${products.name}->>'nl'`,
		price: products.price,
		stock: stockSql,
		status: products.status,
		updated: products.updatedAt,
		created: products.createdAt
	}[p.sort ?? 'updated'];

	const [rows, [{ n }]] = await Promise.all([
		db
			.select({
				id: products.id,
				name: sql<string>`${products.name}->>'nl'`,
				slug: products.slug,
				status: products.status,
				price: products.price,
				compareAtPrice: products.compareAtPrice,
				category: sql<string>`${categories.name}->>'nl'`,
				stock: stockSql,
				variants: variantCountSql,
				image: primaryImageSql,
				updated: products.updatedAt
			})
			.from(products)
			.innerJoin(categories, eq(categories.id, products.categoryId))
			.where(where)
			.orderBy(dirFn(sortCol), desc(products.id))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db.select({ n: sql<number>`count(*)::int` }).from(products).where(where)
	]);
	return { rows, total: n, page, pageSize };
}

export async function categoryOptions(db: Executor) {
	const rows = await db
		.select({ id: categories.id, key: categories.key, name: categories.name })
		.from(categories)
		.orderBy(asc(categories.position));
	return rows.map((c) => ({ value: c.id, key: c.key, label: c.name.nl }));
}

/** Lightweight list for relation pickers / manual collections. */
export async function productOptions(db: Executor, urlFor: (key: string) => string, excludeId?: string) {
	const rows = await db
		.select({ id: products.id, name: sql<string>`${products.name}->>'nl'`, slug: products.slug, status: products.status, image: primaryImageSql })
		.from(products)
		.where(excludeId ? and(ne(products.id, excludeId), ne(products.status, 'archived')) : ne(products.status, 'archived'))
		.orderBy(sql`${products.name}->>'nl'`);
	return rows.map((r) => ({ ...r, image: r.image ? urlFor(r.image) : null }));
}

export async function stoneColorOptions(db: Executor) {
	const rows = await db
		.selectDistinct({ c: products.stoneColor })
		.from(products)
		.where(sql`${products.stoneColor} is not null`)
		.orderBy(products.stoneColor);
	return rows.map((r) => r.c!).filter(Boolean);
}

// ── Form model ───────────────────────────────────────────────────────────────────
const toModel = (v: I18n | null | undefined): I18nModel => ({ nl: v?.nl ?? '', fr: v?.fr ?? '' });

export async function loadProduct(db: Executor, id: string) {
	const [product] = await db.select().from(products).where(eq(products.id, id));
	if (!product) return null;
	const [images, vars, rels] = await Promise.all([
		db
			.select({ id: productImages.id, mediaId: productImages.mediaId, alt: productImages.alt, key: media.storageKey, width: media.width, height: media.height, bytes: media.bytes })
			.from(productImages)
			.innerJoin(media, eq(media.id, productImages.mediaId))
			.where(eq(productImages.productId, id))
			.orderBy(asc(productImages.position)),
		db.select().from(variants).where(eq(variants.productId, id)).orderBy(asc(variants.position), asc(variants.sku)),
		db
			.select({ relatedId: productRelations.relatedId, kind: productRelations.kind })
			.from(productRelations)
			.where(eq(productRelations.productId, id))
			.orderBy(asc(productRelations.position))
	]);
	return { product, images, variants: vars, relations: rels };
}

export function modelFromProduct(data: NonNullable<Awaited<ReturnType<typeof loadProduct>>>, urlFor: (key: string) => string): ProductFormModel {
	const p = data.product;
	return {
		slug: p.slug,
		name: toModel(p.name),
		description: toModel(p.description),
		meaning: toModel(p.meaning),
		care: toModel(p.care),
		material: toModel(p.material),
		categoryId: p.categoryId,
		price: centsToInput(p.price),
		compareAtPrice: centsToInput(p.compareAtPrice),
		status: p.status,
		featured: p.featured ? 'on' : undefined,
		engravable: p.engravable ? 'on' : undefined,
		badge: p.badge ?? '',
		stoneColor: p.stoneColor ?? '',
		tags: p.tags.join(', '),
		gpsr: {
			manufacturer: p.gpsr?.manufacturer ?? '',
			address: p.gpsr?.address ?? '',
			contact: p.gpsr?.contact ?? '',
			safetyInfo: toModel(p.gpsr?.safetyInfo)
		},
		seo: { title: p.seo?.title ? toModel(p.seo.title) : emptyI18n(), description: p.seo?.description ? toModel(p.seo.description) : emptyI18n() },
		images: data.images.map((i) => ({
			mediaId: i.mediaId,
			key: i.key,
			url: urlFor(i.key),
			width: i.width ? String(i.width) : '',
			height: i.height ? String(i.height) : '',
			bytes: i.bytes ? String(i.bytes) : '',
			alt: toModel(i.alt)
		})),
		variants: data.variants.map((v) => ({
			id: v.id,
			sku: v.sku,
			metal: v.metal,
			size: v.size ?? '',
			stock: String(v.stock),
			priceOverride: centsToInput(v.priceOverride),
			lowStockThreshold: String(v.lowStockThreshold)
		})),
		related: data.relations.filter((r) => r.kind === 'related').map((r) => r.relatedId),
		completeSet: data.relations.filter((r) => r.kind === 'complete_set').map((r) => r.relatedId)
	};
}

/** Image urls for keys posted back after a failed save (so previews keep working). */
export function withImageUrls(model: ProductFormModel, urlFor: (key: string) => string): ProductFormModel {
	return { ...model, images: model.images.map((i) => ({ ...i, url: i.key ? urlFor(i.key) : i.url })) };
}

// ── Save ─────────────────────────────────────────────────────────────────────────
export interface ExtraImage {
	key: string;
	width: number;
	height: number;
	bytes: number;
}

/**
 * Creates (id = null) or updates a product inside the given transaction. Throws ValidationError with
 * field errors for business-rule violations (unique slug/SKU, activation rule, negative stock).
 */
export async function saveProduct(tx: Executor, actor: Actor, id: string | null, input: ProductInput, extraImages: ExtraImage[] = []) {
	const errors: Record<string, string[]> = {};
	const add = (k: string, msg: string) => (errors[k] ??= []).push(msg);

	const before = id ? (await tx.select().from(products).where(eq(products.id, id)).for('update'))[0] : undefined;
	if (id && !before) throw new ValidationError({ _: ['Product niet gevonden'] });

	// Unique slug
	const [slugClash] = await tx
		.select({ id: products.id })
		.from(products)
		.where(id ? and(eq(products.slug, input.slug), ne(products.id, id)) : eq(products.slug, input.slug));
	if (slugClash) add('slug', 'Deze slug is al in gebruik door een ander product');

	// Category exists
	const [cat] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId));
	if (!cat) add('categoryId', 'Kies een categorie');

	// Variants: ownership + SKU uniqueness across other products
	const keptVariants = input.variants.map((v, i) => ({ ...v, index: i })).filter((v) => !v.remove);
	const existingVariants = id ? await tx.select().from(variants).where(eq(variants.productId, id)) : [];
	const ownIds = new Set(existingVariants.map((v) => v.id));
	input.variants.forEach((v, i) => {
		if (v.id && !ownIds.has(v.id)) add(`variants.${i}.sku`, 'Onbekende variant');
	});
	const skus = keptVariants.map((v) => v.sku).filter(Boolean);
	if (skus.length) {
		const clashes = await tx
			.select({ sku: variants.sku })
			.from(variants)
			.where(id ? and(inArray(variants.sku, skus), ne(variants.productId, id)) : inArray(variants.sku, skus));
		const taken = new Set(clashes.map((c) => c.sku));
		for (const v of keptVariants) if (taken.has(v.sku)) add(`variants.${v.index}.sku`, 'Deze SKU bestaat al bij een ander product');
	}

	// Images: resolve media ids; keep the posted order (or explicit positions without JS)
	const keptImages = input.images
		.map((im, i) => ({ ...im, index: i }))
		.filter((im) => !im.remove)
		.sort((a, b) => (Number.isFinite(a.position) && Number.isFinite(b.position) ? a.position - b.position : a.index - b.index));
	const resolved: { mediaId: string; alt: I18n; index: number }[] = [];
	for (const im of keptImages) {
		try {
			let mediaId = im.mediaId;
			if (mediaId) {
				const [m] = await tx.select({ id: media.id, deletedAt: media.deletedAt }).from(media).where(eq(media.id, mediaId));
				if (!m || m.deletedAt) throw new MediaError('Afbeelding bestaat niet meer');
			} else {
				mediaId = await ensureMedia(tx, { key: im.key!, width: im.width, height: im.height, bytes: im.bytes, alt: im.alt });
			}
			resolved.push({ mediaId, alt: im.alt, index: im.index });
		} catch (e) {
			if (e instanceof MediaError) add(`images.${im.index}.key`, e.message);
			else throw e;
		}
	}
	for (const x of extraImages) {
		resolved.push({ mediaId: await ensureMedia(tx, { key: x.key, width: x.width, height: x.height, bytes: x.bytes }), alt: { nl: '' }, index: -1 });
	}

	Object.assign(
		errors,
		activationErrors({
			status: input.status,
			images: resolved.map((r) => ({ alt: r.alt })),
			variants: keptVariants
		})
	);
	if (Object.keys(errors).length) throw new ValidationError(errors);

	// Product row
	const values = {
		slug: input.slug,
		name: input.name.fr ? { nl: input.name.nl, fr: input.name.fr } : { nl: input.name.nl },
		description: input.description,
		meaning: input.meaning,
		care: input.care,
		material: input.material,
		categoryId: input.categoryId,
		status: input.status,
		price: input.price,
		compareAtPrice: input.compareAtPrice,
		featured: input.featured,
		engravable: input.engravable,
		badge: input.badge,
		stoneColor: input.stoneColor,
		tags: input.tags,
		gpsr: cleanGpsr(input.gpsr),
		seo: cleanSeo(input.seo)
	};
	let productId: string;
	if (before) {
		productId = before.id;
		await tx
			.update(products)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(products.id, productId));
		if (before.price !== input.price) await tx.insert(priceHistory).values({ productId, price: input.price });
	} else {
		const [row] = await tx.insert(products).values(values).returning({ id: products.id });
		productId = row.id;
		await tx.insert(priceHistory).values({ productId, price: input.price });
	}

	// Images (replace the ordered list; media rows themselves are kept for the library)
	await tx.delete(productImages).where(eq(productImages.productId, productId));
	if (resolved.length) {
		await tx.insert(productImages).values(resolved.map((r, position) => ({ productId, mediaId: r.mediaId, alt: r.alt, position })));
		// Seed the library alt text from the first usage when the media item has none yet.
		for (const r of resolved)
			if (r.alt.nl)
				await tx
					.update(media)
					.set({ alt: r.alt })
					.where(and(eq(media.id, r.mediaId), sql`coalesce(${media.alt}->>'nl','') = ''`));
	}

	// Variants
	const actorName = actor.admin?.name ?? null;
	const removedIds = input.variants.filter((v) => v.remove && v.id).map((v) => v.id!);
	if (removedIds.length) await tx.delete(variants).where(and(eq(variants.productId, productId), inArray(variants.id, removedIds)));
	const byId = new Map(existingVariants.map((v) => [v.id, v]));
	// Free SKUs that change hands within this product (A↔B swap) before rewriting them.
	const renamed = keptVariants.filter((v) => v.id && byId.get(v.id)!.sku !== v.sku);
	for (const v of renamed) await tx.update(variants).set({ sku: `__tmp_${v.id}` }).where(eq(variants.id, v.id!));
	let position = 0;
	for (const v of keptVariants) {
		const common = { sku: v.sku, metal: v.metal, size: v.size, priceOverride: v.priceOverride, lowStockThreshold: v.lowStockThreshold, position: position++ };
		if (v.id) {

			await tx
				.update(variants)
				.set({ ...common, updatedAt: new Date() })
				.where(eq(variants.id, v.id));
			const [{ stock: current }] = await tx.select({ stock: variants.stock }).from(variants).where(eq(variants.id, v.id)).for('update');
			if (v.stock !== current) {
				try {
					await applyStockDelta(tx, { variantId: v.id, delta: v.stock - current, reason: 'adjust', note: 'Productformulier', actor: actorName });
				} catch (e) {
					if (e instanceof StockError) throw new ValidationError({ [`variants.${v.index}.stock`]: [e.message] });
					throw e;
				}
			}
		} else {
			const [row] = await tx
				.insert(variants)
				.values({ ...common, productId, stock: 0 })
				.returning({ id: variants.id });
			if (v.stock > 0) await applyStockDelta(tx, { variantId: row.id, delta: v.stock, reason: 'adjust', note: 'Nieuwe variant', actor: actorName });
		}
	}

	// Relations
	await tx.delete(productRelations).where(eq(productRelations.productId, productId));
	const rel = [
		...input.related.filter((r) => r !== productId).map((relatedId, position) => ({ productId, relatedId, kind: 'related' as const, position })),
		...input.completeSet.filter((r) => r !== productId).map((relatedId, position) => ({ productId, relatedId, kind: 'complete_set' as const, position }))
	];
	if (rel.length) {
		const existing = await tx
			.select({ id: products.id })
			.from(products)
			.where(inArray(products.id, [...new Set(rel.map((r) => r.relatedId))]));
		const ok = new Set(existing.map((e) => e.id));
		const valid = rel.filter((r) => ok.has(r.relatedId));
		if (valid.length) await tx.insert(productRelations).values(valid);
	}

	const after = { ...values, images: resolved.length, variants: keptVariants.length, related: input.related.length, completeSet: input.completeSet.length };
	await audit(tx, actor, {
		action: before ? 'update' : 'create',
		entity: 'product',
		entityId: productId,
		diff: before ? { ...diffObjects(before as unknown as Record<string, unknown>, values), images: resolved.length, variants: keptVariants.length } : after
	});
	return productId;
}

function cleanGpsr(g: ProductInput['gpsr']): Gpsr | null {
	if (!g) return null;
	const out: Gpsr = {};
	if (g.manufacturer) out.manufacturer = g.manufacturer;
	if (g.address) out.address = g.address;
	if (g.contact) out.contact = g.contact;
	if (g.safetyInfo) out.safetyInfo = g.safetyInfo;
	return Object.keys(out).length ? out : null;
}

function cleanSeo(s: ProductInput['seo']): Seo | null {
	if (!s) return null;
	const out: Seo = {};
	if (s.title) out.title = s.title;
	if (s.description) out.description = s.description;
	return Object.keys(out).length ? out : null;
}

// ── Duplicate / archive ──────────────────────────────────────────────────────────
export async function duplicateProduct(tx: Executor, actor: Actor, id: string): Promise<string> {
	const data = await loadProduct(tx, id);
	if (!data) throw new ValidationError({ _: ['Product niet gevonden'] });
	const p = data.product;
	const slug = await uniqueSlug(p.slug, async (s) => (await tx.select({ id: products.id }).from(products).where(eq(products.slug, s))).length > 0, 'kopie');
	const [row] = await tx
		.insert(products)
		.values({
			slug,
			name: { ...p.name, nl: `${p.name.nl} (kopie)`, ...(p.name.fr ? { fr: `${p.name.fr} (copie)` } : {}) },
			description: p.description,
			meaning: p.meaning,
			care: p.care,
			material: p.material,
			stoneColor: p.stoneColor,
			tags: p.tags,
			badge: p.badge,
			categoryId: p.categoryId,
			status: 'draft',
			price: p.price,
			compareAtPrice: p.compareAtPrice,
			featured: false,
			engravable: p.engravable,
			seo: null,
			gpsr: p.gpsr
		})
		.returning({ id: products.id });
	const newId = row.id;
	await tx.insert(priceHistory).values({ productId: newId, price: p.price });
	if (data.images.length)
		await tx.insert(productImages).values(data.images.map((im, position) => ({ productId: newId, mediaId: im.mediaId, alt: im.alt, position })));
	for (const v of data.variants) {
		const sku = await uniqueSku(tx, `${v.sku}-K`);
		await tx.insert(variants).values({ productId: newId, sku, metal: v.metal, size: v.size, priceOverride: v.priceOverride, stock: 0, lowStockThreshold: v.lowStockThreshold, position: v.position });
	}
	if (data.relations.length)
		await tx.insert(productRelations).values(data.relations.map((r, position) => ({ productId: newId, relatedId: r.relatedId, kind: r.kind, position })));
	await audit(tx, actor, { action: 'duplicate', entity: 'product', entityId: newId, diff: { from: id, slug } });
	return newId;
}

async function uniqueSku(tx: Executor, base: string) {
	for (let n = 1; n < 1000; n++) {
		const sku = n === 1 ? base : `${base}${n}`;
		const [hit] = await tx.select({ id: variants.id }).from(variants).where(eq(variants.sku, sku));
		if (!hit) return sku;
	}
	return `${base}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function setProductStatus(tx: Executor, actor: Actor, id: string, status: 'archived' | 'draft') {
	const [before] = await tx.select({ status: products.status }).from(products).where(eq(products.id, id));
	if (!before) throw new ValidationError({ _: ['Product niet gevonden'] });
	await tx.update(products).set({ status, featured: status === 'archived' ? false : undefined, updatedAt: new Date() }).where(eq(products.id, id));
	await audit(tx, actor, { action: status === 'archived' ? 'archive' : 'restore', entity: 'product', entityId: id, diff: { status: [before.status, status] } });
}
