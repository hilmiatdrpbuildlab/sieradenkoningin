<!--
  @component ProductGrid — 2 / 3 / 4 columns (below md / md / xl) of ProductCards (DESIGN_SYSTEM §2.3).
  The first row is loaded eagerly (LCP); everything else lazily.
-->
<script lang="ts">
	import ProductCard from './ProductCard.svelte';
	import type { ProductCardData } from '#lib/types.ts';

	interface Props {
		products: ProductCardData[];
		/** number of leading cards loaded eagerly */
		eager?: number;
		headingLevel?: 2 | 3 | 4;
		label?: string;
	}
	let { products, eager = 2, headingLevel = 2, label }: Props = $props();
</script>

<ul class="grid" aria-label={label}>
	{#each products as p, i (p.id)}
		<li><ProductCard product={p} eager={i < eager} {headingLevel} /></li>
	{/each}
</ul>

<style>
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: var(--grid-gap);
		row-gap: calc(var(--grid-gap) * 2.5);
	}
	@media (min-width: 48rem) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (min-width: 80rem) {
		.grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
