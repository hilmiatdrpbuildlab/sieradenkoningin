/**
 * Listing filters (P1-07) — pure helpers shared by the server query builder
 * (`services/catalog.ts`) and the storefront filter UI. State lives in URL search params
 * (shareable, SSR-friendly, back button restores it):
 *
 *   ?metal=gold&metal=silver&stone=red&size=52&min=20&max=80&stock=1&sort=price_asc&page=2
 *
 * Prices in the URL are whole euros (human-readable); internally they are cents.
 */
import type { Metal, ProductCardData } from '#lib/types.ts';

export const PAGE_SIZE = 24;
export const METALS: readonly Metal[] = ['gold', 'rosegold', 'silver'];
export const SORTS = ['featured', 'new', 'price_asc', 'price_desc'] as const;
export type SortKey = (typeof SORTS)[number] | 'relevance';
/** Params that are filters (dropped from the canonical URL, counted in the badge). */
export const FILTER_PARAMS = ['metal', 'stone', 'size', 'min', 'max', 'stock'] as const;

export interface ListingFilters {
	metal: Metal[];
	stone: string[];
	size: string[];
	/** cents, inclusive */
	min: number | null;
	/** cents, inclusive */
	max: number | null;
	stock: boolean;
	sort: SortKey;
	page: number;
}

export interface ListingFacets {
	metals: Metal[];
	stones: string[];
	sizes: string[];
	/** cents */
	price: { min: number; max: number };
}

const STONE_RE = /^[a-z][a-z-]{0,23}$/;
const SIZE_RE = /^[A-Za-z0-9.,/-]{1,8}$/;
const MAX_PAGE = 500;

const multi = (sp: URLSearchParams, key: string) => [
	...new Set(
		sp
			.getAll(key)
			.flatMap((v) => v.split(','))
			.map((v) => v.trim())
			.filter(Boolean)
	)
];

/** Whole euros in the URL → cents; invalid or negative → null. */
function euros(v: string | null): number | null {
	if (v == null || v.trim() === '') return null;
	const n = Number(v.replace(',', '.'));
	if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
	return Math.round(n * 100);
}

export function parseFilters(
	sp: URLSearchParams,
	opts: { defaultSort?: SortKey; allowRelevance?: boolean } = {}
): ListingFilters {
	const defaultSort = opts.defaultSort ?? 'featured';
	let min = euros(sp.get('min'));
	let max = euros(sp.get('max'));
	if (min != null && max != null && min > max) [min, max] = [max, min];
	const sortParam = sp.get('sort');
	const sort: SortKey =
		(SORTS as readonly string[]).includes(sortParam ?? '') || (opts.allowRelevance && sortParam === 'relevance')
			? (sortParam as SortKey)
			: defaultSort;
	const page = Math.trunc(Number(sp.get('page')));
	return {
		metal: multi(sp, 'metal').filter((m): m is Metal => (METALS as readonly string[]).includes(m)),
		stone: multi(sp, 'stone')
			.map((s) => s.toLowerCase())
			.filter((s) => STONE_RE.test(s))
			.slice(0, 12),
		size: multi(sp, 'size')
			.filter((s) => SIZE_RE.test(s))
			.slice(0, 24),
		min,
		max,
		stock: ['1', 'true', 'on'].includes(sp.get('stock') ?? ''),
		sort,
		page: Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1
	};
}

/** Filters → search params (stable order; defaults omitted). `extra` (e.g. `q`) goes first. */
export function filtersToParams(
	f: ListingFilters,
	opts: { defaultSort?: SortKey; extra?: Record<string, string> } = {}
): URLSearchParams {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(opts.extra ?? {})) if (v) sp.set(k, v);
	for (const m of f.metal) sp.append('metal', m);
	for (const s of f.stone) sp.append('stone', s);
	for (const s of f.size) sp.append('size', s);
	if (f.min != null) sp.set('min', String(f.min / 100));
	if (f.max != null) sp.set('max', String(f.max / 100));
	if (f.stock) sp.set('stock', '1');
	if (f.sort !== (opts.defaultSort ?? 'featured')) sp.set('sort', f.sort);
	if (f.page > 1) sp.set('page', String(f.page));
	return sp;
}

/** Number of applied filters (badge on the mobile "Filter" button). Price range counts once. */
export function activeFilterCount(f: ListingFilters): number {
	return f.metal.length + f.stone.length + f.size.length + (f.min != null || f.max != null ? 1 : 0) + (f.stock ? 1 : 0);
}

export const hasFilters = (f: ListingFilters) => activeFilterCount(f) > 0;

/** `?…` query string for a modified copy of the filters (page resets unless set explicitly). */
export function queryWith(
	f: ListingFilters,
	patch: Partial<ListingFilters>,
	opts: { defaultSort?: SortKey; extra?: Record<string, string> } = {}
): string {
	const s = filtersToParams({ ...f, page: 1, ...patch }, opts).toString();
	return s ? `?${s}` : '?';
}

/** Ring sizes numerically, then letter sizes in garment order, then anything else. */
export function sortSizes(sizes: string[]): string[] {
	const letters = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
	const rank = (s: string) => {
		const n = Number(s.replace(',', '.'));
		if (Number.isFinite(n)) return [0, n] as const;
		const i = letters.indexOf(s.toUpperCase());
		return i >= 0 ? ([1, i] as const) : ([2, 0] as const);
	};
	return [...sizes].sort((a, b) => {
		const [ga, va] = rank(a);
		const [gb, vb] = rank(b);
		return ga - gb || va - vb || a.localeCompare(b);
	});
}

/** What a listing route returns to `ProductListing` (one page of cards + facets). */
export interface ListingData {
	products: ProductCardData[];
	total: number;
	page: number;
	pages: number;
	filters: ListingFilters;
	facets: ListingFacets;
}

/** Filter form data → `?query` (empty values dropped, default sort omitted, page reset); '' when empty. */
export function formToQuery(data: FormData, defaultSort: SortKey = 'featured'): string {
	const sp = new URLSearchParams();
	for (const [k, v] of data) if (typeof v === 'string' && v.trim() !== '') sp.append(k, v.trim());
	if (sp.get('sort') === defaultSort) sp.delete('sort');
	sp.delete('page');
	const s = sp.toString();
	return s ? `?${s}` : '';
}

/** Query that removes every filter but keeps sort + extra params ('' when nothing remains). */
export function clearFiltersQuery(
	f: ListingFilters,
	opts: { defaultSort?: SortKey; extra?: Record<string, string> } = {}
): string {
	const s = filtersToParams(
		{ ...f, metal: [], stone: [], size: [], min: null, max: null, stock: false, page: 1 },
		opts
	).toString();
	return s ? `?${s}` : '';
}
