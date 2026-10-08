<!--
  @component SortSelect — native <select name="sort"> (best on mobile, keyboard + screen readers).
  Lives inside the listing's GET form; with JS a change applies immediately.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { SortKey } from './listing.ts';
	import { sortLabel } from './listing-labels.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		value: SortKey;
		options: SortKey[];
		form?: string;
	}
	let { value, options, form }: Props = $props();
	const uid = $props.id();
</script>

<div class="sort">
	<label for="sort{uid}">{m.listing_sort()}</label>
	<div class="wrap">
		<select id="sort{uid}" name="sort" {form}>
			{#each options as o (o)}
				<option value={o} selected={o === value}>{sortLabel(o)}</option>
			{/each}
		</select>
		<Icon name="chevron-down" size={14} />
	</div>
</div>

<style>
	.sort {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	label {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-muted);
		white-space: nowrap;
	}
	.wrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	select {
		appearance: none;
		height: 2.75rem;
		padding: 0 var(--space-6) 0 0;
		border: 0;
		background: transparent;
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		cursor: pointer;
	}
	select:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.wrap :global(svg) {
		position: absolute;
		right: 0;
		pointer-events: none;
	}
	@media (max-width: 47.99rem) {
		label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}
</style>
