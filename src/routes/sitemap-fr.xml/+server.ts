/** Per-language sitemap (P4-04) with hreflang alternates. */
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { RequestHandler } from './$types';
import { buildUrlset, sitemapEntries } from '#lib/server/services/seo.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
	const xml = buildUrlset(PUBLIC_SITE_URL || url.origin, 'fr', await sitemapEntries(locals.db));
	return new Response(xml, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600, s-maxage=3600'
		}
	});
};
