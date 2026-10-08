<!--
  @component FreeShippingBar — "Nog € x tot gratis verzending" with a gold progress hairline.
  Announced politely when the amount changes.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatPrice } from '#lib/utils/format.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { remaining, threshold, lang }: { remaining: number; threshold: number; lang: 'nl' | 'fr' } = $props();
	const progress = $derived(Math.min(100, ((threshold - remaining) / Math.max(1, threshold)) * 100));
</script>

<div class="ship" role="status">
	{#if remaining > 0}
		<p>{m.cart_to_free_shipping({ amount: formatPrice(remaining, lang) })}</p>
	{:else}
		<p><Icon name="sparkle" size={12} /> {m.cart_free_shipping()}</p>
	{/if}
	<div class="bar" aria-hidden="true"><span style:width="{progress}%"></span></div>
</div>

<style>
	.ship {
		padding: var(--space-4);
		background: var(--ui-surface-sunken);
		font-size: var(--fs-xs);
	}
	p {
		margin: 0 0 var(--space-2);
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.bar {
		height: 2px;
		background: var(--ui-border);
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--ui-gold-gradient);
		transition: width var(--dur-slow) var(--motion-out);
	}
</style>
