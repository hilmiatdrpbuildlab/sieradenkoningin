<!--
  @component FilterFields — the native form controls of the listing filters (GET form fields named
  after the URL params). Used per group in the desktop FilterBar popovers and all together in the
  mobile FilterSheet. Without JS the surrounding form submits them as-is.
-->
<script lang="ts">
	import type { ListingFacets, ListingFilters } from './listing.ts';
	import { metalLabel, stoneLabel } from './listing-labels.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Group = 'metal' | 'stone' | 'size' | 'price' | 'stock';
	interface Props {
		facets: ListingFacets;
		filters: ListingFilters;
		groups?: Group[];
		/** show the fieldset legend (the sheet shows it; popovers already have a summary) */
		legends?: boolean;
	}
	let { facets, filters, groups = ['metal', 'stone', 'size', 'price', 'stock'], legends = true }: Props = $props();
	const uid = $props.id();
	const euros = (c: number | null) => (c == null ? '' : String(c / 100));
	const has = (g: Group) => groups.includes(g);
</script>

{#if has('metal') && facets.metals.length}
	<fieldset class="group">
		<legend class:sr-only={!legends}>{m.filter_metal()}</legend>
		<div class="opts">
			{#each facets.metals as v (v)}
				<label class="opt">
					<input type="checkbox" name="metal" value={v} checked={filters.metal.includes(v)} />
					<span class="swatch swatch--{v}" aria-hidden="true"></span>
					<span>{metalLabel(v)}</span>
				</label>
			{/each}
		</div>
	</fieldset>
{/if}

{#if has('stone') && facets.stones.length}
	<fieldset class="group">
		<legend class:sr-only={!legends}>{m.filter_stone()}</legend>
		<div class="opts">
			{#each facets.stones as v (v)}
				<label class="opt">
					<input type="checkbox" name="stone" value={v} checked={filters.stone.includes(v)} />
					<span class="box" aria-hidden="true"></span>
					<span>{stoneLabel(v)}</span>
				</label>
			{/each}
		</div>
	</fieldset>
{/if}

{#if has('size') && facets.sizes.length}
	<fieldset class="group">
		<legend class:sr-only={!legends}>{m.filter_size()}</legend>
		<div class="chips">
			{#each facets.sizes as v (v)}
				<label class="chip">
					<input type="checkbox" name="size" value={v} checked={filters.size.includes(v)} />
					<span>{v}</span>
				</label>
			{/each}
		</div>
	</fieldset>
{/if}

{#if has('price')}
	<fieldset class="group">
		<legend class:sr-only={!legends}>{m.filter_price()}</legend>
		<div class="range">
			<label for="pmin{uid}">{m.filter_price_min()}</label>
			<input
				id="pmin{uid}"
				type="number"
				name="min"
				inputmode="numeric"
				min="0"
				step="1"
				placeholder={String(Math.floor(facets.price.min / 100))}
				value={euros(filters.min)}
			/>
			<label for="pmax{uid}">{m.filter_price_max()}</label>
			<input
				id="pmax{uid}"
				type="number"
				name="max"
				inputmode="numeric"
				min="0"
				step="1"
				placeholder={String(Math.ceil(facets.price.max / 100))}
				value={euros(filters.max)}
			/>
		</div>
	</fieldset>
{/if}

{#if has('stock')}
	<label class="opt toggle">
		<input type="checkbox" name="stock" value="1" checked={filters.stock} />
		<span class="box" aria-hidden="true"></span>
		<span>{m.filter_in_stock()}</span>
	</label>
{/if}

<style>
	.group {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-3);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	.group + .group,
	.group + .toggle {
		margin-top: var(--space-6);
	}
	.opts {
		display: grid;
		gap: var(--space-1);
	}
	.opt {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 2.75rem;
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.opt input,
	.chip input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
	.box {
		width: 1.125rem;
		height: 1.125rem;
		border: 1px solid var(--ui-border-strong);
		background: var(--ui-surface);
		display: grid;
		place-items: center;
		flex: none;
	}
	.box::after {
		content: '';
		width: 0.55rem;
		height: 0.3rem;
		border-left: 1.5px solid var(--ui-action-text);
		border-bottom: 1.5px solid var(--ui-action-text);
		transform: rotate(-45deg) translate(1px, -1px) scale(0);
		transition: transform var(--dur-fast) var(--motion-out);
	}
	input:checked ~ .box {
		background: var(--ui-action);
		border-color: var(--ui-action);
	}
	input:checked ~ .box::after {
		transform: rotate(-45deg) translate(1px, -1px) scale(1);
	}
	.swatch {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		flex: none;
		box-shadow:
			0 0 0 2px var(--ui-bg),
			0 0 0 3px var(--ui-border);
	}
	input:checked ~ .swatch {
		box-shadow:
			0 0 0 2px var(--ui-bg),
			0 0 0 3px var(--ui-text);
	}
	.opt:has(input:checked) > span:last-child {
		font-weight: var(--fw-medium);
	}
	input:focus-visible ~ .box,
	input:focus-visible ~ .swatch,
	.chip:has(input:focus-visible) {
		box-shadow: var(--elev-focus);
	}
	.swatch--gold {
		background: var(--ui-swatch-gold);
	}
	.swatch--rosegold {
		background: var(--ui-swatch-rosegold);
	}
	.swatch--silver {
		background: var(--ui-swatch-silver);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 2.75rem;
		height: 2.75rem;
		padding-inline: var(--space-3);
		border: 1px solid var(--ui-border);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: border-color var(--dur-fast);
	}
	.chip:hover {
		border-color: var(--ui-border-strong);
	}
	.chip:has(input:checked) {
		background: var(--ui-action);
		border-color: var(--ui-action);
		color: var(--ui-action-text);
	}
	.range {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto auto;
		grid-auto-flow: column;
		column-gap: var(--space-4);
		row-gap: var(--space-1);
	}
	.range label {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.range input {
		width: 100%;
		height: 3rem;
		border: 0;
		border-bottom: 1px solid var(--ui-border-strong);
		background: transparent;
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-base);
		padding: 0;
	}
	.range input:focus-visible {
		outline: none;
		border-bottom-color: var(--ui-border-focus);
		box-shadow: 0 1px 0 0 var(--ui-border-focus);
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
