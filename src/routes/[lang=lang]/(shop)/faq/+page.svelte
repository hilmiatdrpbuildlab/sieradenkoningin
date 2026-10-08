<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import FaqList from '#lib/components/blocks/FaqList.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { markdownToText } from '#lib/utils/markdown.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();

	const GROUPS: Record<string, () => string> = {
		general: m.faq_group_general,
		orders: m.faq_group_orders,
		shipping: m.faq_group_shipping,
		returns: m.faq_group_returns,
		products: m.faq_group_products,
		payment: m.faq_group_payment
	};
	const groupTitle = (g: string) => GROUPS[g]?.() ?? g.charAt(0).toUpperCase() + g.slice(1).replace(/-/g, ' ');
	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: data.groups.flatMap((g) =>
				g.items.map((i) => ({
					'@type': 'Question',
					name: i.question,
					acceptedAnswer: { '@type': 'Answer', text: markdownToText(i.answer, 1000) }
				}))
			)
		}
	]);
</script>

<Seo title={m.faq_title()} description={m.faq_meta_description()} {jsonLd} />

<header class="head container-lux">
	<h1>{m.faq_title()}</h1>
	<p>{m.faq_intro()}</p>
</header>

{#each data.groups as g (g.group)}
	<FaqList title={data.groups.length > 1 ? groupTitle(g.group) : undefined} items={g.items} />
{:else}
	<FaqList items={[]} />
{/each}

<aside class="more container-lux" aria-labelledby="faq-more">
	<h2 id="faq-more">{m.faq_more_title()}</h2>
	<p>{m.faq_more_text()}</p>
	<Button href={localizeHref('/contact', data.lang)} variant="outline">{m.faq_more_link()}</Button>
</aside>

<style>
	.head {
		max-width: calc(var(--container-text) + 2 * var(--gutter));
		padding-top: var(--space-12);
		text-align: center;
	}
	h1 {
		margin: 0 0 var(--space-3);
		font-size: var(--fs-4xl);
	}
	.head p {
		margin: 0 auto;
		color: var(--ui-text-muted);
		max-width: 36rem;
	}
	.more {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		padding-block: var(--space-8) 0;
		text-align: center;
	}
	.more h2 {
		margin: 0;
		font-size: var(--fs-2xl);
	}
	.more p {
		margin: 0;
		color: var(--ui-text-muted);
	}
</style>
