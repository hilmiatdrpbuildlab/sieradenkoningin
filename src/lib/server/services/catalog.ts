/**
 * Storefront catalog queries (read side). Only `active` products are ever exposed here.
 * Card rows carry everything ProductCard needs in one round-trip: first two images, metals,
 * stock, and the single variant id for quick-add.
 */
import { and, arrayOverlaps, asc, desc, eq, gte, inArray, lte, ne, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import {
	categories,
	collectionProducts,
	collections,
	media,
	orderLines,
	orders,
	priceHistory,
	productImages,
	productRelations,
	products,
	variants
} from '../db/schema.ts';
import type { CollectionRule, I18n } from '../db/schema.ts';
import {
	METALS,
	PAGE_SIZE,
	sortSizes,
	type ListingData,
	type ListingFacets,
	type ListingFilters,
	type SortKey
} from '../../components/storefront/listing.ts';
import { tr } from '../../i18n/index.ts';
import { localizeHref, type Lang } from '../../i18n/paths.ts';
import type { Metal, ProductCardData } from '../../types.ts';

export const NEW_WITHIN_DAYS = 30;

export interface CardRow {
	id: string;
	slug: string;
	name: I18n;
	material: I18n | null;
	price: number;
	compareAtPrice: number | null;
	badge: string | null;
	createdAt: Date;
	images: { key: string; alt: I18n }[] | null;
	metals: Metal[] | null;
	stock: number;
	variantCount: number;
	singleVariantId: string | null;
}

/** Column set shared by every card query. */
/** Fully-qualified outer reference: drizzle renders select-list columns unqualified, which would bind to the inner table inside correlated subqueries. */
const PID = sql.raw('"products"."id"');

export const cardColumns = {
	id: products.id,
	slug: products.slug,
	name: products.name,
	material: products.material,
	price: products.price,
	compareAtPrice: products.compareAtPrice,
	badge: products.badge,
	createdAt: products.createdAt,
	images: sql<
		{ key: string; alt: I18n }[] | null
	>`(select json_agg(json_build_object('key', m.storage_key, 'alt', pi.alt) order by pi.position) from (select * from ${productImages} where ${productImages.productId} = ${PID} order by ${productImages.position} limit 2) pi join ${media} m on m.id = pi.media_id)`,
	metals: sql<
		Metal[] | null
	>`(select array_agg(distinct v.metal::text) from ${variants} v where v.product_id = ${PID})`,
	stock: sql<number>`(select coalesce(sum(v.stock), 0)::int from ${variants} v where v.product_id = ${PID})`,
	variantCount: sql<number>`(select count(*)::int from ${variants} v where v.product_id = ${PID})`,
	singleVariantId: sql<
		string | null
	>`(select case when count(*) = 1 then min(v.id::text) end from ${variants} v where v.product_id = ${PID})`
};

export function toCard(
	row: CardRow,
	lang: Lang,
	img: (key: string, alt: string) => { src: string; srcset?: string; alt: string }
): ProductCardData {
	const isNew = Date.now() - new Date(row.createdAt).getTime() < NEW_WITHIN_DAYS * 86400_000;
	const images = (row.images ?? []).map((i) => img(i.key, tr(i.alt, lang)));
	return {
		id: row.id,
		slug: row.slug,
		href: localizeHref(`/p/${row.slug}`, lang),
		name: tr(row.name, lang),
		material: row.material ? tr(row.material, lang) : undefined,
		price: row.price,
		compareAtPrice: row.compareAtPrice,
		images: images.length ? images : [{ src: '/brand/placeholder.svg', alt: tr(row.name, lang) }],
		badge: (row.badge as ProductCardData['badge']) ?? (isNew ? 'new' : null),
		metals: row.metals ?? [],
		inStock: row.stock > 0,
		quickAddVariantId: row.variantCount === 1 && row.stock > 0 ? row.singleVariantId : null
	};
}

export const activeOnly = eq(products.status, 'active');

export async function cardsWhere(
	db: Executor,
	where: SQL | undefined,
	opts: { orderBy?: SQL[]; limit?: number; offset?: number } = {}
) {
	const q = db
		.select(cardColumns)
		.from(products)
		.where(where ? and(activeOnly, where) : activeOnly)
		.orderBy(...(opts.orderBy ?? [desc(products.featured), desc(products.createdAt)]))
		.limit(opts.limit ?? 24)
		.offset(opts.offset ?? 0);
	return (await q) as CardRow[];
}

export async function cardsByIds(db: Executor, ids: string[]) {
	if (!ids.length) return [];
	const rows = (await db
		.select(cardColumns)
		.from(products)
		.where(and(activeOnly, inArray(products.id, ids)))) as CardRow[];
	return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is CardRow => !!r);
}

