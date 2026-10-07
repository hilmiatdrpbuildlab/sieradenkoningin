<!--
  @component AdminTopbar — mobile menu button, breadcrumbs, "Bekijk winkel" link.
  Breadcrumbs come from `page.data.crumbs` ([{label, href?}]) when a page sets them.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/ui/Icon.svelte';

	let { mobileOpen = $bindable(false) }: { mobileOpen?: boolean } = $props();
	const crumbs = $derived(((page.data as { crumbs?: { label: string; href?: string }[] }).crumbs ?? []).filter(Boolean));
</script>

<header class="topbar">
	<button class="menu" aria-label="Menu openen" aria-expanded={mobileOpen} onclick={() => (mobileOpen = true)}><Icon name="menu" size={20} /></button>
	<nav aria-label="Kruimelpad" class="crumbs">
		<ol>
			<li><a href="/admin">Beheer</a></li>
			{#each crumbs as c, i (i)}
				<li>
					<Icon name="chevron-right" size={12} />
					{#if c.href && i < crumbs.length - 1}<a href={c.href}>{c.label}</a>{:else}<span aria-current="page">{c.label}</span>{/if}
				</li>
			{/each}
		</ol>
	</nav>
	<a class="shop" href="/nl" target="_blank" rel="noopener">Bekijk winkel <Icon name="external" size={14} /></a>
</header>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: var(--header-h);
		padding-inline: var(--space-4);
		background: var(--ui-surface);
		border-bottom: 1px solid var(--ui-border);
	}
	@media (min-width: 64rem) {
		.topbar {
			padding-inline: var(--space-8);
		}
		.menu {
			display: none !important;
		}
	}
	.menu {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		margin-left: calc(var(--space-2) * -1);
	}
	.crumbs {
		flex: 1;
		min-width: 0;
	}
	ol {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--fs-sm);
		white-space: nowrap;
		overflow: hidden;
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	li a {
		color: var(--ui-text-muted);
		text-decoration: none;
	}
	li a:hover {
		color: var(--ui-text);
	}
	[aria-current='page'] {
		font-weight: var(--fw-medium);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.shop {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--fs-sm);
		color: var(--ui-accent);
		text-decoration: none;
		white-space: nowrap;
	}
	@media (max-width: 39.99rem) {
		.shop {
			font-size: var(--fs-xs);
		}
	}
</style>
