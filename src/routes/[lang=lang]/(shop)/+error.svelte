<!-- Branded 404 / 500 for the storefront (P0-10), NL/FR, rendered inside the shop layout. -->
<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/ui/Icon.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { localizeHref, langFromPath } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	const lang = $derived(langFromPath(page.url.pathname));
	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? m.error_404_title() : m.error_500_title()} — Sieradenkoningin</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="err container-lux">
	<Icon name="crown" size={44} stroke={1} class="orn" />
	<p class="eyebrow">{m.error_code({ status: page.status })}</p>
	<h1>{notFound ? m.error_404_title() : m.error_500_title()}</h1>
	<p class="text">{notFound ? m.error_404_text() : m.error_500_text()}</p>
	<div class="ctas">
		<Button href="/{lang}">{m.error_back_home()}</Button>
		{#if notFound}<Button href={localizeHref('/search', lang)} variant="outline" icon="search">{m.nav_search()}</Button>{/if}
	</div>
</section>

<style>
	.err {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		padding-block: var(--section-y);
		text-align: center;
	}
	.err :global(.orn) {
		color: var(--ui-ornament);
	}
	h1 {
		margin: 0;
		max-width: 36rem;
	}
	.text {
		margin: 0;
		max-width: 32rem;
		color: var(--ui-text-muted);
	}
	.ctas {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
</style>
