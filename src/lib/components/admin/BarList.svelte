<!--
  @component BarList — ranked horizontal bars for one measure (sales per category / product).
  Label and value are always visible as text (identity never by colour); bars are one hue.
-->
<script lang="ts">
	interface Item {
		label: string;
		value: number;
		meta?: string;
	}
	let { title, items, format, hideTitle = false }: { title: string; items: Item[]; format: (v: number) => string; hideTitle?: boolean } = $props();
	const max = $derived(Math.max(1, ...items.map((i) => i.value)));
	const uid = $props.id();
</script>

<figure class="bars">
	<figcaption id="bl{uid}" class:sr-only={hideTitle}>{title}</figcaption>
	{#if items.length}
		<ol aria-labelledby="bl{uid}">
			{#each items as item, i (i)}
				<li>
					<div class="row">
						<span class="label">{item.label}</span>
						<span class="value">{format(item.value)}{#if item.meta}<small> · {item.meta}</small>{/if}</span>
					</div>
					<div class="track" aria-hidden="true"><span style:width="{(item.value / max) * 100}%"></span></div>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">Nog geen verkopen in deze periode.</p>
	{/if}
</figure>

<style>
	.bars {
		margin: 0;
	}
	figcaption {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		margin-bottom: var(--space-3);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		font-size: var(--fs-sm);
		margin-bottom: var(--space-1);
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.value {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	small {
		color: var(--ui-text-muted);
	}
	.track {
		height: 8px;
		background: var(--ui-surface-sunken);
		border-radius: 0 4px 4px 0;
	}
	.track span {
		display: block;
		height: 100%;
		min-width: 2px;
		background: var(--ui-accent);
		border-radius: 0 4px 4px 0;
	}
	.empty {
		margin: 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
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
