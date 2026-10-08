/**
 * `/{lang}/{slug}` — a category listing (categories.slugs->>lang) or else a published CMS page
 * (pages of type page / legal / landing). Slugs differ per language, so `alternates` carries the
 * other language's slug for the language switch + hreflang.
 */
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { categoryBySlug, loadListing, parseFilters } from '#lib/server/services/catalog.ts';
import { getBlocks, getPageBySlug } from '#lib/server/services/content.ts';
import { resolveBlocks } from '#lib/server/services/blocks.ts';
import { products } from '#lib/server/db/schema.ts';
import { tr } from '#lib/i18n/index.ts';
import { picture } from '#lib/utils/media.ts';
import { markdownToHtml } from '#lib/utils/markdown.ts';

const CACHE = 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400';

export const load: PageServerLoad = async ({ params, locals, url, setHeaders }) => {
	const { lang, slug } = params;
	const db = locals.db;

	const category = await categoryBySlug(db, lang, slug);
	if (category) {
		const filters = parseFilters(url.searchParams);
		const listing = await loadListing(db, eq(products.categoryId, category.id), filters, lang, (key, alt) =>
			picture(key, alt, 800)
		);
		if (filters.page > listing.pages) error(404, 'Not found');
		setHeaders({ 'cache-control': CACHE });
		const name = tr(category.name, lang);
		const description = tr(category.description, lang);
		return {
			kind: 'category' as const,
			category: {
				key: category.key,
				name,
				introHtml: markdownToHtml(description),
				seoTitle: tr(category.seo?.title, lang) || name,
				seoDescription: tr(category.seo?.description, lang) || description.replace(/[#*_[\]()]/g, '').slice(0, 160)
			},
			listing,
			alternates: { nl: `/nl/${category.slugs.nl}`, fr: `/fr/${category.slugs.fr}` }
		};
	}

	const cms = await getPageBySlug(db, lang, slug);
	if (!cms || cms.type === 'home') error(404, 'Not found');
	const blocks = await resolveBlocks(db, await getBlocks(db, cms.id), lang);
	setHeaders({ 'cache-control': CACHE });
	return {
		kind: 'page' as const,
		page: {
			title: tr(cms.title, lang),
			type: cms.type,
			seoTitle: tr(cms.seo?.title, lang) || tr(cms.title, lang),
			seoDescription: tr(cms.seo?.description, lang)
		},
		blocks,
		alternates: { nl: `/nl/${cms.slugs.nl}`, fr: `/fr/${cms.slugs.fr}` }
	};
};
