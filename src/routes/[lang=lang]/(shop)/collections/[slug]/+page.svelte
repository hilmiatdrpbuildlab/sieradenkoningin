<script lang="ts">
	import type { Snapshot } from './$types';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import ProductListing from '#lib/components/storefront/ProductListing.svelte';
	import { hasFilters } from '#lib/components/storefront/listing.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
	let listingRef: ReturnType<typeof ProductListing> | undefined = $state();

	export const snapshot: Snapshot<ReturnType<ReturnType<typeof ProductListing>['capture']> | undefined> = {
		capture: () => listingRef?.capture(),
		restore: (s) => listingRef?.restore(s)
	};

	const c = $derived(data.collection);
	const self = $derived(data.alternates[data.lang]);
</script>

<Seo
	title={data.listing.page > 1 ? `${c.seoTitle} — ${m.listing_page_n({ n: data.listing.page })}` : c.seoTitle}
	description={c.seoDescription || m.category_seo_description({ name: c.name })}
	canonical={data.listing.page > 1 ? `${self}?page=${data.listing.page}` : self}
	noindex={hasFilters(data.listing.filters)}
/>

<ProductListing
	bind:this={listingRef}
	listing={data.listing}
	lang={data.lang}
	title={c.name}
	eyebrow={m.collection_eyebrow()}
	introHtml={c.introHtml}
	crumbs={[{ label: m.breadcrumb_home(), href: `/${data.lang}` }, { label: c.name }]}
/>
