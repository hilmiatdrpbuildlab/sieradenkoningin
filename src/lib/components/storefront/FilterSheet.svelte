<!--
  @component FilterSheet — mobile bottom sheet (ui/Drawer side="bottom") with every filter group.
  Changes apply live (the result count in the footer updates); "Show results" closes the sheet.
-->
<script lang="ts">
	import Drawer from '#lib/components/ui/Drawer.svelte';
	import FilterFields from './FilterFields.svelte';
	import type { ListingFacets, ListingFilters } from './listing.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		open?: boolean;
		facets: ListingFacets;
		filters: ListingFilters;
		total: number;
		clearHref: string;
		/** hidden fields to keep (q, sort) */
		hidden?: Record<string, string>;
		onapply: (form: HTMLFormElement) => void;
	}
	let { open = $bindable(false), facets, filters, total, clearHref, hidden = {}, onapply }: Props = $props();
	const uid = $props.id();
</script>

<Drawer bind:open side="bottom" title={m.listing_filters_title()}>
	<form
		id="sheet{uid}"
		method="GET"
		onchange={(e) => onapply(e.currentTarget)}
		onsubmit={(e) => {
			e.preventDefault();
			onapply(e.currentTarget);
			open = false;
		}}
	>
		{#each Object.entries(hidden) as [k, v] (k)}{#if v}<input type="hidden" name={k} value={v} />{/if}{/each}
		<FilterFields {facets} {filters} />
	</form>
	{#snippet footer()}
		<div class="foot">
			<a class="clear" href={clearHref} onclick={() => (open = false)}>{m.filter_clear()}</a>
			<button type="submit" form="sheet{uid}" class="show">{m.filter_show_results({ count: total })}</button>
		</div>
	{/snippet}
</Drawer>

<style>
	form {
		padding-bottom: var(--space-4);
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		width: 100%;
	}
	.clear {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-underline-offset: 0.3em;
		padding-block: var(--space-3);
	}
	.show {
		flex: 1;
		max-width: 18rem;
		height: 3rem;
		border: 0;
		background: var(--ui-action);
		color: var(--ui-action-text);
		font: inherit;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	.show:hover {
		background: var(--ui-action-hover);
	}
	.show:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
</style>