export async function newArrivals(db: Executor, limit = 8) {
	return cardsWhere(db, undefined, { orderBy: [desc(products.createdAt)], limit });
}

/** Best sellers = most units sold in paid orders over the last 90 days; falls back to featured. */
export async function bestsellers(db: Executor, limit = 8) {
	const sold = await db
		.select({ productId: orderLines.productId, units: sql<number>`sum(${orderLines.qty})::int` })
		.from(orderLines)
		.innerJoin(orders, eq(orders.id, orderLines.orderId))
		.where(
			and(
				sql`${orders.paymentStatus} in ('paid','partially_refunded')`,
				sql`${orders.placedAt} > now() - interval '90 days'`
			)
		)
		.groupBy(orderLines.productId)
		.orderBy(desc(sql`sum(${orderLines.qty})`))
		.limit(limit);
	const ids = sold.map((s) => s.productId).filter((x): x is string => !!x);
	const top = await cardsByIds(db, ids);
	if (top.length >= limit) return top;
	const fill = await cardsWhere(db, ids.length ? sql`${products.id} not in ${ids}` : undefined, {
		orderBy: [desc(sql`${products.badge} = 'bestseller'`), desc(products.featured), asc(products.createdAt)],
		limit: limit - top.length
	});
	return [...top, ...fill];
}

export async function featured(db: Executor, limit = 8) {
	return cardsWhere(db, eq(products.featured, true), { limit });
}

/** SQL condition for a rule-based collection (P1-02). Unit-tested via `ruleToSql` in catalog tests. */
export function ruleCondition(rule: CollectionRule): SQL | undefined {
	const parts: SQL[] = [];
	if (rule.category)
		parts.push(sql`${products.categoryId} = (select id from ${categories} where key = ${rule.category})`);
	if (rule.tag) parts.push(sql`${rule.tag} = any(${products.tags})`);
	if (rule.newWithinDays) parts.push(sql`${products.createdAt} > now() - (${rule.newWithinDays} || ' days')::interval`);
	if (rule.onSale)
		parts.push(sql`${products.compareAtPrice} is not null and ${products.compareAtPrice} > ${products.price}`);
	if (rule.priceLt) parts.push(sql`${products.price} < ${rule.priceLt}`);
	return parts.length ? and(...parts) : undefined;
}

export async function collectionCards(db: Executor, collectionId: string, limit = 24, offset = 0) {
	const [c] = await db.select().from(collections).where(eq(collections.id, collectionId));
	if (!c) return [];
	if (c.type === 'rule')
		return cardsWhere(db, ruleCondition(c.rule ?? {}), { orderBy: [desc(products.createdAt)], limit, offset });
	const rows = await db
		.select({ id: collectionProducts.productId })
		.from(collectionProducts)
		.where(eq(collectionProducts.collectionId, collectionId))
		.orderBy(asc(collectionProducts.position))
		.limit(limit)
		.offset(offset);
	return cardsByIds(
		db,
		rows.map((r) => r.id)
	);
}

export async function categoryNav(db: Executor, lang: Lang) {
	const rows = await db.select().from(categories).orderBy(asc(categories.position));
	return rows.map((c) => ({
		id: c.id,
		key: c.key,
		label: tr(c.name, lang),
		href: `/${lang}/${c.slugs[lang]}`,
		icon: c.icon,
		slugs: c.slugs
	}));
}

// ── Listings (P1-07) ───────────────────────────────────────────────────────────
export { parseFilters, filtersToParams, activeFilterCount } from '../../components/storefront/listing.ts';
export { PAGE_SIZE };

/**
 * Parsed listing filters → SQL condition on `products` (all parts combined with AND; values
 * within one facet are OR-ed). Variant facets (metal, size, in stock) must hold for the SAME
 * variant: "gold + 52 + in stock" only matches a product with a gold size-52 variant on hand.
 */
