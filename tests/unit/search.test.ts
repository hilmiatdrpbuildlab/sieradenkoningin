/** P1-09 — search: typo tolerance, accent folding, categories (read-only against the seeded DB). */
import { afterAll, describe, expect, it } from 'vitest';
import {
	normalizeQuery,
	searchCategories,
	searchCondition,
	searchSuggest,
	toPrefixTsquery
} from '#lib/server/services/search.ts';
import { listProducts, parseFilters } from '#lib/server/services/catalog.ts';
import { createDb } from '#lib/server/db/index.ts';

describe('query helpers', () => {
	it('normalises and builds prefix tsqueries', () => {
		expect(normalizeQuery('  bague   trèfle ')).toBe('bague trèfle');
		expect(toPrefixTsquery("boucles d'oreilles")).toBe('boucles:* & d:* & oreilles:*');
		expect(toPrefixTsquery('  !! ')).toBeNull();
		expect(searchCondition('', 'nl')).toBeNull();
	});
});

describe('search against the seeded DB', () => {
	const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://sk@localhost:54329/sieradenkoningin', 2);
	afterAll(() => close());
	const names = async (q: string, lang: 'nl' | 'fr') =>
		(await searchSuggest(db, q, lang, 24)).rows.map((r) => (lang === 'fr' ? (r.name.fr ?? r.name.nl) : r.name.nl));

	it('"klavr" finds Klaver products (typo tolerance)', async () => {
		const n = await names('klavr', 'nl');
		expect(n.length).toBeGreaterThan(0);
		expect(n[0]).toMatch(/Klaver/);
		expect(n.every((x) => /Klaver/.test(x))).toBe(true);
	});

	it('prefix matches compounds while typing ("klaver" → Klaverring)', async () => {
		expect(await names('klaver', 'nl')).toContain('DEMO Klaverring');
	});

	it('FR "trèfle" and "trefle" return the same products', async () => {
		const a = await names('trèfle', 'fr');
		const b = await names('trefle', 'fr');
		expect(a.length).toBeGreaterThan(0);
		expect(a.every((x) => x.includes('trèfle'))).toBe(true);
		expect([...b].sort()).toEqual([...a].sort());
		expect((await names('TRÈFLE', 'fr')).sort()).toEqual([...a].sort());
	});

	it('matches categories by name and returns their products', async () => {
		expect((await searchCategories(db, 'ring', 'nl')).map((c) => c.key)).toContain('rings');
		expect((await searchCategories(db, 'bague', 'fr')).map((c) => c.key)).toContain('rings');
		expect((await names('ringen', 'nl')).some((x) => /ring$/.test(x))).toBe(true);
	});

	it('combines with listing filters on the results page', async () => {
		const cond = searchCondition('klaver', 'nl')!;
		const res = await listProducts(
			db,
			cond.where,
			parseFilters(new URLSearchParams('max=50&sort=relevance'), { allowRelevance: true }),
			{ relevance: cond.rank }
		);
		expect(res.total).toBeGreaterThan(0);
		expect(res.rows.every((r) => r.price <= 5000 && /Klaver/.test(r.name.nl))).toBe(true);
	});

	it('finds nothing for gibberish', async () => {
		expect(await names('xqzwv', 'nl')).toEqual([]);
	});
});
