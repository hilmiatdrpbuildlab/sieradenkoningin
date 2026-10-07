<script lang="ts">
	import BlockRenderer from '#lib/components/blocks/BlockRenderer.svelte';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
</script>

<Seo title={data.seo.title || m.seo_default_title()} description={data.seo.description || m.seo_default_description()} image={data.preloadImage?.src} />
<svelte:head>
	{#if data.preloadImage}
		<link rel="preload" as="image" href={data.preloadImage.src} imagesrcset={data.preloadImage.srcset} imagesizes="100vw" fetchpriority="high" />
	{/if}
</svelte:head>

<BlockRenderer blocks={data.blocks} lang={data.lang} />
