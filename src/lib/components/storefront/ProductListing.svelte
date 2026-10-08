<!--
  @component ProductListing — category / collection / search results page body (P1-07):
  breadcrumb, editorial header with intro, FilterBar (URL-param state), ProductGrid, empty state,
  "load more" (progressive: a real `?page=n+1` link that appends the next page in place with JS),
  and real pagination links for crawlers and no-JS.
  Routes put their data under `data.listing` and wire `capture/restore` into `export const snapshot`
  so pages loaded with "load more" survive the Back button.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import FilterBar from './FilterBar.svelte';
	import ProductGrid from './ProductGrid.svelte';
	import { PAGE_SIZE, hasFilters, queryWith, type ListingData, type SortKey } from './listing.ts';
	import type { ProductCardData } from '#lib/types.ts';
	import type { Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		listing: ListingData;
		lang: Lang;
		title: string;
		eyebrow?: string;
		/** sanitized HTML (markdownToHtml) */
		introHtml?: string;
		crumbs: { label: string; href?: string }[];
		sortOptions?: SortKey[];
		defaultSort?: SortKey;
		extra?: Record<string, string>;
		/** replaces the default empty state when the base set itself is empty (no filters) */
		empty?: Snippet;
		header?: Snippet;
	}
	let {
		listing,
		lang,
		title,
		eyebrow,
		introHtml,
		crumbs,
		sortOptions = ['featured', 'new', 'price_asc', 'price_desc'],
		defaultSort = 'featured',
		extra = {},
		empty,
		header
	}: Props = $props();

	const opts = $derived({ defaultSort, extra });
	// Cards appended with "load more"; reset whenever the server listing changes (filters, sort, page).
	let more = $derived.by<ProductCardData[]>(() => {
		void listing;
		return [];
	});
	let lastPage = $derived(listing.page);
	let loading = $state(false);
	let gridStart: HTMLElement | undefined = $state();

	const shown = $derived(
		Math.min(
			listing.total,
			(lastPage - 1) * PAGE_SIZE + (lastPage === listing.page ? listing.products.length : PAGE_SIZE)
		)
	);
	const nextHref = $derived(lastPage < listing.pages ? queryWith(listing.filters, { page: lastPage + 1 }, opts) : null);
	const products = $derived([...listing.products, ...more]);
	const filtered = $derived(hasFilters(listing.filters));

	async function loadMore(e: MouseEvent) {
		if (!nextHref || loading || e.metaKey || e.ctrlKey || e.shiftKey) return;
		e.preventDefault();
		loading = true;
		try {
			const r = await preloadData(page.url.pathname + nextHref);
			const next = r.type === 'loaded' ? (r.data.listing as ListingData | undefined) : undefined;
			if (!next) return void (location.href = nextHref);
			const seen = new Set(products.map((p) => p.id));
			const firstNew = products.length;
			more = [...more, ...next.products.filter((p) => !seen.has(p.id))];
			lastPage = next.page;
			// move focus to the first new card for keyboard + screen-reader users
			requestAnimationFrame(() =>
				gridStart?.querySelectorAll<HTMLAnchorElement>('a.stretched')[firstNew]?.focus({ preventScroll: true })
			);
		} finally {
			loading = false;
		}
	}

	export function capture() {
		return { key: page.url.search, more, lastPage };
	}
	export function restore(s: { key: string; more: ProductCardData[]; lastPage: number } | undefined) {
		if (!s || s.key !== page.url.search) return;
		more = s.more;
		lastPage = s.lastPage;
	}
</script>

<div class="listing">
	<header class="head container-lux">
		<Breadcrumbs items={crumbs} />
		{#if header}{@render header()}{/if}
		<div class="intro">
			{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
			<h1>
				{title}{#if listing.page > 1}<span class="sr-only"> — {m.listing_page_n({ n: listing.page })}</span>{/if}
			</h1>
			<span class="orn hairline-divider" aria-hidden="true">✦</span>
			{#if introHtml}<div class="lead">{@html introHtml}</div>{/if}
		</div>
	</header>

	{#if listing.total > 0 || filtered}
		<FilterBar
			facets={listing.facets}
			filters={listing.filters}
			total={listing.total}
			{lang}
			{sortOptions}
			{defaultSort}
			{extra}
		/>
	{/if}

	<section class="results container-lux" aria-label={title} bind:this={gridStart}>
		{#if products.length}
			<ProductGrid {products} label={title} />
			<div class="more">
				<p class="progress" aria-live="polite">{m.listing_progress({ shown, total: listing.total })}</p>
				<span class="bar" aria-hidden="true"
					><span style:width="{listing.total ? (shown / listing.total) * 100 : 0}%"></span></span
				>
				{#if nextHref}
					<Button href={nextHref} variant="outline" {loading} onclick={loadMore} rel="next"
						>{m.listing_load_more()}</Button
					>
				{/if}
			</div>
			{#if listing.pages > 1}
				<div class="pager">
					<Pagination
						page={listing.page}
						pages={listing.pages}
						href={(n) => queryWith(listing.filters, { page: n }, opts)}
					/>
				</div>
			{/if}
		{:else if filtered}
			<EmptyState title={m.listing_empty_title()} text={m.listing_empty_text()}>
				{#snippet action()}
					<Button
						href={queryWith(
							listing.filters,
							{ metal: [], stone: [], size: [], min: null, max: null, stock: false },
							opts
						)}
						variant="outline">{m.filter_clear()}</Button
					>
				{/snippet}
			</EmptyState>
		{:else if empty}
			{@render empty()}
		{:else}
			<EmptyState title={m.listing_empty_title()} text={m.listing_empty_category()}>
				{#snippet action()}
					<Button href="/{lang}" variant="outline">{m.wishlist_empty_cta()}</Button>
				{/snippet}
			</EmptyState>
		{/if}
	</section>
</div>

<style>
	.head {
		padding-top: var(--space-6);
		padding-bottom: var(--space-10);
	}
	.intro {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		margin-top: var(--space-8);
		text-align: center;
	}
	.intro .eyebrow {
		margin: 0;
	}
	h1 {
		margin: 0;
		font-size: var(--fs-4xl);
		color: var(--ui-text-strong);
	}
	.orn {
		width: min(12rem, 60%);
		font-size: var(--fs-xs);
	}
	.lead {
		max-width: var(--container-text);
		color: var(--ui-text-muted);
		font-size: var(--fs-lg);
		font-weight: var(--fw-light, 300);
		line-height: var(--lh-relaxed, 1.7);
	}
	.lead :global(p) {
		margin: 0 0 var(--space-3);
	}
	.results {
		padding-top: var(--space-8);
		padding-bottom: var(--section-y);
	}
	.more {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		margin-top: var(--space-16);
	}
	.progress {
		margin: 0;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
	}
	.bar {
		width: min(14rem, 70%);
		height: 1px;
		background: var(--ui-border);
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--ui-ornament);
		transition: width var(--dur-slow) var(--motion-out);
	}
	.pager {
		display: flex;
		justify-content: center;
		margin-top: var(--space-8);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
