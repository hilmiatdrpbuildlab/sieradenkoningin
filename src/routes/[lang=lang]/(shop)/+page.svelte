<script lang="ts">
	import BlockRenderer from '#lib/components/blocks/BlockRenderer.svelte';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { PUBLIC_SITE_URL } from '$app/env/public';
	import { localizeHref } from '#lib/i18n/paths.ts';

	let { data } = $props();

	// Organization + WebSite SearchAction (P4-04).
	const site = PUBLIC_SITE_URL.replace(/\/$/, '');
	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			'@id': `${site}/#organization`,
			name: 'Sieradenkoningin',
			url: `${site}/${data.lang}`,
			logo: `${site}/favicon.svg`
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			'@id': `${site}/${data.lang}#website`,
			name: 'Sieradenkoningin',
			url: `${site}/${data.lang}`,
			inLanguage: data.lang === 'fr' ? 'fr-BE' : 'nl-BE',
			publisher: { '@id': `${site}/#organization` },
			potentialAction: {
				'@type': 'SearchAction',
				target: {
					'@type': 'EntryPoint',
					urlTemplate: `${site}${localizeHref('/search', data.lang)}?q={search_term_string}`
				},
				'query-input': 'required name=search_term_string'
			}
		}
	]);
</script>

<Seo
	title={data.seo.title || m.seo_default_title()}
	description={data.seo.description || m.seo_default_description()}
	image={data.preloadImage?.src}
	{jsonLd}
/>
<svelte:head>
	{#if data.preloadImage}
		<link
			rel="preload"
			as="image"
			href={data.preloadImage.src}
			imagesrcset={data.preloadImage.srcset}
			imagesizes="100vw"
			fetchpriority="high"
		/>
	{/if}
</svelte:head>

<BlockRenderer blocks={data.blocks} lang={data.lang} />
