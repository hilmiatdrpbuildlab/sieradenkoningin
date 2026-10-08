/**
 * Categories & collections admin (P1-02). Rule-based collections are evaluated by the pure
 * `matchesRule()` (unit-tested; mirrors `ruleCondition()` in catalog.ts which does the same in SQL
 * for the storefront).
 */
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { categories, collectionProducts, collections, products, type CollectionRule, type I18n, type Seo } from '../db/schema.ts';
import { audit, diffObjects } from './audit.ts';
import { ValidationError } from './products-admin.ts';
import type { CategoryInput, CollectionInput } from '#lib/schemas/collection.ts';

type Actor = Pick<App.Locals, 'admin' | 'ip'>;

// ── Rule evaluator ───────────────────────────────────────────────────────────────
export interface RuleProduct {
	categoryKey: string;
	tags: readonly string[];
	createdAt: Date;
	price: number; // cents
	compareAtPrice: number | null;
}

const DAY = 86_400_000;

/**
 * True when the product satisfies every condition of the rule (conditions are AND-ed; an empty rule
 * matches everything). `priceLt` is in cents; `newWithinDays` counts back from `now`.
 */
export function matchesRule(product: RuleProduct, rule: CollectionRule, now: Date = new Date()): boolean {
	if (rule.category && product.categoryKey !== rule.category) return false;
	if (rule.tag && !product.tags.some((t) => t.toLowerCase() === rule.tag!.toLowerCase())) return false;
	if (rule.newWithinDays !== undefined && rule.newWithinDays !== null) {
		const age = now.getTime() - product.createdAt.getTime();
		if (age > rule.newWithinDays * DAY || age < -DAY) return false;
	}
	if (rule.onSale && !(product.compareAtPrice !== null && product.compareAtPrice > product.price)) return false;
	if (rule.priceLt !== undefined && rule.priceLt !== null && !(product.price < rule.priceLt)) return false;
	return true;
}

/** Human-readable summary of a rule (Dutch admin UI). */
export function describeRule(rule: CollectionRule | null | undefined, categoryName: (key: string) => string = (k) => k): string {
	if (!rule) return '—';
	const parts: string[] = [];
	if (rule.category) parts.push(`categorie ${categoryName(rule.category)}`);
	if (rule.tag) parts.push(`tag “${rule.tag}”`);
	if (rule.newWithinDays) parts.push(`nieuw (≤ ${rule.newWithinDays} dagen)`);
	if (rule.onSale) parts.push('in solden');
	if (rule.priceLt) parts.push(`prijs < € ${(rule.priceLt / 100).toFixed(2).replace('.', ',')}`);
	return parts.length ? parts.join(' · ') : 'alle producten';
}

/** Active products matching a rule, newest first (admin preview). */
export async function previewRule(db: Executor, rule: CollectionRule, now = new Date(), limit = 60) {
	const rows = await db
		.select({
			id: products.id,
			name: sql<string>`${products.name}->>'nl'`,
			slug: products.slug,
			categoryKey: categories.key,
			tags: products.tags,
			createdAt: products.createdAt,
			price: products.price,
			compareAtPrice: products.compareAtPrice
		})
		.from(products)
		.innerJoin(categories, eq(categories.id, products.categoryId))
		.where(eq(products.status, 'active'))
		.orderBy(sql`${products.createdAt} desc`);
	const hits = rows.filter((r) => matchesRule(r, rule, now));
	return { total: hits.length, rows: hits.slice(0, limit) };
}

// ── Categories ───────────────────────────────────────────────────────────────────
export async function listCategories(db: Executor) {
	return db
		.select({
			id: categories.id,
			key: categories.key,
			name: categories.name,
			slugs: categories.slugs,
			position: categories.position,
			icon: categories.icon,
			products: sql<number>`(select count(*) from products p where p.category_id = "categories"."id" and p.status <> 'archived')::int`
		})
		.from(categories)
		.orderBy(asc(categories.position), asc(categories.key));
}

async function assertUniqueSlugs(db: Executor, table: typeof categories | typeof collections, id: string | null, slugs: { nl: string; fr: string }) {
	const errors: Record<string, string[]> = {};
	for (const lang of ['nl', 'fr'] as const) {
		const where = id
			? and(sql`${table.slugs}->>${lang} = ${slugs[lang]}`, ne(table.id, id))
			: sql`${table.slugs}->>${lang} = ${slugs[lang]}`;
		const [hit] = await db.select({ id: table.id }).from(table).where(where);
		if (hit) errors[`slugs.${lang}`] = ['Deze slug is al in gebruik'];
	}
	if (Object.keys(errors).length) throw new ValidationError(errors);
}

const cleanSeo = (s: CategoryInput['seo']): Seo | null => {
	if (!s) return null;
	const out: Seo = {};
	if (s.title) out.title = s.title;
	if (s.description) out.description = s.description;
	return Object.keys(out).length ? out : null;
};

