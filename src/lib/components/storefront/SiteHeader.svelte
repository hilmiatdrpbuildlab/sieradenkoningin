<!--
  @component SiteHeader — announcement bar + sticky 3-zone header.
  Layout:  [nav | menu]   [ crown + SIERADENKONINGIN ]   [search · account · bag]
  • `overlay` = transparent over a dark hero, turns solid cream after 40px scroll.
  • < lg: hamburger opens a full-height drawer with category icons.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import { getCart } from '#lib/stores/cart.svelte.ts';
	import { fly, fade } from 'svelte/transition';
	import { page } from '$app/state';

	interface NavItem { label: string; href: string; icon: IconName }
	interface Props { overlay?: boolean; announcement?: string; nav: NavItem[] }

	let { overlay = false, announcement, nav }: Props = $props();

	const cart = getCart();
	let scrollY = $state(0);
	let menuOpen = $state(false);
	const solid = $derived(!overlay || scrollY > 40 || menuOpen);

	// Close mobile menu on navigation
	$effect(() => {
		page.url.pathname;
		menuOpen = false;
	});
</script>

<svelte:window bind:scrollY />

<header class="header" class:solid class:overlay class:transparent={overlay && !solid}>
	{#if announcement}
		<div class="announce" data-surface="inverse">
			<Icon name="sparkle" size={12} class="text-ornament" />
			<p>{announcement}</p>
			<Icon name="sparkle" size={12} class="text-ornament" />
		</div>
	{/if}
	<div class="bar container-lux">
		<div class="zone zone--left">
			<button class="icon-btn menu-btn" aria-label="Menu openen" aria-expanded={menuOpen} onclick={() => (menuOpen = true)}>
				<Icon name="menu" size={22} />
			</button>
			<nav aria-label="Hoofdnavigatie" class="desktop-nav">
				{#each nav.slice(0, 4) as item}
					<a href={item.href} aria-current={page.url.pathname.startsWith(item.href) ? 'page' : undefined}>{item.label}</a>
				{/each}
			</nav>
		</div>

		<a href="/" class="wordmark" aria-label="Sieradenkoningin — home">
			<Icon name="crown" size={22} class="crown" />
			<span class="name">Sieradenkoningin</span>
			<span class="sub">Jewelry</span>
		</a>

		<div class="zone zone--right">
			<a href="/zoeken" class="icon-btn" aria-label="Zoeken"><Icon name="search" /></a>
			<a href="/account" class="icon-btn hide-sm" aria-label="Mijn account"><Icon name="user" /></a>
			<a href="/favorieten" class="icon-btn hide-sm" aria-label="Favorieten"><Icon name="heart" /></a>
			<button class="icon-btn bag" aria-label="Winkelmand, {cart.count} artikelen" onclick={() => (cart.open = true)}>
				<Icon name="bag" />
				{#if cart.count > 0}<span class="count" aria-hidden="true">{cart.count}</span>{/if}
			</button>
		</div>
	</div>
</header>

{#if menuOpen}
	<div class="scrim" transition:fade={{ duration: 250 }} onclick={() => (menuOpen = false)} aria-hidden="true"></div>
	<div class="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" transition:fly={{ x: -400, duration: 400 }}>
		<div class="mm-head">
			<Icon name="crown" size={24} class="text-ornament" />
			<button class="icon-btn" aria-label="Menu sluiten" onclick={() => (menuOpen = false)}><Icon name="close" /></button>
		</div>
		<nav aria-label="Categorieën">
			<ul class="mm-list">
				{#each nav as item}
					<li>
						<a href={item.href}>
							<Icon name={item.icon} size={26} stroke={1} class="text-accent" />
							<span>{item.label}</span>
							<Icon name="chevron-right" size={16} />
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<p class="mm-foot script">You</p>
	</div>
{/if}

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
	.announce p { margin: 0; }
	.header {
		position: sticky;
		top: 0;
		z-index: var(--z-header);
		transition: background-color var(--dur-base) var(--motion-out), color var(--dur-base), border-color var(--dur-base);
		border-bottom: 1px solid transparent;
	}
	/* overlay: always fixed (no layout jump); transparent until scrolled */
	.header.overlay { position: fixed; inset-inline: 0; top: 0; }
	.header.transparent {
		color: var(--sk-cream);
		background: linear-gradient(to bottom, rgb(36 13 14 / 0.45), transparent);
	}
	.header.solid {
		background: color-mix(in srgb, var(--sk-cream) 92%, transparent);
		backdrop-filter: blur(12px);
		color: var(--ui-text);
		border-bottom-color: var(--ui-border);
	}
	.bar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		height: var(--header-h);
	}
	.zone { display: flex; align-items: center; gap: var(--space-1); }
	.zone--right { justify-content: flex-end; }

	.desktop-nav { display: none; gap: var(--space-8); }
	@media (min-width: 64rem) { .desktop-nav { display: flex; } }
	.desktop-nav a {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-decoration: none;
		padding-block: var(--space-2);
		background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat;
		transition: background-size var(--dur-slow) var(--motion-out);
	}
	.desktop-nav a:hover, .desktop-nav a[aria-current='page'] { background-size: 100% 1px; }

	.wordmark { display: grid; justify-items: center; text-decoration: none; line-height: 1; gap: 2px; }
	.wordmark :global(.crown) { color: var(--sk-gold); }
	.name { font-family: var(--ff-display); font-size: clamp(1rem, 0.8rem + 1vw, 1.5rem); letter-spacing: 0.06em; text-transform: uppercase; }
	.sub { font-size: 0.5625rem; letter-spacing: var(--ls-widest); text-transform: uppercase; opacity: 0.8; }
	@media (max-width: 23.4375rem) { .sub { display: none; } }

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
	/* Visibility via scoped media queries — NOT Tailwind `lg:hidden`: unlayered component
	   CSS (display:grid above) would beat Tailwind's layered utilities. */
	@media (min-width: 64rem) { .menu-btn { display: none; } }
	@media (max-width: 39.99rem) { .hide-sm { display: none; } }
	.count {
		position: absolute;
		top: 6px;
		right: 4px;
		min-width: 1rem;
		height: 1rem;
		padding-inline: 3px;
		border-radius: var(--r-full);
		background: var(--sk-burgundy);
		color: var(--sk-cream);
		font-size: 0.625rem;
		display: grid;
		place-items: center;
	}
	.transparent .count { background: var(--sk-cream); color: var(--sk-burgundy); }

	.scrim { position: fixed; inset: 0; background: var(--ui-overlay); z-index: var(--z-overlay); }
	.mobile-menu {
		position: fixed;
		inset-block: 0;
		left: 0;
		width: min(24rem, 88vw);
		z-index: var(--z-drawer);
		background: var(--ui-bg);
		box-shadow: var(--elev-xl);
		display: flex;
		flex-direction: column;
		padding: var(--space-4) var(--gutter) var(--space-8);
		overflow-y: auto;
	}
	.mm-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
	.mm-list { list-style: none; padding: 0; margin: 0; }
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
	.mm-foot { margin-top: auto; text-align: center; padding-top: var(--space-10); }
</style>
