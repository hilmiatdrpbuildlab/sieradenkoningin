<!--
  @component AccountNav — account area navigation (P3-02): overview, orders, addresses, wishlist,
  settings and a POST logout. Horizontal scroller on mobile, vertical list from 64rem.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import { delocalizePath, localizeHref, type Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { lang }: { lang: Lang } = $props();

	const items: { path: string; label: () => string; icon: IconName; exact?: boolean }[] = [
		{ path: '/account', label: () => m.acct_nav_overview(), icon: 'user', exact: true },
		{ path: '/account/orders', label: () => m.acct_nav_orders(), icon: 'box' },
		{ path: '/account/addresses', label: () => m.acct_nav_addresses(), icon: 'map-pin' },
		{ path: '/wishlist', label: () => m.acct_nav_wishlist(), icon: 'heart' },
		{ path: '/account/settings', label: () => m.acct_nav_settings(), icon: 'settings' }
	];
	const internal = $derived(delocalizePath(page.url.pathname).replace(/^\/(nl|fr)/, '') || '/');
	const isActive = (path: string, exact?: boolean) => (exact ? internal === path : internal === path || internal.startsWith(path + '/'));
</script>

<nav class="acct-nav" aria-label={m.acct_nav_label()}>
	<ul>
		{#each items as item (item.path)}
			<li>
				<a href={localizeHref(item.path, lang)} aria-current={isActive(item.path, item.exact) ? 'page' : undefined}>
					<Icon name={item.icon} size={18} />
					<span>{item.label()}</span>
				</a>
			</li>
		{/each}
		<li>
			<form method="POST" action={localizeHref('/account/logout', lang)} data-sveltekit-reload>
				<button type="submit"><Icon name="logout" size={18} /><span>{m.acct_logout()}</span></button>
			</form>
		</li>
	</ul>
</nav>

<style>
	ul {
		display: flex;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--ui-border);
	}
	a,
	button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		padding: var(--space-2) var(--space-3);
		font: inherit;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--ui-text);
		text-decoration: none;
		background: none;
		border: 0;
		border-bottom: 2px solid transparent;
		cursor: pointer;
	}
	a:hover,
	button:hover {
		color: var(--ui-accent);
	}
	a[aria-current='page'] {
		border-bottom-color: var(--ui-ornament);
		color: var(--ui-text-strong);
	}
	a :global(svg),
	button :global(svg) {
		color: var(--ui-accent);
		flex: none;
	}
	@media (min-width: 64rem) {
		ul {
			flex-direction: column;
			border-bottom: 0;
			border-left: 1px solid var(--ui-border);
		}
		a,
		button {
			width: 100%;
			border-bottom: 0;
			border-left: 2px solid transparent;
			margin-left: -1px;
			padding-inline: var(--space-4);
		}
		a[aria-current='page'] {
			border-left-color: var(--ui-ornament);
		}
	}
</style>
