<!--
  @component BlockRenderer — renders resolved CMS blocks (see server/services/blocks.ts). The same
  component powers the storefront and the admin live preview.
-->
<script lang="ts">
	import Hero from '#lib/components/storefront/Hero.svelte';
	import UspBar from '#lib/components/storefront/UspBar.svelte';
	import CategoryStrip from '#lib/components/storefront/CategoryStrip.svelte';
	import ProductRail from '#lib/components/storefront/ProductRail.svelte';
	import QuoteBand from '#lib/components/storefront/QuoteBand.svelte';
	import EditorialSplit from '#lib/components/storefront/EditorialSplit.svelte';
	import Banner from '#lib/components/storefront/Banner.svelte';
	import RichText from './RichText.svelte';
	import FaqList from './FaqList.svelte';
	import SizeTable from './SizeTable.svelte';
	import LegalSlot from './LegalSlot.svelte';
	import NewsletterBlock from './NewsletterBlock.svelte';
	import ContactForm from './ContactForm.svelte';
	import type { Lang } from '#lib/i18n/paths.ts';

	interface Resolved {
		id: string;
		type: string;
		view: Record<string, any>;
	}
	let { blocks, lang, firstHeadingLevel = 1 }: { blocks: Resolved[]; lang: Lang; firstHeadingLevel?: 1 | 2 } = $props();
</script>

{#each blocks as b, i (b.id)}
	{@const v = b.view}
	<div class="block block--{b.type}" data-block-id={b.id}>
		{#if b.type === 'hero'}
			<Hero variant={v.variant} overline={v.overline} title={v.title} script={v.script} lead={v.lead} image={v.image} cta={v.cta} secondaryCta={v.secondaryCta} headingLevel={i === 0 ? firstHeadingLevel : 2} />
		{:else if b.type === 'usp_bar'}
			<UspBar items={v.items} />
		{:else if b.type === 'category_strip'}
			<CategoryStrip title={v.title} eyebrow={v.eyebrow} categories={v.categories} />
		{:else if b.type === 'product_rail'}
			<ProductRail eyebrow={v.eyebrow} title={v.title} products={v.products} cta={v.cta} />
		{:else if b.type === 'quote_band'}
			<QuoteBand quote={v.quote} attribution={v.attribution} surface={v.surface} />
		{:else if b.type === 'editorial_split'}
			<EditorialSplit eyebrow={v.eyebrow} title={v.title} script={v.script} body={v.body} image={v.image} cta={v.cta} reverse={v.reverse} />
		{:else if b.type === 'banner'}
			<Banner image={v.image} eyebrow={v.eyebrow} title={v.title} text={v.text} cta={v.cta} surface={v.surface} />
		{:else if b.type === 'rich_text'}
			<RichText title={v.title} body={v.body} />
		{:else if b.type === 'faq_list'}
			<FaqList title={v.title} items={v.items} />
		{:else if b.type === 'size_table'}
			<SizeTable title={v.title} kind={v.kind} />
		{:else if b.type === 'legal_slot'}
			<LegalSlot slot={v.slot} body={v.body} store={v.store} returnDays={v.returnDays} {lang} />
		{:else if b.type === 'newsletter'}
			<NewsletterBlock title={v.title} text={v.text} {lang} />
		{:else if b.type === 'contact_form'}
			<ContactForm title={v.title} {lang} />
		{/if}
	</div>
{/each}
