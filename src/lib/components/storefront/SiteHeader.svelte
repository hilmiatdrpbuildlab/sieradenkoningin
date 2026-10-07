<!--
  @component SiteHeader — announcement bar + sticky 3-zone header (DESIGN_SYSTEM §2.1).
  Layout:  [menu | collections mega menu + nav]   [ crown + SIERADENKONINGIN ]   [lang · search · account · wishlist · bag]
  • `overlay` = transparent over the home hero, turns into cream glass after 40px of scrolling.
  • < lg: hamburger opens a native <dialog> drawer with category icons and the language switch.
  • Search is a real link (works without JS); with JS, `onsearch` opens the SearchOverlay instead.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import Drawer from '#lib/components/ui/Drawer.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import MegaMenu from './MegaMenu.svelte';
	import LanguageSwitch from './LanguageSwitch.svelte';
	import { getCart } from '#lib/stores/cart.svelte.ts';
	import { getWishlist } from '#lib/stores/wishlist.svelte.ts';
	import { page } from '$app/state';
	import { localizeHref, type Lang } from '#lib/i18n/paths.ts';
	import type { CategoryNav, NavLink } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		lang: Lang;
		overlay?: boolean;
		announcement?: { text: string; href: string | null } | null;
		categories: CategoryNav[];
		menu: NavLink[];
		megaTiles?: { label: string; href: string; image: string }[];
		onsearch?: () => void;
	}

	let { lang, overlay = false, announcement, categories, menu, megaTiles = [], onsearch }: Props = $props();

	const cart = getCart();
	const wishlist = getWishlist();
	let scrollY = $state(0);
	let menuOpen = $state(false);
	const solid = $derived(!overlay || scrollY > 40);
	const L = (p: string) => localizeHref(p, lang);
	const categoryHrefs = $derived(new Set(categories.map((c) => c.href)));
	const extraLinks = $derived(menu.filter((l) => !categoryHrefs.has(l.href)).slice(0, 2));

	// Close the mobile menu on navigation
	$effect(() => {
		void page.url.pathname;
		menuOpen = false;
	});

	function search(e: MouseEvent) {
		if (!onsearch) return;
		e.preventDefault();
		menuOpen = false;
		onsearch();
	}
</script>

<svelte:window bind:scrollY />

