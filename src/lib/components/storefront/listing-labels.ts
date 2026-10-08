/** Localized labels for listing facets and sorts (client + server safe; strings via Paraglide). */
import { m } from '#lib/paraglide/messages.js';
import { formatPrice } from '#lib/utils/format.ts';
import type { Lang } from '#lib/i18n/paths.ts';
import type { Metal } from '#lib/types.ts';
import { queryWith, type ListingFilters, type SortKey } from './listing.ts';

export const metalLabel = (metal: Metal | string) =>
	({ gold: m.metal_gold(), rosegold: m.metal_rosegold(), silver: m.metal_silver() })[metal] ?? metal;

export function stoneLabel(stone: string): string {
	const labels: Record<string, () => string> = {
		red: m.stone_red,
		green: m.stone_green,
		white: m.stone_white,
		blue: m.stone_blue,
		pink: m.stone_pink,
		black: m.stone_black,
		none: m.stone_none
	};
	return labels[stone]?.() ?? stone.charAt(0).toUpperCase() + stone.slice(1);
}

export function sortLabel(sort: SortKey): string {
	return {
		featured: m.sort_featured(),
		new: m.sort_new(),
		price_asc: m.sort_price_asc(),
		price_desc: m.sort_price_desc(),
		relevance: m.sort_relevance()
	}[sort];
}

export function priceRangeLabel(min: number | null, max: number | null, lang: Lang): string {
	const f = (c: number) => formatPrice(c, lang);
	if (min != null && max != null) return `${f(min)} – ${f(max)}`;
	if (min != null) return m.filter_price_from({ min: f(min) });
	return m.filter_price_to({ max: f(max ?? 0) });
}

export const countLabel = (count: number) => (count === 1 ? m.listing_count_one() : m.listing_count_other({ count }));

/** One removable chip per applied filter value. */
export function appliedChips(
	f: ListingFilters,
	lang: Lang,
	opts: { defaultSort?: SortKey; extra?: Record<string, string> }
) {
	const chips: { key: string; label: string; href: string }[] = [];
	for (const v of f.metal)
		chips.push({
			key: `metal-${v}`,
			label: metalLabel(v),
			href: queryWith(f, { metal: f.metal.filter((x) => x !== v) }, opts)
		});
	for (const v of f.stone)
		chips.push({
			key: `stone-${v}`,
			label: stoneLabel(v),
			href: queryWith(f, { stone: f.stone.filter((x) => x !== v) }, opts)
		});
	for (const v of f.size)
		chips.push({
			key: `size-${v}`,
			label: `${m.filter_size()} ${v}`,
			href: queryWith(f, { size: f.size.filter((x) => x !== v) }, opts)
		});
	if (f.min != null || f.max != null)
		chips.push({
			key: 'price',
			label: priceRangeLabel(f.min, f.max, lang),
			href: queryWith(f, { min: null, max: null }, opts)
		});
	if (f.stock) chips.push({ key: 'stock', label: m.filter_in_stock(), href: queryWith(f, { stock: false }, opts) });
	return chips;
}
