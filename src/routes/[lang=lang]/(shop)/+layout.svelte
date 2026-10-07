<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { PUBLIC_SITE_URL } from '$app/env/public';
	import SiteHeader from '#lib/components/storefront/SiteHeader.svelte';
	import SiteFooter from '#lib/components/storefront/SiteFooter.svelte';
	import CartDrawer from '#lib/components/storefront/CartDrawer.svelte';
	import Toast from '#lib/components/ui/Toast.svelte';
	import { setCartContext } from '#lib/stores/cart.svelte.ts';
	import { setWishlistContext } from '#lib/stores/wishlist.svelte.ts';
	import { setToastContext } from '#lib/stores/toast.svelte.ts';
	import { localizeHref, type Lang } from '#lib/i18n/paths.ts';
	import { img } from '#lib/utils/media.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, children } = $props();

	// svelte-ignore state_referenced_locally (the language is fixed per document: switching reloads)
	const cart = setCartContext(data.emptyCart, data.lang);
	const wishlist = setWishlistContext();
	setToastContext();

	onMount(() => {
		// Visitor state is loaded client-side so storefront HTML stays cacheable (§4.6).
		fetch(`/api/cart?lang=${data.lang}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((v) => v && cart.sync(v))
			.catch(() => {});
		wishlist.load();
	});
	afterNavigate(({ type }) => {
		if (type !== 'enter') cart.open = false;
	});

	const isHome = $derived(page.route.id === '/[lang=lang]/(shop)');
	const site = PUBLIC_SITE_URL.replace(/\/$/, '');
	const alternates = $derived(
		(page.data as { alternates?: Record<Lang, string> | null }).alternates ?? {
			nl: localizeHref(page.url.pathname, 'nl'),
			fr: localizeHref(page.url.pathname, 'fr')
		}
	);
	const megaTiles = $derived([
		{ label: m.badge_new(), href: localizeHref('/collections/nieuw', data.lang), image: img('demo/editorial-split.svg') },
		{ label: m.badge_bestseller(), href: localizeHref('/search?sort=bestsellers', data.lang), image: img('demo/editorial-hero.svg') }
	]);
</script>

<svelte:head>
	{#if !(page.data as { noAlternates?: boolean }).noAlternates}
		<link rel="alternate" hreflang="nl-BE" href="{site}{alternates.nl}" />
		<link rel="alternate" hreflang="fr-BE" href="{site}{alternates.fr}" />
		<link rel="alternate" hreflang="x-default" href="{site}{alternates.nl}" />
	{/if}
</svelte:head>

<a class="skip" href="#content">{m.ui_skip_to_content()}</a>

<SiteHeader lang={data.lang} overlay={isHome} announcement={data.announcement} categories={data.categories} menu={data.mainMenu} {megaTiles} />

<main id="content" tabindex="-1">
	{@render children()}
</main>

<SiteFooter lang={data.lang} columns={data.footer} paymentMethods={data.paymentMethods} showNewsletter={!isHome} />
<CartDrawer paymentMethods={data.paymentMethods} />
<Toast />

<style>
	.skip {
		position: absolute;
		left: var(--space-4);
		top: -4rem;
		z-index: calc(var(--z-toast) + 1);
		padding: var(--space-3) var(--space-4);
		background: var(--ui-action);
		color: var(--ui-action-text);
		text-decoration: none;
	}
	.skip:focus {
		top: var(--space-4);
	}
	main:focus {
		outline: none;
	}
</style>
