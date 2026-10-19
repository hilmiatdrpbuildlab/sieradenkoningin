<!--
  @component FeatureGrid — 2–6 brand values / reasons (icon, Playfair title, short text), e.g. the
  “Waarom De Sieradenkoningin” section of the home page (brandbook §04). 1 column on phones, 2 on
  tablets, up to 4 per row on desktop; centred so an odd count stays balanced.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import { reveal } from '#lib/actions/reveal.ts';

	interface Props {
		eyebrow?: string;
		title: string;
		intro?: string;
		items: { icon: string; title: string; text?: string }[];
	}
	let { eyebrow, title, intro, items }: Props = $props();
	const uid = $props.id();
</script>

<section class="features" aria-labelledby="fg{uid}">
	<div class="container-lux">
		<header class="head">
			{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
			<h2 id="fg{uid}">{title}</h2>
			{#if intro}<p class="intro">{intro}</p>{/if}
		</header>
		<ul class="list" use:reveal={{ stagger: true }} style:--cols={items.length === 6 ? 3 : items.length}>
			{#each items as item, i (i)}
				<li>
					<span class="ico"><Icon name={item.icon as IconName} size={36} stroke={1} /></span>
					<h3>{item.title}</h3>
					{#if item.text}<p>{item.text}</p>{/if}
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.features {
		padding-block: var(--section-y);
		background: var(--ui-surface-sunken);
	}
	.head {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		max-width: var(--container-text);
		margin: 0 auto var(--space-12);
		text-align: center;
	}
	.head h2 {
		margin: 0;
		color: var(--ui-text-strong);
	}
	.intro {
		margin: 0;
		color: var(--ui-text-muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-10) var(--grid-gap);
	}
	li {
		flex: 1 1 100%;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: var(--space-3);
		padding-inline: var(--space-4);
		text-align: center;
	}
	@media (min-width: 40rem) {
		li {
			flex-basis: calc(50% - var(--grid-gap));
			max-width: calc(50% - var(--grid-gap));
		}
	}
	@media (min-width: 64rem) {
		li {
			flex-basis: calc(100% / var(--cols) - var(--grid-gap));
			max-width: calc(100% / var(--cols) - var(--grid-gap));
		}
	}
	.ico {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		border: 1px solid var(--ui-ornament);
		border-radius: var(--r-full);
		color: var(--ui-accent);
	}
	h3 {
		margin: var(--space-2) 0 0;
		font-family: var(--ff-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-regular);
		color: var(--ui-text-strong);
		text-transform: none;
		letter-spacing: 0;
	}
	li p {
		margin: 0;
		max-width: 22rem;
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
		color: var(--ui-text-muted);
	}
</style>
