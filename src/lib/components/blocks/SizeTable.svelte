<!--
  @component SizeTable — ring sizes (EU size = inner circumference in mm; diameter = circumference / π)
  and bracelet sizes, plus a printable ring sizer (P4-02). The sizer prints at true scale.
-->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { title, kind = 'ring' }: { title?: string; kind?: 'ring' | 'bracelet' } = $props();
	const uid = $props.id();
	const rings = [48, 50, 52, 54, 56, 58, 60].map((size) => ({ size, circumference: size, diameter: (size / Math.PI).toFixed(1) }));
	const bracelets = [
		{ size: 'S', wrist: '15 – 16' },
		{ size: 'M', wrist: '16,5 – 17,5' },
		{ size: 'L', wrist: '18 – 19' }
	];
</script>

<section class="sizes container-lux" aria-labelledby="st{uid}">
	<h2 id="st{uid}">{title || (kind === 'ring' ? m.size_ring_title() : m.size_bracelet_title())}</h2>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th scope="col">{m.size_col_size()}</th>
					{#if kind === 'ring'}<th scope="col">{m.size_col_circumference()}</th><th scope="col">{m.size_col_diameter()}</th>
					{:else}<th scope="col">{m.size_col_wrist()}</th>{/if}
				</tr>
			</thead>
			<tbody>
				{#if kind === 'ring'}
					{#each rings as r (r.size)}<tr><th scope="row">{r.size}</th><td>{r.circumference}</td><td>{r.diameter}</td></tr>{/each}
				{:else}
					{#each bracelets as b (b.size)}<tr><th scope="row">{b.size}</th><td>{b.wrist}</td></tr>{/each}
				{/if}
			</tbody>
		</table>
	</div>
	{#if kind === 'ring'}
		<div class="how">
			<h3>{m.size_how_title()}</h3>
			<p>{m.size_how_text()}</p>
			<Button variant="outline" size="sm" icon="printer" onclick={() => window.print()}>{m.size_print()}</Button>
		</div>
		<div class="printable" aria-hidden="true">
			<p>{m.size_print_note()}</p>
			<div class="ruler"><span>5 cm</span></div>
			<div class="strip">
				{#each rings as r (r.size)}<span style:left="{(r.circumference - 46) * 4}mm">{r.size}</span>{/each}
			</div>
		</div>
	{/if}
</section>

<style>
	.sizes {
		padding-block: var(--section-y-sm);
		max-width: calc(var(--container-text) + 2 * var(--gutter));
	}
	h2 {
		margin: 0 0 var(--space-6);
		font-size: var(--fs-2xl);
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--ui-border);
		text-align: left;
		font-size: var(--fs-sm);
	}
	thead th {
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-muted);
		font-weight: var(--fw-medium);
	}
	tbody th {
		font-weight: var(--fw-medium);
	}
	.how {
		margin-top: var(--space-8);
		display: grid;
		gap: var(--space-3);
		justify-items: start;
	}
	.how h3 {
		margin: 0;
		font-size: var(--fs-xl);
	}
	.how p {
		margin: 0;
		color: var(--ui-text);
	}
	.printable {
		display: none;
	}
	@media print {
		.printable {
			display: block;
			margin-top: 1cm;
		}
		.how :global(button) {
			display: none;
		}
		.ruler {
			width: 5cm;
			border-top: 1px solid black;
			margin: 0.5cm 0;
			font-size: 9pt;
		}
		.strip {
			position: relative;
			width: 80mm;
			height: 12mm;
			border: 1px dashed black;
			font-size: 7pt;
		}
		.strip span {
			position: absolute;
			top: 2mm;
			border-left: 1px solid black;
			padding-left: 1mm;
		}
	}
</style>
