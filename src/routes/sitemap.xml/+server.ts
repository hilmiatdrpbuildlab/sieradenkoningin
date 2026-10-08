/** Sitemap index (P4-04) → /sitemap-nl.xml + /sitemap-fr.xml. */
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { RequestHandler } from './$types';
import { buildSitemapIndex } from '#lib/server/services/seo.ts';

export const GET: RequestHandler = async ({ url }) => {
	const site = PUBLIC_SITE_URL || url.origin;
	const now = new Date();
	return new Response(
		buildSitemapIndex(site, [
			{ path: '/sitemap-nl.xml', lastmod: now },
			{ path: '/sitemap-fr.xml', lastmod: now }
		]),
		{
			headers: {
				'content-type': 'application/xml; charset=utf-8',
				'cache-control': 'public, max-age=3600, s-maxage=3600'
			}
		}
	);
};
