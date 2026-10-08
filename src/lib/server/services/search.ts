/**
 * Product search (P1-09).
 *
 * 1. Full-text: the generated `search_nl` / `search_fr` tsvector columns (dutch / french configs over
 *    `sk_unaccent(name + description + material)`), queried with prefix terms (`klaver:*`) so
 *    partial words and compounds ("Klaverring") match while typing.
 * 2. Typo tolerance: pg_trgm `word_similarity` against `sk_unaccent(name)` (trigram GIN indexes exist
 *    for both languages) — "klavr" still finds "Klaver".
 * 3. Category names: "ringen" / "bagues" returns the whole category.
 * Everything is accent-folded with `sk_unaccent`, so "trèfle" and "trefle" are the same query.
 */
import { and, asc, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { categories, products } from '../db/schema.ts';
import type { Lang } from '../../i18n/paths.ts';
import { tr } from '../../i18n/index.ts';
import { cardsWhere, sortOrder } from './catalog.ts';

/** Minimum pg_trgm word similarity for the fuzzy fallback (0.5 keeps "ring" ≁ "ketting"). */
export const FUZZY_THRESHOLD = 0.5;
export const MAX_QUERY_LENGTH = 80;

/** Trim, collapse whitespace and cap the length of a user query. */
export function normalizeQuery(q: string | null | undefined): string {
	return (q ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

/** Query → prefix tsquery text ("bague trèfle" → "bague:* & trèfle:*"); null when nothing searchable. */
export function toPrefixTsquery(q: string): string | null {
	const words = normalizeQuery(q)
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((w) => w.length > 0)
		.slice(0, 6);
	return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}

/** LIKE wildcards in user input are literal text, not patterns. */
const likePrefix = (q: string) => q.replace(/[\\%_]/g, '');

const config = (lang: Lang) => sql.raw(lang === 'fr' ? `'french'` : `'dutch'`);
const vector = (lang: Lang) => (lang === 'fr' ? products.searchFr : products.searchNl);
/** Same expressions as the trigram indexes (products_name_trgm_idx / products_name_fr_trgm_idx). */
const nameExpr = (lang: Lang) =>
	lang === 'fr'
		? sql`sk_unaccent(coalesce(${products.name}->>'fr', ${products.name}->>'nl'))`
		: sql`sk_unaccent(${products.name}->>'nl')`;

/**
 * WHERE + rank expressions for a query. Matches when the full-text vector matches the prefix
 * tsquery, OR the name is trigram-similar, OR the product's category name matches.
 */
export function searchCondition(q: string, lang: Lang): { where: SQL; rank: SQL } | null {
	const query = normalizeQuery(q);
	const tsq = toPrefixTsquery(query);
	if (!tsq) return null;
	const ts = sql`to_tsquery(${config(lang)}, sk_unaccent(${tsq}))`;
	const fuzzy = sql`word_similarity(sk_unaccent(${query}), ${nameExpr(lang)})`;
	const catMatch = sql`${products.categoryId} in (select c.id from ${categories} c where sk_unaccent(lower(c.name->>${lang})) like sk_unaccent(lower(${likePrefix(query)})) || '%' or word_similarity(sk_unaccent(${query}), sk_unaccent(c.name->>${lang})) >= ${FUZZY_THRESHOLD})`;
	return {
		where: sql`(${vector(lang)} @@ ${ts} or ${fuzzy} >= ${FUZZY_THRESHOLD} or ${catMatch})`,
		rank: sql`(ts_rank(${vector(lang)}, ${ts}) * 2 + ${fuzzy})`
	};
}

/** Categories whose name matches the query (prefix or fuzzy), for the overlay and no-results state. */
export async function searchCategories(db: Executor, q: string, lang: Lang, limit = 4) {
	const query = normalizeQuery(q);
	if (!query) return [];
	const rows = await db
		.select()
		.from(categories)
		.where(
			sql`sk_unaccent(lower(${categories.name}->>${lang})) like sk_unaccent(lower(${likePrefix(query)})) || '%' or word_similarity(sk_unaccent(${query}), sk_unaccent(${categories.name}->>${lang})) >= ${FUZZY_THRESHOLD}`
		)
		.orderBy(asc(categories.position))
		.limit(limit);
	return rows.map((c) => ({ key: c.key, label: tr(c.name, lang), href: `/${lang}/${c.slugs[lang]}`, icon: c.icon }));
}

/** Instant results for the overlay: top products (by relevance) + matching categories. */
export async function searchSuggest(db: Executor, q: string, lang: Lang, limit = 6) {
	const cond = searchCondition(q, lang);
	if (!cond) return { rows: [], categories: [] };
	const [rows, cats] = await Promise.all([
		cardsWhere(db, and(cond.where), { orderBy: sortOrder('relevance', { relevance: cond.rank }), limit }),
		searchCategories(db, q, lang)
	]);
	return { rows, categories: cats };
}
