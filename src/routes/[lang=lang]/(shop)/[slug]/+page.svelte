<script lang="ts">
	import type { Snapshot } from './$types';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import ProductListing from '#lib/components/storefront/ProductListing.svelte';
	import BlockRenderer from '#lib/components/blocks/BlockRenderer.svelte';
	import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
	import { hasFilters } from '#lib/components/storefront/listing.ts';
	import { PUBLIC_SITE_URL } from '$app/env/public';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
	let listingRef: ReturnType<typeof ProductListing> | undefined = $state();

	export const snapshot: Snapshot<ReturnType<ReturnType<typeof ProductListing>['capture']> | undefined> = {
		capture: () => listingRef?.capture(),
		restore: (s) => listingRef?.restore(s)
	};

	const lang = $derived(data.lang);
	const site = PUBLIC_SITE_URL.replace(/\/$/, '');
</script>

{#if data.kind === 'category'}
	{@const c = data.category}
	{@const self = data.alternates[lang]}
	<Seo
		title={data.listing.page > 1 ? `${c.seoTitle} — ${m.listing_page_n({ n: data.listing.page })}` : c.seoTitle}
		description={c.seoDescription || m.category_seo_description({ name: c.name })}
		canonical={data.listing.page > 1 ? `${self}?page=${data.listing.page}` : self}
		noindex={hasFilters(data.listing.filters)}
		jsonLd={[
			{
				'@context': 'https://schema.org',
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: m.breadcrumb_home(), item: `${site}/${lang}` },
					{ '@type': 'ListItem', position: 2, name: c.name }
				]
			}
		]}
	/>
	<ProductListing
		bind:this={listingRef}
		listing={data.listing}
		{lang}
		title={c.name}
		eyebrow={m.listing_eyebrow()}
		introHtml={c.introHtml}
		crumbs={[{ label: m.breadcrumb_home(), href: `/${lang}` }, { label: c.name }]}
	/>
{:else}
	{@const p = data.page}
	{@const heroFirst = data.blocks[0]?.type === 'hero'}
	<Seo title={p.seoTitle} description={p.seoDescription || undefined} />
	{#if !heroFirst}
		<header class="page-head container-lux">
			<Breadcrumbs items={[{ label: m.breadcrumb_home(), href: `/${lang}` }, { label: p.title }]} />
			<h1>{p.title}</h1>
		</header>
	{/if}
	<BlockRenderer blocks={data.blocks} {lang} firstHeadingLevel={heroFirst ? 1 : 2} />
{/if}

<style>
	.page-head {
		padding-top: var(--space-6);
		max-width: calc(var(--container-text) + 2 * var(--gutter));
	}
	h1 {
		margin: var(--space-8) 0 0;
		font-size: var(--fs-4xl);
		color: var(--ui-text-strong);
	}
</style>
