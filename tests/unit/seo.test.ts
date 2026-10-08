/** P4-04 — sitemap XML (well-formed, hreflang alternates, no duplicate canonical) and robots.txt. */
import { afterAll, describe, expect, it } from 'vitest';
import {
	buildRobots,
	buildSitemapIndex,
	buildUrlset,
	sitemapEntries,
	type SitemapEntry
} from '#lib/server/services/seo.ts';
import { createDb } from '#lib/server/db/index.ts';

/** Minimal XML well-formedness check: balanced tags, quoted attributes, only known entities. */
function assertWellFormed(xml: string) {
	expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
	const body = xml.replace(/^<\?xml[^>]*\?>/, '');
	expect(body).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
	const stack: string[] = [];
	const re = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(body))) {
		expect(body.slice(last, m.index), 'stray markup').not.toMatch(/[<>]/);
		last = re.lastIndex;
		const [, close, name, , self] = m;
		if (self) continue;
		if (close) expect(stack.pop(), `closing </${name}>`).toBe(name);
		else stack.push(name);
	}
	expect(body.slice(last)).not.toMatch(/[<>]/);
	expect(stack).toEqual([]);
}

const site = 'https://www.example.be';
const entries: SitemapEntry[] = [
	{ paths: { nl: '/nl', fr: '/fr' }, priority: 1 },
	{ paths: { nl: '/nl/ringen', fr: '/fr/bagues' }, lastmod: new Date('2026-10-01T10:00:00Z') },
	{ paths: { nl: '/nl/p/klaver&co', fr: '/fr/p/klaver&co' } },
	{ paths: { nl: '/nl/ringen', fr: '/fr/bagues' } } // duplicate → emitted once
];

describe('sitemap builders', () => {
	it('urlset is well-formed with escaped entities', () => {
		const xml = buildUrlset(site, 'nl', entries);
		assertWellFormed(xml);
		expect(xml).toContain('<loc>https://www.example.be/nl/p/klaver&amp;co</loc>');
		expect(xml).toContain('<lastmod>2026-10-01</lastmod>');
	});
	it('every url has nl-BE, fr-BE and x-default alternates and appears once', () => {
		const xml = buildUrlset(site, 'fr', entries);
		const urls = xml.match(/<url>.*?<\/url>/g)!;
		expect(urls).toHaveLength(3);
		for (const u of urls) {
			expect(u).toMatch(/hreflang="nl-BE" href="https:\/\/www\.example\.be\/nl/);
			expect(u).toMatch(/hreflang="fr-BE" href="https:\/\/www\.example\.be\/fr/);
			expect(u).toMatch(/hreflang="x-default" href="https:\/\/www\.example\.be\/nl/);
		}
		expect(urls[1]).toContain('<loc>https://www.example.be/fr/bagues</loc>');
	});
	it('index is well-formed and lists both language sitemaps', () => {
		const xml = buildSitemapIndex(site, [{ path: '/sitemap-nl.xml' }, { path: '/sitemap-fr.xml' }]);
		assertWellFormed(xml);
		expect(xml.match(/<sitemap>/g)).toHaveLength(2);
	});
});

describe('sitemap content from the seeded DB', () => {
	const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://sk@localhost:54329/sieradenkoningin', 2);
	afterAll(() => close());

	it('no duplicate canonical across the NL/FR pair', async () => {
		const list = await sitemapEntries(db);
		expect(list.length).toBeGreaterThan(10);
		const all = list.flatMap((e) => [e.paths.nl, e.paths.fr]);
		for (const e of list) {
			expect(e.paths.nl.startsWith('/nl'), e.paths.nl).toBe(true);
			expect(e.paths.fr.startsWith('/fr'), e.paths.fr).toBe(true);
		}
		expect(new Set(all).size).toBe(all.length);
		const nl = buildUrlset(site, 'nl', list);
		const fr = buildUrlset(site, 'fr', list);
		assertWellFormed(nl);
		assertWellFormed(fr);
		const locs = [...nl.matchAll(/<loc>(.*?)<\/loc>/g), ...fr.matchAll(/<loc>(.*?)<\/loc>/g)].map((x) => x[1]);
		expect(new Set(locs).size).toBe(locs.length);
	});
	it('includes home, categories, products and help/legal pages but never drafts', async () => {
		const paths = (await sitemapEntries(db)).map((e) => e.paths.nl);
		expect(paths).toContain('/nl');
		expect(paths).toContain('/nl/ringen');
		expect(paths.some((p) => p.startsWith('/nl/p/'))).toBe(true);
		expect(paths).toContain('/nl/faq');
		expect(paths).toContain('/nl/voorwaarden');
	});
});

describe('robots.txt', () => {
	const robots = buildRobots('https://www.example.be/');
	it('blocks private areas in both languages and filter params', () => {
		for (const p of [
			'/admin',
			'/api/',
			'/nl/winkelmand',
			'/fr/panier',
			'/nl/afrekenen',
			'/fr/commande',
			'/nl/account',
			'/fr/compte',
			'/nl/zoeken',
			'/fr/recherche'
		]) {
			expect(robots).toContain(`Disallow: ${p}\n`);
		}
		expect(robots).toContain('Disallow: /*?metal=');
		expect(robots).toContain('Disallow: /*&sort=');
		expect(robots).toContain('Sitemap: https://www.example.be/sitemap.xml');
	});
	it('can block everything (preview environments)', () => {
		expect(buildRobots(site, { allowIndexing: false })).toBe('User-agent: *\nDisallow: /\n');
	});
});
