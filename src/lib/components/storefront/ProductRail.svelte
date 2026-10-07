<!--
  @component ProductRail — titled horizontal row of ProductCards. Scroll-snap carousel with
  previous/next buttons on pointer devices; native swipe on touch.
-->
<script lang="ts">
	import ProductCard from './ProductCard.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import type { ProductCardData } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		eyebrow?: string;
		title: string;
		products: ProductCardData[];
		cta?: { label: string; href: string } | null;
	}
	let { eyebrow, title, products, cta }: Props = $props();
	let track: HTMLUListElement | undefined = $state();
	const uid = $props.id();

	function scroll(dir: 1 | -1) {
		track?.scrollBy({ left: dir * (track?.clientWidth ?? 0) * 0.8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
	}
</script>

{#if products.length}
	<section class="rail" aria-labelledby="rail{uid}">
		<div class="container-lux">
			<header class="head">
				<div>
					{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
					<h2 id="rail{uid}">{title}</h2>
				</div>
				<div class="controls">
					{#if cta}<Button href={cta.href} variant="link" iconRight="arrow-right">{cta.label}</Button>{/if}
					<button type="button" class="nav" aria-label={m.rail_previous()} onclick={() => scroll(-1)}><Icon name="chevron-left" size={18} /></button>
					<button type="button" class="nav" aria-label={m.rail_next()} onclick={() => scroll(1)}><Icon name="chevron-right" size={18} /></button>
				</div>
			</header>
			<ul class="track" bind:this={track}>
				{#each products as p (p.id)}
					<li><ProductCard product={p} /></li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	.rail {
		padding-block: var(--section-y-sm);
	}
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-8);
	}
	.head h2 {
		margin: var(--space-2) 0 0;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.nav {
		display: none;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		border: 1px solid var(--ui-border-strong);
		background: none;
		color: var(--ui-text);
		cursor: pointer;
	}
	@media (hover: hover) and (min-width: 64rem) {
		.nav {
			display: grid;
		}
	}
	.nav:hover {
		background: var(--ui-text);
		color: var(--ui-bg);
	}
	.track {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: calc((100% - var(--grid-gap)) / 2.2);
		gap: var(--grid-gap);
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	@media (min-width: 48rem) {
		.track {
			grid-auto-columns: calc((100% - 2 * var(--grid-gap)) / 3);
		}
	}
	@media (min-width: 80rem) {
		.track {
			grid-auto-columns: calc((100% - 3 * var(--grid-gap)) / 4);
		}
	}
	li {
		scroll-snap-align: start;
	}
</style>
