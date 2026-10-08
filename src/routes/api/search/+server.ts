/**
 * /api/search (P1-09) — public, edge-cacheable JSON for the SearchOverlay.
 *   ?q=…&lang=nl   → { query, products (6 cards), categories (matching) }
 *   ?lang=nl       → { popular (settings.popular_searches), categories (all) }  (empty query)
 *   ?ids=a,b&lang  → { products } in the given order (RecentlyViewed rail)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cardsByIds, categoryNav, toCard } from '#lib/server/services/catalog.ts';
import { normalizeQuery, searchSuggest } from '#lib/server/services/search.ts';
import { getSetting } from '#lib/server/services/settings.ts';
import { tr } from '#lib/i18n/index.ts';
import { isLang } from '#lib/i18n/paths.ts';
import { picture } from '#lib/utils/media.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ url, locals }) => {
	const l = url.searchParams.get('lang');
	const lang = isLang(l) ? l : locals.lang;
	const db = locals.db;
	const img = (key: string, alt: string) => picture(key, alt, 400);
	const headers = { 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' };

	const ids = (url.searchParams.get('ids') ?? '')
		.split(',')
		.filter((id) => UUID.test(id))
		.slice(0, 12);
	if (ids.length) {
		const rows = await cardsByIds(db, ids);
		return json({ products: rows.map((r) => toCard(r, lang, img)) }, { headers });
	}

	const q = normalizeQuery(url.searchParams.get('q'));
	if (!q) {
		const [popular, cats] = await Promise.all([getSetting(db, 'popular_searches'), categoryNav(db, lang)]);
		return json(
			{
				query: '',
				popular: popular.map((p) => tr(p, lang)).filter(Boolean),
				categories: cats.map(({ key, label, href, icon }) => ({ key, label, href, icon })),
				products: []
			},
			{ headers }
		);
	}

	const { rows, categories } = await searchSuggest(db, q, lang, 6);
	return json({ query: q, products: rows.map((r) => toCard(r, lang, img)), categories }, { headers });
};
