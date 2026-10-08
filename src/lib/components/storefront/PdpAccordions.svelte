<!--
  @component PdpAccordions — Details · Met betekenis · Verzending & retour · Onderhoud (native
  <details>, so content is crawlable and works without JS). Empty sections are left out.
-->
<script lang="ts">
	import Accordion from '#lib/components/ui/Accordion.svelte';
	import { formatPrice } from '#lib/utils/format.ts';
	import type { Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		lang: Lang;
		descriptionHtml: string;
		meaningHtml: string;
		careHtml: string;
		material: string;
		sku: string | null;
		freeFrom: number;
		returnDays: number;
		shippingHref: string | null;
	}
	let { lang, descriptionHtml, meaningHtml, careHtml, material, sku, freeFrom, returnDays, shippingHref }: Props =
		$props();

	const items = $derived(
		[
			{ id: 'details', title: m.pdp_details(), open: true, show: true },
			{ id: 'meaning', title: m.pdp_meaning(), show: !!meaningHtml },
			{ id: 'shipping', title: m.pdp_shipping(), show: true },
			{ id: 'care', title: m.pdp_care(), show: !!careHtml }
		].filter((i) => i.show)
	);
</script>

<div class="acc">
	<Accordion {items}>
		{#snippet content(id)}
			<div class="prose">
				{#if id === 'details'}
					{@html descriptionHtml}
					<dl>
						{#if material}<dt>{m.pdp_material()}</dt>
							<dd>{material}</dd>{/if}
						{#if sku}<dt>{m.pdp_sku()}</dt>
							<dd>{sku}</dd>{/if}
					</dl>
				{:else if id === 'meaning'}
					{@html meaningHtml}
				{:else if id === 'shipping'}
					<p>{m.pdp_shipping_text({ freeFrom: formatPrice(freeFrom, lang), days: returnDays })}</p>
					{#if shippingHref}<p><a href={shippingHref}>{m.pdp_shipping()}</a></p>{/if}
				{:else if id === 'care'}
					{@html careHtml}
				{/if}
			</div>
		{/snippet}
	</Accordion>
</div>

<style>
	.prose {
		color: var(--ui-text);
		font-size: var(--fs-sm);
		line-height: var(--lh-relaxed, 1.7);
	}
	.prose :global(p) {
		margin: 0 0 var(--space-3);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-3) 0 0;
	}
	dt {
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	dd {
		margin: 0;
	}
	a {
		text-underline-offset: 0.3em;
	}
</style>
