/** `/nl/zoeken?q=…` · `/fr/recherche?q=…` — search results with the listing filters (P1-09). */
import type { PageServerLoad } from './$types';
import { categoryNav, loadListing, parseFilters } from '#lib/server/services/catalog.ts';
import { normalizeQuery, searchCondition } from '#lib/server/services/search.ts';
import { getSetting } from '#lib/server/services/settings.ts';
import { tr } from '#lib/i18n/index.ts';
import { picture } from '#lib/utils/media.ts';

export const load: PageServerLoad = async ({ params, locals, url, setHeaders }) => {
	const { lang } = params;
	const db = locals.db;
	const q = normalizeQuery(url.searchParams.get('q'));
	const filters = parseFilters(url.searchParams, { defaultSort: 'relevance', allowRelevance: true });
	const cond = searchCondition(q, lang);

	const [listing, cats, popular] = await Promise.all([
		cond
			? loadListing(db, cond.where, filters, lang, (key, alt) => picture(key, alt, 800), { relevance: cond.rank })
			: null,
		categoryNav(db, lang),
		getSetting(db, 'popular_searches')
	]);
	setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' });
	return {
		q,
		listing,
		suggestions: {
			categories: cats.map(({ key, label, href, icon }) => ({ key, label, href, icon })),
			popular: popular.map((p) => tr(p, lang)).filter(Boolean)
		}
	};
};