export function filterCondition(f: ListingFilters): SQL | undefined {
	const parts: SQL[] = [];
	if (f.stone.length) parts.push(inArray(products.stoneColor, f.stone));
	if (f.min != null) parts.push(gte(products.price, f.min));
	if (f.max != null) parts.push(lte(products.price, f.max));
	const v: SQL[] = [];
	if (f.metal.length) v.push(sql`v.metal::text in ${f.metal}`);
	if (f.size.length) v.push(sql`v.size in ${f.size}`);
	if (f.stock) v.push(sql`v.stock > 0`);
	if (v.length)
		parts.push(sql`exists (select 1 from ${variants} v where v.product_id = ${PID} and ${sql.join(v, sql` and `)})`);
	return parts.length ? and(...parts) : undefined;
}

/** ORDER BY for a sort key. `featured` can be overridden (manual collections keep their curated order). */
export function sortOrder(sort: SortKey, opts: { featured?: SQL[]; relevance?: SQL } = {}): SQL[] {
	const tie = asc(products.id); // stable paging
	switch (sort) {
		case 'new':
			return [desc(products.createdAt), tie];
		case 'price_asc':
			return [asc(products.price), desc(products.createdAt), tie];
		case 'price_desc':
			return [desc(products.price), desc(products.createdAt), tie];
		case 'relevance':
			if (opts.relevance) return [desc(opts.relevance), desc(products.featured), tie];
			return [desc(products.featured), desc(products.createdAt), tie];
		default:
			return [
				...(opts.featured ?? [
					desc(products.featured),
					desc(sql`${products.badge} = 'bestseller'`),
					desc(products.createdAt)
				]),
				tie
			];
	}
}

