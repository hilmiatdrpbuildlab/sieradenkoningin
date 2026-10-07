<!-- Fallback error page outside the shop/admin layouts (e.g. unknown language prefix). -->
<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { langFromPath } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	const lang = $derived(langFromPath(page.url.pathname));
	const isAdmin = $derived(page.url.pathname.startsWith('/admin'));
	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{page.status} — Sieradenkoningin</title><meta name="robots" content="noindex" /></svelte:head>

<main class="err" data-surface="inverse" data-theme={isAdmin ? 'admin' : undefined}>
	<Icon name="crown" size={44} stroke={1} class="orn" />
	<p class="eyebrow">{m.error_code({ status: page.status })}</p>
	{#if isAdmin}
		<h1>{page.status === 403 ? 'Geen toegang' : notFound ? 'Pagina niet gevonden' : 'Er ging iets mis'}</h1>
		<p>{page.error?.message}</p>
		<a href="/admin">Terug naar het beheer</a>
	{:else}
		<h1>{notFound ? m.error_404_title() : m.error_500_title()}</h1>
		<p>{notFound ? m.error_404_text() : m.error_500_text()}</p>
		<a href="/{lang}">{m.error_back_home()}</a>
	{/if}
</main>

<style>
	.err {
		min-height: 100dvh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: var(--space-4);
		padding: var(--space-8) var(--gutter);
		text-align: center;
	}
	.err :global(.orn) {
		color: var(--ui-ornament);
	}
	h1 {
		margin: 0;
	}
	p {
		margin: 0;
		max-width: 32rem;
		color: var(--ui-text-muted);
	}
	a {
		margin-top: var(--space-4);
		color: var(--ui-accent);
	}
</style>
