/**
 * P1-07 — listing filters: URL parsing, serialisation and the SQL query builder.
 * The DB block runs read-only queries against the seeded dev database (24 DEMO products).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { eq, sql } from 'drizzle-orm';
import {
	activeFilterCount,
	clearFiltersQuery,
	filtersToParams,
	formToQuery,
	parseFilters,
	queryWith,
	sortSizes,
	type ListingFilters
} from '#lib/components/storefront/listing.ts';
import {
	categoryBySlug,
	filterCondition,
	listingFacets,
	listProducts,
	lowestPriorPrice,
	sortOrder
} from '#lib/server/services/catalog.ts';
import { createDb } from '#lib/server/db/index.ts';
import { products } from '#lib/server/db/schema.ts';

const sp = (q: string) => new URLSearchParams(q);
const dialect = new PgDialect();
const render = (f: Partial<ListingFilters>) => {
	const cond = filterCondition({ ...parseFilters(sp('')), ...f });
	return cond ? dialect.sqlToQuery(cond) : null;
};

describe('parseFilters', () => {
	it('reads repeated and comma-separated multi values, drops invalid ones', () => {
		const f = parseFilters(sp('metal=gold&metal=silver,platinum&stone=Red&stone=%3Cx%3E&size=52&size=M'));
		expect(f.metal).toEqual(['gold', 'silver']);
		expect(f.stone).toEqual(['red']);
		expect(f.size).toEqual(['52', 'M']);
	});

	it('converts euro prices to cents and swaps an inverted range', () => {
		expect(parseFilters(sp('min=20&max=79.5'))).toMatchObject({ min: 2000, max: 7950 });
		expect(parseFilters(sp('min=100&max=20'))).toMatchObject({ min: 2000, max: 10000 });
		expect(parseFilters(sp('min=-5&max=abc'))).toMatchObject({ min: null, max: null });
		expect(parseFilters(sp('max=49,95')).max).toBe(4995);
	});

	it('defaults sort and page, and only allows relevance where enabled', () => {
		expect(parseFilters(sp('sort=bogus&page=0'))).toMatchObject({ sort: 'featured', page: 1 });
		expect(parseFilters(sp('sort=price_desc&page=3'))).toMatchObject({ sort: 'price_desc', page: 3 });
		expect(parseFilters(sp('sort=relevance')).sort).toBe('featured');
		expect(parseFilters(sp('sort=relevance'), { allowRelevance: true }).sort).toBe('relevance');
		expect(parseFilters(sp(''), { defaultSort: 'relevance', allowRelevance: true }).sort).toBe('relevance');
		expect(parseFilters(sp('page=99999')).page).toBe(500);
	});

	it('round-trips through filtersToParams and omits defaults', () => {
		const q = 'metal=gold&metal=rosegold&stone=red&size=52&min=20&max=80&stock=1&sort=new&page=2';
		const f = parseFilters(sp(q));
		expect(filtersToParams(f).toString()).toBe(q);
		expect(parseFilters(filtersToParams(f))).toEqual(f);
		expect(filtersToParams(parseFilters(sp('sort=featured&page=1'))).toString()).toBe('');
		expect(filtersToParams(parseFilters(sp('')), { extra: { q: 'klaver' } }).toString()).toBe('q=klaver');
	});

	it('counts applied filters (price range once) and resets the page on change', () => {
		const f = parseFilters(sp('metal=gold&metal=silver&min=10&max=50&stock=1&page=3'));
		expect(activeFilterCount(f)).toBe(4);
		expect(activeFilterCount(parseFilters(sp('sort=new')))).toBe(0);
		expect(queryWith(f, { metal: ['gold'] })).toBe('?metal=gold&min=10&max=50&stock=1');
		expect(queryWith(f, { page: 2 })).toContain('page=2');
	});

	it('turns filter form data into a query and clears filters but keeps sort + q', () => {
		const fd = new FormData();
		for (const [k, v] of [
			['q', 'klaver'],
			['metal', 'gold'],
			['min', ''],
			['max', ' 80 '],
			['sort', 'featured'],
			['page', '3']
		])
			fd.append(k, v);
		expect(formToQuery(fd)).toBe('?q=klaver&metal=gold&max=80');
		expect(formToQuery(new FormData())).toBe('');
		const f = parseFilters(sp('metal=gold&stock=1&sort=new&page=2'));
		expect(clearFiltersQuery(f, { extra: { q: 'ring' } })).toBe('?q=ring&sort=new');
		expect(clearFiltersQuery(parseFilters(sp('metal=gold')))).toBe('');
	});

	it('orders sizes numerically, then S/M/L', () => {
		expect(sortSizes(['L', '58', 'S', '50', 'M', '7'])).toEqual(['7', '50', '58', 'S', 'M', 'L']);
	});
});

describe('filterCondition (SQL builder)', () => {
	it('returns undefined without filters', () => {
		expect(render({})).toBeNull();
	});

	it('puts metal, size and stock in ONE variant subquery (same variant must match all)', () => {
		const q = render({ metal: ['gold', 'silver'], size: ['52'], stock: true })!;
		expect(q.sql.match(/exists \(/g)).toHaveLength(1);
		expect(q.sql).toContain('v.metal::text in ($1, $2) and v.size in ($3) and v.stock > 0');
		expect(q.sql).toContain('v.product_id = "products"."id"');
		expect(q.params).toEqual(['gold', 'silver', '52']);
	});

	it('ANDs product-level facets with the variant subquery', () => {
		const q = render({ stone: ['red', 'white'], min: 2000, max: 8000, metal: ['gold'] })!;
		expect(q.sql).toMatch(/"stone_color" in \(\$1, \$2\) and .*"price" >= \$3 and .*"price" <= \$4 and exists/);
		expect(q.params).toEqual(['red', 'white', 2000, 8000, 'gold']);
	});

	it('maps every sort key to a stable ORDER BY', () => {
		for (const s of ['featured', 'new', 'price_asc', 'price_desc', 'relevance'] as const) {
			const q = dialect.sqlToQuery(sql.join(sortOrder(s), sql`, `)).sql;
			expect(q.endsWith('"id" asc')).toBe(true);
		}
		expect(dialect.sqlToQuery(sql.join(sortOrder('price_asc'), sql`, `)).sql).toMatch(
			/^"products"\."price" asc|^"price" asc/
		);
	});
});

describe('lowestPriorPrice (Omnibus)', () => {
	const d = (s: string) => new Date(s);
	it('takes the lowest price in the 30 days before the reduction, including the price in effect at the window start', () => {
		const h = [
			{ price: 9000, validFrom: d('2026-07-01') },
			{ price: 9995, validFrom: d('2026-09-20') },
			{ price: 8495, validFrom: d('2026-10-06') }
		];
		expect(lowestPriorPrice(h, d('2026-10-08'))).toBe(9000);
		expect(lowestPriorPrice(h.slice(1), d('2026-10-08'))).toBe(9995);
		expect(lowestPriorPrice(h.slice(2), d('2026-10-08'))).toBeNull();
	});
});

describe('listProducts against the seeded DB', () => {
	const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://sk@localhost:54329/sieradenkoningin', 2);
	afterAll(() => close());

	const variantsOf = async (ids: string[]) =>
		(
			await db.execute<{ product_id: string; metal: string; size: string | null; stock: number }>(
				sql`select product_id, metal::text as metal, size, stock from variants where product_id in ${ids}`
			)
		).rows;

	it('combines category + metal + size + in stock on the same variant', async () => {
		const rings = await categoryBySlug(db, 'nl', 'ringen');
		expect(rings).not.toBeNull();
		const base = eq(products.categoryId, rings!.id);
		const all = await listProducts(db, base, parseFilters(sp('')));
		expect(all.total).toBeGreaterThan(0);
		const f = parseFilters(sp('metal=gold&size=52&stock=1'));
		const res = await listProducts(db, base, f);
		expect(res.total).toBeLessThanOrEqual(all.total);
		expect(res.rows.length).toBe(res.total);
		if (res.rows.length) {
			const vs = await variantsOf(res.rows.map((r) => r.id));
			for (const r of res.rows)
				expect(vs.some((v) => v.product_id === r.id && v.metal === 'gold' && v.size === '52' && v.stock > 0)).toBe(
					true
				);
		}
		// a product that has gold and size 52 only on DIFFERENT variants must not match
		const loose = await listProducts(db, base, parseFilters(sp('metal=gold&size=52')));
		const vs = await variantsOf(loose.rows.map((r) => r.id));
		for (const r of loose.rows)
			expect(vs.some((v) => v.product_id === r.id && v.metal === 'gold' && v.size === '52')).toBe(true);
	});

	it('applies stone + price range and sorts by price', async () => {
		const f = parseFilters(sp('stone=red&max=80&sort=price_asc'));
		const res = await listProducts(db, undefined, f);
		expect(res.total).toBeGreaterThan(0);
		const prices = res.rows.map((r) => r.price);
		expect(prices.every((p) => p <= 8000)).toBe(true);
		expect([...prices].sort((a, b) => a - b)).toEqual(prices);
		const stones = await db.select({ id: products.id, stone: products.stoneColor }).from(products);
		for (const r of res.rows) expect(stones.find((s) => s.id === r.id)?.stone).toBe('red');
	});

	it('pages with PAGE_SIZE and reports totals', async () => {
		const p1 = await listProducts(db, undefined, parseFilters(sp('sort=new')));
		expect(p1.rows.length).toBe(Math.min(24, p1.total));
		expect(p1.pages).toBe(Math.max(1, Math.ceil(p1.total / 24)));
		const p2 = await listProducts(db, undefined, parseFilters(sp('sort=new&page=2')));
		expect(p2.rows.length).toBe(Math.max(0, Math.min(24, p1.total - 24)));
	});

	it('returns facets for the base set', async () => {
		const rings = await categoryBySlug(db, 'fr', 'bagues');
		const facets = await listingFacets(db, eq(products.categoryId, rings!.id));
		expect(facets.metals.length).toBeGreaterThan(0);
		expect(facets.sizes.every((s) => /^\d+$/.test(s))).toBe(true);
		expect(facets.price.min).toBeLessThanOrEqual(facets.price.max);
	});
});
