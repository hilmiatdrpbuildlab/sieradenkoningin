<!--
  @component Seo — <title>, description, canonical, Open Graph + Twitter tags and optional JSON-LD
  (P4-04). The canonical never carries filter/sort params; hreflang pairs are emitted by the layout.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_SITE_URL } from '$app/env/public';

	interface Props {
		title: string;
		description?: string;
		image?: string | null;
		canonical?: string | null;
		type?: 'website' | 'product' | 'article';
		noindex?: boolean;
		jsonLd?: unknown[];
	}
	let { title, description, image, canonical, type = 'website', noindex = false, jsonLd = [] }: Props = $props();

	const site = PUBLIC_SITE_URL.replace(/\/$/, '');
	const abs = (u: string) => (/^https?:/.test(u) ? u : `${site}${u}`);
	const canonicalUrl = $derived(abs(canonical ?? page.url.pathname));
	const fullTitle = $derived(title.includes('Sieradenkoningin') ? title : `${title} — Sieradenkoningin`);
	// JSON-LD is serialised with "<" escaped so content can never close the script element.
	const ld = $derived(jsonLd.map((j) => JSON.stringify(j).replace(/</g, '\\u003c')));
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if description}<meta name="description" content={description} />{/if}
	<link rel="canonical" href={canonicalUrl} />
	{#if noindex}<meta name="robots" content="noindex, follow" />{/if}
	<meta property="og:site_name" content="Sieradenkoningin" />
	<meta property="og:type" content={type === 'product' ? 'product' : type} />
	<meta property="og:title" content={fullTitle} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:locale" content={page.url.pathname.startsWith('/fr') ? 'fr_BE' : 'nl_BE'} />
	{#if image}<meta property="og:image" content={abs(image)} /><meta name="twitter:image" content={abs(image)} />{/if}
	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
	{#each ld as json, i (i)}
		{@html `<script type="application/ld+json">${json}</` + 'script>'}
	{/each}
</svelte:head>
