/** robots.txt (P4-04): private paths in both languages, filter params, sitemap reference. */
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { RequestHandler } from './$types';
import { buildRobots } from '#lib/server/services/seo.ts';

export const GET: RequestHandler = ({ url }) =>
	new Response(buildRobots(PUBLIC_SITE_URL || url.origin), {
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' }
	});
