<!--
  @component VariantPicker — metal swatches (ui/Radio variant="swatch") + size select with the
  "Maatgids" dialog. Emits the variant id that matches metal × size (keeps the size when switching
  metal if it exists; otherwise the first in-stock size).
-->
<script lang="ts">
	import Radio from '#lib/components/ui/Radio.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import SizeGuideDialog from './SizeGuideDialog.svelte';
	import { metalLabel } from './listing-labels.ts';
	import { sortSizes } from './listing.ts';
	import type { Metal, PdpVariant } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		variants: PdpVariant[];
		value: string | null;
		sizeKind?: 'ring' | 'bracelet' | null;
		onchange: (variantId: string) => void;
	}
	let { variants, value, sizeKind = null, onchange }: Props = $props();
	const uid = $props.id();
	let guideOpen = $state(false);

	const current = $derived(variants.find((v) => v.id === value) ?? null);
	const metals = $derived([...new Set(variants.map((v) => v.metal))]);
	const sizesFor = (metal: Metal | undefined) => variants.filter((v) => v.metal === metal && v.size);
	const sizeOptions = $derived(
		sortSizes(sizesFor(current?.metal).map((v) => v.size!)).map((s) => {
			const v = variants.find((x) => x.metal === current?.metal && x.size === s)!;
			return { value: s, id: v.id, label: v.stock > 0 ? s : m.pdp_size_soldout({ size: s }) };
		})
	);
	const swatch = {
		gold: 'var(--ui-swatch-gold)',
		rosegold: 'var(--ui-swatch-rosegold)',
		silver: 'var(--ui-swatch-silver)'
	};

	function pickSize(size: string) {
		const v = variants.find((x) => x.metal === current?.metal && x.size === size);
		if (v) onchange(v.id);
	}

	function pickMetal(metal: string) {
		const same = variants.filter((v) => v.metal === metal);
		const next = same.find((v) => v.size === current?.size && v.size) ?? same.find((v) => v.stock > 0) ?? same[0];
		if (next) onchange(next.id);
	}
</script>

<div class="picker">
	{#if metals.length > 1}
		<Radio
			name="metal"
			legend="{m.filter_metal()}: {current ? metalLabel(current.metal) : ''}"
			variant="swatch"
			value={current?.metal ?? null}
			options={metals.map((mt) => ({ value: mt, label: metalLabel(mt), swatch: swatch[mt] }))}
			onchange={pickMetal}
		/>
	{:else if metals.length === 1}
		<p class="single"><span class="lbl">{m.filter_metal()}</span> {metalLabel(metals[0])}</p>
	{/if}

	{#if sizeOptions.length}
		<div class="size">
			<div class="size-head">
				<label for="size{uid}">{m.filter_size()}</label>
				{#if sizeKind}
					<button type="button" class="guide" onclick={() => (guideOpen = true)} aria-haspopup="dialog">
						<Icon name="info" size={14} />{m.pdp_size_guide()}
					</button>
				{/if}
			</div>
			<div class="select">
				<select id="size{uid}" name="size" value={current?.size} onchange={(e) => pickSize(e.currentTarget.value)}>
					{#each sizeOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</select>
				<Icon name="chevron-down" size={16} />
			</div>
		</div>
	{/if}
</div>

{#if sizeKind}<SizeGuideDialog bind:open={guideOpen} kind={sizeKind} />{/if}

<style>
	.picker {
		display: grid;
		gap: var(--space-6);
	}
	.single {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.lbl,
	label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		margin-right: var(--space-2);
	}
	.size-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-2);
	}
	.guide {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2.75rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ui-text-muted);
		font: inherit;
		font-size: var(--fs-xs);
		text-decoration: underline;
		text-underline-offset: 0.3em;
		cursor: pointer;
	}
	.guide:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.select {
		position: relative;
		display: flex;
		align-items: center;
	}
	select {
		appearance: none;
		width: 100%;
		height: 3rem;
		padding: 0 var(--space-8) 0 var(--space-4);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.select :global(svg) {
		position: absolute;
		right: var(--space-4);
		pointer-events: none;
	}
</style>
