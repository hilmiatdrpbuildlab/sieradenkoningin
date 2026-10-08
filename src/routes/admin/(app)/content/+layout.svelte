<script lang="ts">
	import { page } from '$app/state';
	let { children } = $props();
	// Content sub-navigation (P4-01/P4-02). Legal texts and redirects live under Instellingen (owner only).
	const tabs = [
		{ href: '/admin/content/pages', label: "Pagina's" },
		{ href: '/admin/content/menus', label: "Menu's" },
		{ href: '/admin/content/announcement', label: 'Aankondiging' },
		{ href: '/admin/content/faq', label: 'FAQ' }
	];
</script>

<nav class="tabs" aria-label="Content">
	{#each tabs as t (t.href)}
		<a href={t.href} aria-current={page.url.pathname.startsWith(t.href) ? 'page' : undefined}>{t.label}</a>
	{/each}
</nav>
{@render children()}

<style>
	.tabs {
		display: flex;
		gap: var(--space-1);
		margin-bottom: var(--space-6);
		border-bottom: 1px solid var(--ui-border);
		overflow-x: auto;
	}
	a {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 var(--space-4);
		color: var(--ui-text-muted);
		text-decoration: none;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		white-space: nowrap;
	}
	a[aria-current='page'] {
		color: var(--ui-text);
	}
	a[aria-current='page']::after {
		content: '';
		position: absolute;
		inset-inline: var(--space-2);
		bottom: -1px;
		height: 2px;
		background: var(--ui-action);
	}
</style>