<header class="header" class:solid class:overlay class:transparent={overlay && !solid}>
	{#if announcement}
		<div class="announce" data-surface="inverse" role="region" aria-label={m.announcement_label()}>
			<Icon name="sparkle" size={12} class="orn" />
			{#if announcement.href}<a href={announcement.href}>{announcement.text}</a>{:else}<p>{announcement.text}</p>{/if}
			<Icon name="sparkle" size={12} class="orn" />
		</div>
	{/if}
	<div class="bar container-lux">
		<div class="zone zone--left">
			<button class="icon-btn menu-btn" aria-label={m.ui_open_menu()} aria-expanded={menuOpen} onclick={() => (menuOpen = true)}>
				<Icon name="menu" size={22} />
			</button>
			<nav aria-label={m.nav_main()} class="desktop-nav">
				<MegaMenu label={m.nav_collections()} {categories} tiles={megaTiles} />
				{#each extraLinks as item (item.href)}
					<a href={item.href} aria-current={page.url.pathname.startsWith(item.href) ? 'page' : undefined}>{item.label}</a>
				{/each}
			</nav>
		</div>

		<a href="/{lang}" class="wordmark" aria-label={m.brand_home()}>
			<Icon name="crown" size={22} class="crown" />
			<span class="name">{m.brand_name()}</span>
			<span class="sub">{m.brand_sub()}</span>
		</a>

		<div class="zone zone--right">
			<span class="hide-md"><LanguageSwitch {lang} /></span>
			<a href={L('/search')} class="icon-btn" aria-label={m.nav_search()} onclick={search}><Icon name="search" /></a>
			<a href={L('/account')} class="icon-btn hide-sm" aria-label={m.nav_account()}><Icon name="user" /></a>
			<a href={L('/wishlist')} class="icon-btn hide-sm" aria-label={m.nav_wishlist()}>
				<Icon name="heart" />
				{#if wishlist.ids.size > 0}<span class="dot" aria-hidden="true"></span>{/if}
			</a>
			<a
				href={L('/cart')}
				class="icon-btn bag"
				aria-label={m.nav_cart({ count: cart.count })}
				onclick={(e) => {
					e.preventDefault();
					cart.open = true;
				}}
			>
				<Icon name="bag" />
				{#if cart.count > 0}<span class="count" aria-hidden="true">{cart.count}</span>{/if}
			</a>
		</div>
	</div>
</header>

<Drawer bind:open={menuOpen} side="left" title={m.nav_menu()}>
	<nav aria-label={m.nav_categories()}>
		<ul class="mm-list">
			{#each categories as item (item.key)}
				<li>
					<a href={item.href}>
						<Icon name={item.icon as IconName} size={30} stroke={1} class="mm-ico" />
						<span>{item.label}</span>
						<Icon name="chevron-right" size={16} />
					</a>
				</li>
			{/each}
		</ul>
		<ul class="mm-links">
			{#each extraLinks as item (item.href)}<li><a href={item.href}>{item.label}</a></li>{/each}
			<li><a href={L('/account')}><Icon name="user" size={18} /> {m.nav_account()}</a></li>
			<li><a href={L('/wishlist')}><Icon name="heart" size={18} /> {m.nav_wishlist()}</a></li>
			<li><a href={L('/search')} onclick={search}><Icon name="search" size={18} /> {m.nav_search()}</a></li>
		</ul>
	</nav>
	<div class="mm-foot">
		<LanguageSwitch {lang} variant="full" />
		<p class="script" aria-hidden="true">{m.menu_signoff()}</p>
	</div>
</Drawer>

<style>
	.announce {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		min-height: var(--announce-h);
		padding-inline: var(--gutter);
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-align: center;
	}
	.announce p {
		margin: 0;
	}
	.announce a {
		text-decoration: underline;
		text-underline-offset: 0.3em;
	}
	.announce :global(.orn) {
		color: var(--ui-ornament);
	}
	.header {
		position: sticky;
		top: 0;
		z-index: var(--z-header);
		transition:
			background-color var(--dur-base) var(--motion-out),
			color var(--dur-base),
			border-color var(--dur-base);
		border-bottom: 1px solid transparent;
		background: var(--ui-bg);
	}
	/* overlay: always fixed (no layout jump); transparent until scrolled */
	.header.overlay {
		position: fixed;
		inset-inline: 0;
		top: 0;
	}
	.header.transparent {
		color: var(--ui-text-inverse);
		background: linear-gradient(to bottom, var(--ui-scrim-soft), transparent);
	}
	.header.solid {
		background: var(--ui-glass);
		backdrop-filter: blur(12px);
		color: var(--ui-text);
		border-bottom-color: var(--ui-border);
	}
	.bar {
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		height: var(--header-h);
	}
	.zone {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.zone--right {
		justify-content: flex-end;
	}
	.desktop-nav {
		display: none;
		align-items: center;
		gap: var(--space-8);
	}
	@media (min-width: 64rem) {
		.desktop-nav {
			display: flex;
		}
	}
	.desktop-nav > a {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-decoration: none;
		padding-block: var(--space-2);
		background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat;
		transition: background-size var(--dur-slow) var(--motion-out);
	}
	.desktop-nav > a:hover,
	.desktop-nav > a[aria-current='page'] {
		background-size: 100% 1px;
	}

	.wordmark {
		display: grid;
		justify-items: center;
		text-decoration: none;
		line-height: 1;
		gap: 2px;
	}
	.wordmark :global(.crown) {
		color: var(--ui-ornament);
	}
	.name {
		font-family: var(--ff-display);
		font-size: clamp(1rem, 0.8rem + 1vw, 1.5rem);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.sub {
		font-size: 0.5625rem;
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		opacity: 0.8;
	}
	@media (max-width: 23.4375rem) {
		.sub {
			display: none;
		}
	}

	.icon-btn {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.75rem; /* 44px touch target */
		height: 2.75rem;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
	}
	/* Visibility via scoped media queries — NOT Tailwind `lg:hidden` (§2.3). */
	@media (min-width: 64rem) {
		.menu-btn {
			display: none;
		}
	}
	@media (max-width: 39.99rem) {
		.hide-sm {
			display: none;
		}
	}
	@media (max-width: 47.99rem) {
		.hide-md {
			display: none;
		}
	}
	.count {
		position: absolute;
		top: 6px;
		right: 4px;
		min-width: 1rem;
		height: 1rem;
		padding-inline: 3px;
		border-radius: var(--r-full);
		background: var(--ui-action);
		color: var(--ui-action-text);
		font-size: 0.625rem;
		display: grid;
		place-items: center;
	}
	.transparent .count {
		background: var(--ui-text-inverse);
		color: var(--ui-text-strong);
	}
	.dot {
		position: absolute;
		top: 10px;
		right: 9px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ui-sale);
	}

	.mm-list,
	.mm-links {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.mm-list a {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-4);
		padding-block: var(--space-4);
		border-bottom: 1px solid var(--ui-border);
		font-family: var(--ff-display);
		font-size: var(--fs-xl);
		text-decoration: none;
	}
	.mm-list :global(.mm-ico) {
		color: var(--ui-accent);
	}
	.mm-links {
		margin-top: var(--space-6);
		display: grid;
		gap: var(--space-1);
	}
	.mm-links a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 2.75rem;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-decoration: none;
	}
	.mm-foot {
		margin-top: var(--space-10);
		display: grid;
		justify-items: center;
		gap: var(--space-6);
	}
	.mm-foot .script {
		margin: 0;
	}
</style>
