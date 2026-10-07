<!-- @component QuoteBand — espresso (or burgundy) band with a centred uppercase quote and a crown. -->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import { reveal } from '#lib/actions/reveal.ts';
	import { m } from '#lib/paraglide/messages.js';
	let { quote, attribution, surface = 'espresso' }: { quote: string; attribution?: string; surface?: 'espresso' | 'inverse' } = $props();
</script>

<section class="band" data-surface={surface} aria-label={m.quote_label()}>
	<figure class="container-lux" use:reveal>
		<Icon name="crown" size={30} stroke={1} class="orn" />
		<blockquote><p>{quote}</p></blockquote>
		{#if attribution}<figcaption>{attribution}</figcaption>{/if}
	</figure>
</section>

<style>
	.band {
		padding-block: var(--section-y-sm);
	}
	figure {
		margin: 0 auto;
		display: grid;
		justify-items: center;
		gap: var(--space-5);
		text-align: center;
	}
	figure :global(.orn) {
		color: var(--ui-accent);
	}
	blockquote {
		margin: 0;
		max-width: 52rem;
	}
	blockquote p {
		margin: 0;
		font-family: var(--ff-display);
		font-size: var(--fs-3xl);
		line-height: var(--lh-snug);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-wrap: balance;
	}
	figcaption {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-muted);
	}
</style>
