/** Home (P1-06 → P4-01): blocks come from pages(type=home), scheduled blocks filtered at request time. */
import type { PageServerLoad } from './$types';
import { getBlocks, getPageByKey } from '#lib/server/services/content.ts';
import { resolveBlocks } from '#lib/server/services/blocks.ts';
import { tr } from '#lib/i18n/index.ts';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const lang = params.lang;
	const page = await getPageByKey(locals.db, 'home');
	const blocks = page ? await resolveBlocks(locals.db, await getBlocks(locals.db, page.id), lang) : [];
	setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' });
	const hero = blocks.find((b) => b.type === 'hero')?.view.image as { src: string; srcset?: string } | undefined;
	return {
		blocks,
		seo: { title: tr(page?.seo?.title, lang), description: tr(page?.seo?.description, lang) },
		alternates: { nl: '/nl', fr: '/fr' },
		preloadImage: hero ?? null
	};
};