export async function saveCategory(tx: Executor, actor: Actor, id: string, input: CategoryInput) {
	const [before] = await tx.select().from(categories).where(eq(categories.id, id));
	if (!before) throw new ValidationError({ _: ['Categorie niet gevonden'] });
	await assertUniqueSlugs(tx, categories, id, input.slugs);
	const values = {
		name: input.name as I18n,
		slugs: input.slugs,
		description: input.description,
		seo: cleanSeo(input.seo),
		position: input.position
	};
	await tx
		.update(categories)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(categories.id, id));
	await audit(tx, actor, { action: 'update', entity: 'category', entityId: id, diff: diffObjects(before as unknown as Record<string, unknown>, values) });
}

/** Moves a category one place up/down and renumbers positions 0..n. */
export async function moveCategory(tx: Executor, actor: Actor, id: string, dir: 'up' | 'down') {
	const list = await tx.select({ id: categories.id }).from(categories).orderBy(asc(categories.position), asc(categories.key));
	const i = list.findIndex((c) => c.id === id);
	const j = dir === 'up' ? i - 1 : i + 1;
	if (i < 0 || j < 0 || j >= list.length) return;
	[list[i], list[j]] = [list[j], list[i]];
	for (let n = 0; n < list.length; n++) await tx.update(categories).set({ position: n }).where(eq(categories.id, list[n].id));
	await audit(tx, actor, { action: 'reorder', entity: 'category', entityId: id, diff: { dir } });
}

// ── Collections ──────────────────────────────────────────────────────────────────
export async function listCollections(db: Executor) {
	return db
		.select({
			id: collections.id,
			name: collections.name,
			slugs: collections.slugs,
			type: collections.type,
			rule: collections.rule,
			active: collections.active,
			updatedAt: collections.updatedAt,
			manualCount: sql<number>`(select count(*) from collection_products cp where cp.collection_id = "collections"."id")::int`
		})
		.from(collections)
		.orderBy(sql`${collections.name}->>'nl'`);
}

export async function loadCollection(db: Executor, id: string) {
	const [c] = await db.select().from(collections).where(eq(collections.id, id));
	if (!c) return null;
	const items = await db
		.select({ id: products.id, name: sql<string>`${products.name}->>'nl'`, status: products.status, position: collectionProducts.position })
		.from(collectionProducts)
		.innerJoin(products, eq(products.id, collectionProducts.productId))
		.where(eq(collectionProducts.collectionId, id))
		.orderBy(asc(collectionProducts.position));
	return { collection: c, items };
}

export async function saveCollection(tx: Executor, actor: Actor, id: string | null, input: CollectionInput) {
	const before = id ? (await tx.select().from(collections).where(eq(collections.id, id)))[0] : undefined;
	if (id && !before) throw new ValidationError({ _: ['Collectie niet gevonden'] });
	await assertUniqueSlugs(tx, collections, id, input.slugs);
	if (input.rule.category) {
		const [cat] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.key, input.rule.category));
		if (!cat) throw new ValidationError({ 'rule.category': ['Onbekende categorie'] });
	}
	const values = {
		name: input.name as I18n,
		slugs: input.slugs,
		description: input.description,
		seo: cleanSeo(input.seo),
		type: input.type,
		rule: input.type === 'rule' ? (input.rule as CollectionRule) : null,
		active: input.active,
		heroMediaId: input.heroMediaId
	};
	let cid: string;
	if (before) {
		cid = before.id;
		await tx
			.update(collections)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(collections.id, cid));
	} else {
		const [row] = await tx.insert(collections).values(values).returning({ id: collections.id });
		cid = row.id;
	}
	await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, cid));
	if (input.type === 'manual' && input.products.length) {
		const ok = new Set(
			(await tx.select({ id: products.id }).from(products).where(inArray(products.id, input.products))).map((r) => r.id)
		);
		const rows = input.products.filter((p) => ok.has(p)).map((productId, position) => ({ collectionId: cid, productId, position }));
		if (rows.length) await tx.insert(collectionProducts).values(rows);
	}
	await audit(tx, actor, {
		action: before ? 'update' : 'create',
		entity: 'collection',
		entityId: cid,
		diff: before ? { ...diffObjects(before as unknown as Record<string, unknown>, values), products: input.products.length } : { ...values, products: input.products.length }
	});
	return cid;
}

export async function deleteCollection(tx: Executor, actor: Actor, id: string) {
	const [before] = await tx.select({ name: collections.name, slugs: collections.slugs }).from(collections).where(eq(collections.id, id));
	if (!before) throw new ValidationError({ _: ['Collectie niet gevonden'] });
	await tx.delete(collections).where(eq(collections.id, id));
	await audit(tx, actor, { action: 'delete', entity: 'collection', entityId: id, diff: before });
}
