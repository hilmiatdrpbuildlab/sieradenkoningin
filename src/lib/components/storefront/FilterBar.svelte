<!--
  @component FilterBar — sticky listing toolbar (DESIGN_SYSTEM §2.3). State lives in URL params:
  it is a plain GET form (works without JS: "Apply" button); with JS every change navigates
  immediately with goto() (history entry per change, so Back restores the previous filters).
  ≥ md: one popover (<details>) per facet + sort. < md: "Filter (n)" opens the FilterSheet.
  Applied filters show as removable chips (real links).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import FilterFields from './FilterFields.svelte';
	import FilterSheet from './FilterSheet.svelte';
	import SortSelect from './SortSelect.svelte';
	import {
		activeFilterCount,
		clearFiltersQuery,
		formToQuery,
		type ListingFacets,
		type ListingFilters,
		type SortKey
	} from './listing.ts';
	import { appliedChips, countLabel } from './listing-labels.ts';
	import type { Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		facets: ListingFacets;
		filters: ListingFilters;
		total: number;
		lang: Lang;
		sortOptions: SortKey[];
		defaultSort?: SortKey;
		/** non-filter params to keep, e.g. { q } on the search page */
		extra?: Record<string, string>;
	}
	let { facets, filters, total, lang, sortOptions, defaultSort = 'featured', extra = {} }: Props = $props();

	const uid = $props.id();
	let sheetOpen = $state(false);
	let js = $state(false);
	let bar: HTMLDivElement | undefined = $state();
	let top = $state(0);

	const count = $derived(activeFilterCount(filters));
	const chips = $derived(appliedChips(filters, lang, { defaultSort, extra }));
	const clearHref = $derived.by(() => {
		return clearFiltersQuery(filters, { defaultSort, extra }) || page.url.pathname;
	});
	const groups = $derived(
		(
			[
				['metal', m.filter_metal(), filters.metal.length, facets.metals.length > 0],
				['stone', m.filter_stone(), filters.stone.length, facets.stones.length > 0],
				['size', m.filter_size(), filters.size.length, facets.sizes.length > 0],
				['price', m.filter_price(), filters.min != null || filters.max != null ? 1 : 0, facets.price.max > 0]
			] as const
		).filter((g) => g[3])
	);

	onMount(() => {
		js = true;
		// stick just below the (sticky) site header, whatever its height (announcement bar or not)
		const header = document.querySelector<HTMLElement>('header.header');
		if (!header) return;
		const ro = new ResizeObserver(() => (top = header.offsetHeight));
		ro.observe(header);
		return () => ro.disconnect();
	});

	/** FormData → URL (empty values dropped, page reset) → client-side navigation. */
	function apply(form: HTMLFormElement) {
		goto(formToQuery(new FormData(form), defaultSort) || page.url.pathname, { reset: false });
	}

	function closePopovers(except?: EventTarget | null) {
		bar?.querySelectorAll('details[open]').forEach((d) => {
			if (!except || !d.contains(except as Node)) d.removeAttribute('open');
		});
	}
</script>

<svelte:window
	onclick={(e) => closePopovers(e.target)}
	onkeydown={(e) => {
		if (e.key === 'Escape' && bar?.querySelector('details[open]')) {
			const open = bar.querySelector<HTMLDetailsElement>('details[open]');
			closePopovers();
			open?.querySelector('summary')?.focus();
		}
	}}
/>

