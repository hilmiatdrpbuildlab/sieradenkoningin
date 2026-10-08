/**
 * `/nl/collectie/{slug}` · `/fr/collection/{slug}` — collection listing (manual or rule-based).
 * A slug of the other language 301s to this language's slug.
 */
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { collectionBySlug, collectionQuery, loadListing, parseFilters } from '#lib/server/services/catalog.ts';
import { tr } from '#lib/i18n/index.ts';
import { localizeHref } from '#lib/i18n/paths.ts';
import { picture } from '#lib/utils/media.ts';
import { markdownToHtml } from '#lib/utils/markdown.ts';

export const load: PageServerLoad = async ({ params, locals, url, setHeaders }) => {
	const { lang, slug } = params;
	const found = await collectionBySlug(locals.db, slug);
	if (!found) error(404, 'Not found');
	const { collection: c } = found;
	if (c.slugs[lang] !== slug) redirect(301, localizeHref(`/collections/${c.slugs[lang]}`, lang) + url.search);

	const filters = parseFilters(url.searchParams);
	const q = collectionQuery(c);
	const listing = await loadListing(locals.db, q.base, filters, lang, (key, alt) => picture(key, alt, 800), {
		featured: q.featured
	});
	if (filters.page > listing.pages) error(404, 'Not found');
	setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' });

	const name = tr(c.name, lang);
	const description = tr(c.description, lang);
	return {
		collection: {
			name,
			introHtml: markdownToHtml(description),
			seoTitle: tr(c.seo?.title, lang) || name,
			seoDescription: tr(c.seo?.description, lang) || description.replace(/[#*_[\]()]/g, '').slice(0, 160)
		},
		listing,
		alternates: {
			nl: localizeHref(`/collections/${c.slugs.nl}`, 'nl'),
			fr: localizeHref(`/collections/${c.slugs.fr}`, 'fr')
		}
	};
};
