<!--
  Preview frame (P4-01). Uses the ROOT layout only (`@`), i.e. storefront styles without the admin
  theme. Provides the cart / wishlist / toast contexts that storefront blocks (product cards) expect.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import BlockRenderer from '#lib/components/blocks/BlockRenderer.svelte';
	import Toast from '#lib/components/ui/Toast.svelte';
	import { setCartContext } from '#lib/stores/cart.svelte.ts';
	import { setWishlistContext } from '#lib/stores/wishlist.svelte.ts';
	import { setToastContext } from '#lib/stores/toast.svelte.ts';
	import { formatBrussels } from '#lib/utils/brussels-time.ts';

	let { data, form } = $props();
	const preview = $derived(form && 'preview' in form ? form.preview : null);

	// svelte-ignore state_referenced_locally (contexts are created once per preview document)
	setCartContext(data.emptyCart, preview?.lang ?? 'nl');
	setWishlistContext();
	setToastContext();

	onMount(async () => {
		await tick();
		if (preview?.focus)
			document.querySelector(`[data-block-id="${CSS.escape(preview.focus)}"]`)?.scrollIntoView({ block: 'start' });
	});
</script>

<svelte:head>
	<title>Preview — Sieradenkoningin</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if preview}
	<p class="pv-bar" role="status">
		Preview · {preview.lang.toUpperCase()} · {formatBrussels(preview.at)} · niet opgeslagen{#if preview.hiddenCount}
			· {preview.hiddenCount} blok(ken) verborgen of buiten planning{/if}
	</p>
	{#if preview.errors.length}
		<ul class="pv-errors" role="alert">
			{#each preview.errors as e (e)}<li>{e}</li>{/each}
		</ul>
	{/if}
	<main lang={preview.lang}>
		<BlockRenderer blocks={preview.blocks} lang={preview.lang} />
		{#if !preview.blocks.length}<p class="pv-empty">Geen zichtbare blokken.</p>{/if}
	</main>
{:else}
	<p class="pv-empty">Preview wordt geladen…</p>
{/if}
<Toast />

<style>
	:global(body) {
		background: var(--ui-bg);
	}
	.pv-bar {
		position: sticky;
		top: 0;
		z-index: 50;
		margin: 0;
		padding: var(--space-1) var(--space-3);
		background: var(--ui-text);
		color: var(--ui-bg);
		font-size: var(--fs-2xs);
		letter-spacing: 0.04em;
	}
	.pv-errors {
		margin: 0;
		padding: var(--space-3) var(--space-6);
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
		font-size: var(--fs-sm);
	}
	.pv-empty {
		padding: var(--space-16) var(--space-4);
		text-align: center;
		color: var(--ui-text-muted);
	}
</style>
