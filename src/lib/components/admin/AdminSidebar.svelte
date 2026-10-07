<!--
  @component AdminSidebar — burgundy rail, collapsible on desktop, off-canvas on mobile.
  Width: 16rem expanded / 4.5rem collapsed (icons + tooltips). State persisted in a cookie
  so SSR renders the right width (no layout flash).
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import { page } from '$app/state';

	interface Item { label: string; href: string; icon: IconName; badge?: number }
	interface Group { title?: string; items: Item[] }
	interface Props { groups: Group[]; collapsed?: boolean; mobileOpen?: boolean; user: { name: string; role: string } }

	let { groups, collapsed = $bindable(false), mobileOpen = $bindable(false), user }: Props = $props();

	function toggle() {
		collapsed = !collapsed;
		document.cookie = `sk_sidebar=${collapsed ? 1 : 0}; path=/admin; max-age=31536000; samesite=lax`;
	}
	const isActive = (href: string) =>
		href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href);
</script>

{#if mobileOpen}<button class="scrim" aria-label="Menu sluiten" onclick={() => (mobileOpen = false)}></button>{/if}

<aside class="sidebar" class:collapsed class:open={mobileOpen} data-surface="inverse" aria-label="Beheer">
	<div class="brand">
		<Icon name="crown" size={24} class="text-ornament" />
		<span class="label wordmark">Sieradenkoningin<small>Beheer</small></span>
	</div>

	<nav>
		{#each groups as group}
			{#if group.title}<p class="group label">{group.title}</p>{/if}
			<ul>
				{#each group.items as item}
					<li>
						<a href={item.href} aria-current={isActive(item.href) ? 'page' : undefined} title={collapsed ? item.label : undefined}>
							<Icon name={item.icon} size={20} />
							<span class="label">{item.label}</span>
							{#if item.badge}<span class="badge">{item.badge}</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/each}
	</nav>

	<div class="foot">
		<div class="user">
			<span class="avatar" aria-hidden="true">{user.name[0]}</span>
			<span class="label"><strong>{user.name}</strong><small>{user.role}</small></span>
		</div>
		<form method="POST" action="/admin/logout"><button class="logout" aria-label="Uitloggen"><Icon name="logout" size={18} /></button></form>
		<button class="collapse" onclick={toggle} aria-label={collapsed ? 'Zijbalk uitklappen' : 'Zijbalk inklappen'} aria-expanded={!collapsed}>
			<Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
		</button>
	</div>
</aside>

<style>
	.sidebar {
		position: fixed;
		inset-block: 0;
		left: 0;
		z-index: var(--z-drawer);
		width: var(--sidebar-w);
		display: flex;
		flex-direction: column;
		padding: var(--space-4) var(--space-3);
		transition: width var(--dur-base) var(--motion-out), transform var(--dur-base) var(--motion-out);
		transform: translateX(-100%);
		overflow: hidden;
	}
	.sidebar.open { transform: none; box-shadow: var(--elev-xl); }
	@media (min-width: 64rem) {
		.sidebar { position: sticky; top: 0; height: 100dvh; transform: none; }
		.sidebar.collapsed { width: var(--sidebar-w-collapsed); }
		.collapsed .label, .collapsed .badge { opacity: 0; pointer-events: none; width: 0; }
	}
	.scrim { position: fixed; inset: 0; z-index: var(--z-overlay); background: var(--ui-overlay); border: 0; }
	@media (min-width: 64rem) { .scrim { display: none; } }

	.label { white-space: nowrap; transition: opacity var(--dur-fast); }
	.brand { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3) var(--space-6); }
	.wordmark { font-family: var(--ff-serif); font-size: var(--fs-base); text-transform: uppercase; letter-spacing: 0.05em; display: grid; line-height: 1.1; }
	.wordmark small { font-family: var(--ff-body); font-size: 0.625rem; letter-spacing: var(--ls-widest); color: var(--ui-text-muted); }

	nav { flex: 1; overflow-y: auto; overflow-x: hidden; }
	ul { list-style: none; margin: 0 0 var(--space-4); padding: 0; display: grid; gap: 2px; }
	.group { font-size: 0.625rem; letter-spacing: var(--ls-wider); text-transform: uppercase; color: var(--ui-text-muted); margin: var(--space-4) var(--space-3) var(--space-2); }
	nav a {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: 2.5rem;
		padding-inline: var(--space-3);
		border-radius: var(--r-xs);
		color: var(--ui-text-subtle);
		text-decoration: none;
		font-size: var(--fs-sm);
		transition: background-color var(--dur-fast), color var(--dur-fast);
	}
	nav a:hover { background: rgb(235 225 216 / 0.06); color: var(--ui-text); }
	nav a[aria-current='page'] { background: rgb(235 225 216 / 0.1); color: var(--ui-text); }
	nav a[aria-current='page']::before { content: ''; position: absolute; left: 0; inset-block: 25%; width: 2px; background: var(--sk-gold); }
	.badge { margin-left: auto; min-width: 1.25rem; padding: 0 6px; border-radius: var(--r-full); background: var(--sk-gold); color: var(--sk-burgundy); font-size: 0.6875rem; font-weight: var(--fw-semibold); text-align: center; }

	.foot { display: flex; align-items: center; gap: var(--space-2); padding-top: var(--space-4); border-top: 1px solid var(--ui-border); }
	.user { display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0; padding-left: var(--space-1); }
	.user .label { display: grid; font-size: var(--fs-xs); line-height: 1.3; }
	.user small { color: var(--ui-text-muted); }
	.avatar { flex-shrink: 0; width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center; background: var(--sk-gold); color: var(--sk-burgundy); font-weight: var(--fw-semibold); font-size: var(--fs-xs); }
	.logout, .collapse { width: 2rem; height: 2rem; display: grid; place-items: center; background: none; border: 0; color: var(--ui-text-muted); cursor: pointer; border-radius: var(--r-xs); }
	.logout:hover, .collapse:hover { color: var(--ui-text); background: rgb(235 225 216 / 0.08); }
	@media (max-width: 63.99rem) { .collapse { display: none; } }
	.collapsed .foot { flex-direction: column; }
</style>