<div class="filterbar" style:--fb-top="{top}px" bind:this={bar}>
	<form
		id="filters{uid}"
		method="GET"
		class="bar container-lux"
		onchange={(e) => apply(e.currentTarget)}
		onsubmit={(e) => {
			e.preventDefault();
			apply(e.currentTarget);
			closePopovers();
		}}
	>
		{#each Object.entries(extra) as [k, v] (k)}{#if v}<input type="hidden" name={k} value={v} />{/if}{/each}

		<button type="button" class="sheet-btn" aria-haspopup="dialog" onclick={() => (sheetOpen = true)}>
			<Icon name="filter" size={16} />
			<span>{m.listing_filter()}</span>
			{#if count}<span class="badge" aria-label={m.filter_applied_count({ count })}>{count}</span>{/if}
		</button>

		<div class="groups">
			{#each groups as [key, label, n] (key)}
				<details class="pop">
					<summary>
						{label}{#if n}<span class="n" aria-label={m.filter_applied_count({ count: n })}>{n}</span>{/if}
						<Icon name="chevron-down" size={14} />
					</summary>
					<div class="panel">
						<FilterFields {facets} {filters} groups={[key]} legends={false} />
						<button type="submit" class="apply">{m.filter_apply()}</button>
					</div>
				</details>
			{/each}
			<label class="stock">
				<input type="checkbox" name="stock" value="1" checked={filters.stock} />
				<span class="box" aria-hidden="true"></span>
				{m.filter_in_stock()}
			</label>
			{#if !js}<button type="submit" class="apply apply--inline">{m.filter_apply()}</button>{/if}
		</div>

		<div class="end">
			<p class="total" aria-live="polite">{countLabel(total)}</p>
			<SortSelect value={filters.sort} options={sortOptions} />
		</div>
	</form>

	{#if chips.length}
		<div class="chips container-lux">
			<h2 class="sr-only">{m.filter_applied()}</h2>
			<ul>
				{#each chips as c (c.key)}
					<li>
						<a href={c.href} data-sveltekit-noscroll aria-label={m.filter_remove({ label: c.label })}>
							{c.label}<Icon name="close" size={12} />
						</a>
					</li>
				{/each}
				<li><a class="clear" href={clearHref} data-sveltekit-noscroll>{m.filter_clear()}</a></li>
			</ul>
		</div>
	{/if}
</div>

<FilterSheet
	bind:open={sheetOpen}
	{facets}
	{filters}
	{total}
	{clearHref}
	hidden={{ ...extra, sort: filters.sort === defaultSort ? '' : filters.sort }}
	onapply={apply}
/>

<style>
	.filterbar {
		position: sticky;
		top: var(--fb-top, 0);
		z-index: var(--z-sticky);
		background: var(--ui-glass);
		backdrop-filter: blur(12px);
		border-block: 1px solid var(--ui-border);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: 3.5rem;
	}
	.groups {
		display: none;
		align-items: center;
		gap: var(--space-6);
	}
	.sheet-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: 2.75rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	.badge,
	.n {
		display: inline-grid;
		place-items: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding-inline: 0.3rem;
		border-radius: var(--r-full);
		background: var(--ui-action);
		color: var(--ui-action-text);
		font-size: var(--fs-2xs);
		letter-spacing: 0;
	}
	@media (min-width: 48rem) {
		.sheet-btn {
			display: none;
		}
		.groups {
			display: flex;
		}
	}
	.pop {
		position: relative;
	}
	summary {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: 2.75rem;
		list-style: none;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary :global(svg) {
		transition: transform var(--dur-fast) var(--motion-out);
	}
	.pop[open] summary :global(svg) {
		transform: rotate(180deg);
	}
	summary:focus-visible,
	.sheet-btn:focus-visible,
	.chips a:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.panel {
		position: absolute;
		top: calc(100% + var(--space-2));
		left: calc(-1 * var(--space-4));
		z-index: var(--z-overlay);
		width: max-content;
		min-width: 15rem;
		max-width: 22rem;
		padding: var(--space-5) var(--space-5) var(--space-4);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		box-shadow: var(--elev-md);
		display: grid;
		gap: var(--space-4);
	}
	.apply {
		justify-self: start;
		height: 2.75rem;
		padding-inline: var(--space-5);
		border: 1px solid var(--ui-text);
		background: none;
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	.apply:hover {
		background: var(--ui-text);
		color: var(--ui-bg);
	}
	.stock {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	.stock input {
		position: absolute;
		inset: 0;
		opacity: 0;
		margin: 0;
		cursor: pointer;
	}
	.box {
		width: 1rem;
		height: 1rem;
		border: 1px solid var(--ui-border-strong);
		background: var(--ui-surface);
	}
	.stock input:checked + .box {
		background: var(--ui-action);
		border-color: var(--ui-action);
		box-shadow: inset 0 0 0 3px var(--ui-surface);
	}
	.stock input:focus-visible + .box {
		box-shadow: var(--elev-focus);
	}
	.end {
		display: flex;
		align-items: center;
		gap: var(--space-6);
	}
	.total {
		display: none;
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		white-space: nowrap;
	}
	@media (min-width: 64rem) {
		.total {
			display: block;
		}
	}
	.chips {
		padding-bottom: var(--space-3);
	}
	.chips ul {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chips a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-full);
		font-size: var(--fs-xs);
		text-decoration: none;
		color: var(--ui-text);
	}
	.chips a:hover {
		border-color: var(--ui-text);
	}
	.chips a.clear {
		border-color: transparent;
		text-decoration: underline;
		text-underline-offset: 0.3em;
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
