/**
 * SEO (P4-04): sitemap index + one sitemap per language with hreflang alternates, and robots.txt.
 * Each URL pair (NL/FR) appears exactly once per sitemap with its own canonical `loc`; the other
 * language is linked through xhtml:link alternates (never a duplicate canonical).
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { categories, collections, pages, products } from '../db/schema.ts';
import { localizeHref, SEGMENTS, type Lang } from '../../i18n/paths.ts';

export interface SitemapEntry {
	/** Site-relative paths per language. */
	paths: Record<Lang, string>;
	lastmod?: Date | string | null;
	priority?: number;
	changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

const LANG_TAG: Record<Lang, string> = { nl: 'nl-BE', fr: 'fr-BE' };

export const xmlEscape = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const abs = (site: string, path: string) => xmlEscape(`${site.replace(/\/$/, '')}${path}`);
const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** `<urlset>` for one language with xhtml:link alternates (nl-BE, fr-BE, x-default → NL). */
export function buildUrlset(site: string, lang: Lang, entries: SitemapEntry[]) {
	const seen = new Set<string>();
	const urls: string[] = [];
	for (const e of entries) {
		const loc = e.paths[lang];
		if (!loc || seen.has(loc)) continue;
		seen.add(loc);
		const alts = (['nl', 'fr'] as const)
			.filter((l) => e.paths[l])
			.map((l) => `<xhtml:link rel="alternate" hreflang="${LANG_TAG[l]}" href="${abs(site, e.paths[l])}"/>`);
		alts.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${abs(site, e.paths.nl || loc)}"/>`);
		urls.push(
			`<url><loc>${abs(site, loc)}</loc>${e.lastmod ? `<lastmod>${day(e.lastmod)}</lastmod>` : ''}${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ''}${e.priority != null ? `<priority>${e.priority.toFixed(1)}</priority>` : ''}${alts.join('')}</url>`
		);
	}
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

export function buildSitemapIndex(site: string, files: { path: string; lastmod?: Date | null }[]) {
	const items = files.map(
		(f) =>
			`<sitemap><loc>${abs(site, f.path)}</loc>${f.lastmod ? `<lastmod>${day(f.lastmod)}</lastmod>` : ''}</sitemap>`
	);
	return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>\n`;
}

/** Everything indexable: home, categories, active products, active collections, published pages, FAQ, contact. */
export async function sitemapEntries(db: Executor, now = new Date()): Promise<SitemapEntry[]> {
	const [cats, prods, cols, pgs] = await Promise.all([
		db.select({ slugs: categories.slugs, updatedAt: categories.updatedAt }).from(categories),
		db
			.select({ slug: products.slug, updatedAt: products.updatedAt })
			.from(products)
			.where(eq(products.status, 'active')),
		db
			.select({ slugs: collections.slugs, updatedAt: collections.updatedAt })
			.from(collections)
			.where(eq(collections.active, true)),
		db
			.select({ type: pages.type, slugs: pages.slugs, updatedAt: pages.updatedAt })
			.from(pages)
			.where(
				and(
					eq(pages.status, 'published'),
					sql`(${pages.publishAt} is null or ${pages.publishAt} <= ${now.toISOString()}::timestamptz)`
				)
			)
	]);
	const both = (internal: string) => ({ nl: localizeHref(internal, 'nl'), fr: localizeHref(internal, 'fr') });
	const out: SitemapEntry[] = [];
	const home = pgs.find((p) => p.type === 'home');
	out.push({ paths: { nl: '/nl', fr: '/fr' }, lastmod: home?.updatedAt, priority: 1, changefreq: 'daily' });
	for (const c of cats)
		out.push({
			paths: { nl: `/nl/${c.slugs.nl}`, fr: `/fr/${c.slugs.fr}` },
			lastmod: c.updatedAt,
			priority: 0.9,
			changefreq: 'daily'
		});
	for (const c of cols)
		out.push({
			paths: {
				nl: localizeHref(`/collections/${c.slugs.nl}`, 'nl'),
				fr: localizeHref(`/collections/${c.slugs.fr}`, 'fr')
			},
			lastmod: c.updatedAt,
			priority: 0.7,
			changefreq: 'weekly'
		});
	for (const p of prods)
		out.push({
			paths: { nl: `/nl/p/${p.slug}`, fr: `/fr/p/${p.slug}` },
			lastmod: p.updatedAt,
			priority: 0.8,
			changefreq: 'weekly'
		});
	for (const p of pgs) {
		if (p.type === 'home' || !p.slugs.nl) continue;
		out.push({
			paths: { nl: `/nl/${p.slugs.nl}`, fr: `/fr/${p.slugs.fr || p.slugs.nl}` },
			lastmod: p.updatedAt,
			priority: p.type === 'legal' ? 0.2 : 0.5,
			changefreq: p.type === 'legal' ? 'yearly' : 'monthly'
		});
	}
	out.push({ paths: both('/faq'), priority: 0.5, changefreq: 'monthly' });
	out.push({ paths: both('/contact'), priority: 0.4, changefreq: 'yearly' });
	return out;
}

/** Private / non-indexable public paths per language (robots.txt). */
export function disallowedPaths(): string[] {
	const internal = [
		'cart',
		'checkout',
		'checkout/thanks',
		'checkout/pay',
		'account',
		'wishlist',
		'search',
		'track',
		'newsletter/confirm',
		'newsletter/unsubscribe'
	];
	const out = new Set<string>(['/admin', '/api/']);
	for (const lang of ['nl', 'fr'] as const) {
		for (const i of internal) {
			const seg = SEGMENTS.find((s) => s[0] === i);
			if (seg) out.add(`/${lang}/${lang === 'nl' ? seg[1] : seg[2]}`);
		}
		out.add(localizeHref('/newsletter', lang));
	}
	return [...out];
}

/** Listing filter/sort/paging params that create duplicate content. */
export const FILTER_PARAMS = ['metal', 'stone', 'size', 'min', 'max', 'stock', 'sort'];

export function buildRobots(site: string, opts: { allowIndexing?: boolean } = {}) {
	const base = site.replace(/\/$/, '');
	if (opts.allowIndexing === false) return `User-agent: *\nDisallow: /\n`;
	const lines = ['User-agent: *', 'Allow: /', ...disallowedPaths().map((p) => `Disallow: ${p}`)];
	for (const p of FILTER_PARAMS) lines.push(`Disallow: /*?${p}=`, `Disallow: /*&${p}=`);
	lines.push('', `Sitemap: ${base}/sitemap.xml`, '');
	return lines.join('\n');
}
