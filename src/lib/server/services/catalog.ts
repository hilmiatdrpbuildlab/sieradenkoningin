/**
 * Storefront catalog queries (read side). Only `active` products are ever exposed here.
 * Card rows carry everything ProductCard needs in one round-trip: first two images, metals,
 * stock, and the single variant id for quick-add.
 */
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { categories, collectionProducts, collections, media, orderLines, orders, productImages, products, variants } from '../db/schema.ts';
import type { CollectionRule, I18n } from '../db/schema.ts';
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
	images: sql<{ key: string; alt: I18n }[] | null>`(select json_agg(json_build_object('key', m.storage_key, 'alt', pi.alt) order by pi.position) from (select * from ${productImages} where ${productImages.productId} = ${PID} order by ${productImages.position} limit 2) pi join ${media} m on m.id = pi.media_id)`,
	metals: sql<Metal[] | null>`(select array_agg(distinct v.metal::text) from ${variants} v where v.product_id = ${PID})`,
	stock: sql<number>`(select coalesce(sum(v.stock), 0)::int from ${variants} v where v.product_id = ${PID})`,
	variantCount: sql<number>`(select count(*)::int from ${variants} v where v.product_id = ${PID})`,
	singleVariantId: sql<string | null>`(select case when count(*) = 1 then min(v.id::text) end from ${variants} v where v.product_id = ${PID})`
};

export function toCard(row: CardRow, lang: Lang, img: (key: string, alt: string) => { src: string; srcset?: string; alt: string }): ProductCardData {
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

export async function cardsWhere(db: Executor, where: SQL | undefined, opts: { orderBy?: SQL[]; limit?: number; offset?: number } = {}) {
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
	const rows = (await db.select(cardColumns).from(products).where(and(activeOnly, inArray(products.id, ids)))) as CardRow[];
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
		.where(and(sql`${orders.paymentStatus} in ('paid','partially_refunded')`, sql`${orders.placedAt} > now() - interval '90 days'`))
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
	if (rule.category) parts.push(sql`${products.categoryId} = (select id from ${categories} where key = ${rule.category})`);
	if (rule.tag) parts.push(sql`${rule.tag} = any(${products.tags})`);
	if (rule.newWithinDays) parts.push(sql`${products.createdAt} > now() - (${rule.newWithinDays} || ' days')::interval`);
	if (rule.onSale) parts.push(sql`${products.compareAtPrice} is not null and ${products.compareAtPrice} > ${products.price}`);
	if (rule.priceLt) parts.push(sql`${products.price} < ${rule.priceLt}`);
	return parts.length ? and(...parts) : undefined;
}

export async function collectionCards(db: Executor, collectionId: string, limit = 24, offset = 0) {
	const [c] = await db.select().from(collections).where(eq(collections.id, collectionId));
	if (!c) return [];
	if (c.type === 'rule') return cardsWhere(db, ruleCondition(c.rule ?? {}), { orderBy: [desc(products.createdAt)], limit, offset });
	const rows = await db
		.select({ id: collectionProducts.productId })
		.from(collectionProducts)
		.where(eq(collectionProducts.collectionId, collectionId))
		.orderBy(asc(collectionProducts.position))
		.limit(limit)
		.offset(offset);
	return cardsByIds(db, rows.map((r) => r.id));
}

export async function categoryNav(db: Executor, lang: Lang) {
	const rows = await db.select().from(categories).orderBy(asc(categories.position));
	return rows.map((c) => ({ id: c.id, key: c.key, label: tr(c.name, lang), href: `/${lang}/${c.slugs[lang]}`, icon: c.icon, slugs: c.slugs }));
}