/** One page of cards for a base set (category, collection, search) with filters + sort applied. */
export async function listProducts(
	db: Executor,
	base: SQL | undefined,
	f: ListingFilters,
	opts: { featured?: SQL[]; relevance?: SQL } = {}
) {
	const where = and(base, filterCondition(f));
	const [rows, counted] = await Promise.all([
		cardsWhere(db, where, { orderBy: sortOrder(f.sort, opts), limit: PAGE_SIZE, offset: (f.page - 1) * PAGE_SIZE }),
		db
			.select({ total: sql<number>`count(*)::int` })
			.from(products)
			.where(where ? and(activeOnly, where) : activeOnly)
	]);
	const total = counted[0]?.total ?? 0;
	return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Facet values available in the base set (independent of the applied filters). */
export async function listingFacets(db: Executor, base: SQL | undefined): Promise<ListingFacets> {
	const where = base ? and(activeOnly, base) : activeOnly;
	const ids = db.select({ id: products.id }).from(products).where(where);
	const [vs, aggs] = await Promise.all([
		db
			.selectDistinct({ metal: sql<string>`${variants.metal}::text`, size: variants.size })
			.from(variants)
			.where(inArray(variants.productId, ids)),
		db
			.select({
				min: sql<number>`coalesce(min(${products.price}), 0)::int`,
				max: sql<number>`coalesce(max(${products.price}), 0)::int`,
				stones: sql<string[] | null>`array_remove(array_agg(distinct ${products.stoneColor}), null)`
			})
			.from(products)
			.where(where)
	]);
	const agg = aggs[0];
	const metals = new Set(vs.map((v) => v.metal));
	return {
		metals: METALS.filter((m) => metals.has(m)),
		stones: [...(agg?.stones ?? [])].sort(),
		sizes: sortSizes([...new Set(vs.map((v) => v.size).filter((s): s is string => !!s))]),
		price: { min: agg?.min ?? 0, max: agg?.max ?? 0 }
	};
}

export async function categoryBySlug(db: Executor, lang: Lang, slug: string) {
	const [c] = await db
		.select()
		.from(categories)
		.where(sql`${categories.slugs}->>${lang} = ${slug}`);
	return c ?? null;
}

/** Active collection by slug in either language; `slugLang` is the language the slug belongs to. */
export async function collectionBySlug(db: Executor, slug: string) {
	const [c] = await db
		.select()
		.from(collections)
		.where(
			and(
				eq(collections.active, true),
				sql`(${collections.slugs}->>'nl' = ${slug} or ${collections.slugs}->>'fr' = ${slug})`
			)
		);
	if (!c) return null;
	return { collection: c, slugLang: (c.slugs.nl === slug ? 'nl' : 'fr') as Lang };
}

/** Base condition + "featured" ordering for a collection (manual = curated order). */
export function collectionQuery(c: { id: string; type: 'manual' | 'rule'; rule: CollectionRule | null }): {
	base: SQL | undefined;
	featured?: SQL[];
} {
	if (c.type === 'rule') return { base: ruleCondition(c.rule ?? {}) };
	return {
		base: sql`${PID} in (select cp.product_id from ${collectionProducts} cp where cp.collection_id = ${c.id})`,
		featured: [
			asc(
				sql`(select cp.position from ${collectionProducts} cp where cp.collection_id = ${c.id} and cp.product_id = ${PID})`
			)
		]
	};
}

// ── Product detail (P1-08) ─────────────────────────────────────────────────────
const DAY_MS = 86400_000;

/**
 * Omnibus directive (EU 2019/2161): next to a reduced price, show the lowest price applied during
 * the 30 days BEFORE the reduction. `history` = the product's price_history rows; the newest row is
 * the current (reduced) price. Returns null when there is no earlier price to compare with.
 */
export function lowestPriorPrice(history: { price: number; validFrom: Date }[], now = new Date()): number | null {
	const rows = history.filter((h) => h.validFrom <= now).sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
	if (rows.length < 2) return null;
	const windowStart = rows[rows.length - 1].validFrom.getTime() - 30 * DAY_MS;
	const prior = rows.slice(0, -1);
	// the price in effect when the window opened + every price set inside the window
	const atStart = [...prior].reverse().find((h) => h.validFrom.getTime() <= windowStart);
	const candidates = [...(atStart ? [atStart] : []), ...prior.filter((h) => h.validFrom.getTime() > windowStart)];
	return candidates.length ? Math.min(...candidates.map((c) => c.price)) : null;
}

export async function productBySlug(db: Executor, slug: string) {
	const [p] = await db
		.select()
		.from(products)
		.where(and(eq(products.slug, slug), activeOnly));
	if (!p) return null;
	const [cat, vs, imgs, history] = await Promise.all([
		db.select().from(categories).where(eq(categories.id, p.categoryId)),
		db
			.select()
			.from(variants)
			.where(eq(variants.productId, p.id))
			.orderBy(asc(variants.position), asc(variants.metal), asc(variants.size)),
		db
			.select({ key: media.storageKey, alt: productImages.alt, width: media.width, height: media.height })
			.from(productImages)
			.innerJoin(media, eq(media.id, productImages.mediaId))
			.where(eq(productImages.productId, p.id))
			.orderBy(asc(productImages.position)),
		db
			.select({ price: priceHistory.price, validFrom: priceHistory.validFrom })
			.from(priceHistory)
			.where(eq(priceHistory.productId, p.id))
	]);
	return { product: p, category: cat[0] ?? null, variants: vs, images: imgs, lowest30: lowestPriorPrice(history) };
}

/**
 * Cards for a PDP rail. Curated `product_relations` first; without curation the rail falls back to
 * the same category (related) or pieces of the same line/tag in other categories (complete the set).
 */
export async function relationCards(
	db: Executor,
	p: { id: string; categoryId: string; tags: string[] },
	kind: 'related' | 'complete_set',
	limit = 8
): Promise<CardRow[]> {
	const rel = await db
		.select({ id: productRelations.relatedId })
		.from(productRelations)
		.where(and(eq(productRelations.productId, p.id), eq(productRelations.kind, kind)))
		.orderBy(asc(productRelations.position))
		.limit(limit);
	if (rel.length)
		return cardsByIds(
			db,
			rel.map((r) => r.id)
		);
	if (kind === 'related')
		return cardsWhere(db, and(eq(products.categoryId, p.categoryId), ne(products.id, p.id)), { limit });
	if (!p.tags.length) return [];
	return cardsWhere(db, and(arrayOverlaps(products.tags, p.tags), ne(products.categoryId, p.categoryId)), {
		orderBy: [asc(products.price), asc(products.id)],
		limit
	});
}

/** Listing page data for ProductListing: one page of cards + facets of the base set. */
export async function loadListing(
	db: Executor,
	base: SQL | undefined,
	f: ListingFilters,
	lang: Lang,
	img: (key: string, alt: string) => { src: string; srcset?: string; alt: string },
	opts: { featured?: SQL[]; relevance?: SQL } = {}
): Promise<ListingData> {
	const [list, facets] = await Promise.all([listProducts(db, base, f, opts), listingFacets(db, base)]);
	return {
		products: list.rows.map((r) => toCard(r, lang, img)),
		total: list.total,
		page: f.page,
		pages: list.pages,
		filters: f,
		facets
	};
}
