<script lang="ts">
	import { page } from '$app/state';
	let { children } = $props();
	const tabs = [
		{ href: '/admin/settings/store', label: 'Winkel' },
		{ href: '/admin/settings/shipping', label: 'Verzending' },
		{ href: '/admin/settings/payments', label: 'Betalingen' },
		{ href: '/admin/settings/emails', label: 'E-mails' },
		{ href: '/admin/settings/legal', label: 'Juridisch' },
		{ href: '/admin/settings/redirects', label: 'Redirects' }
	];
</script>

<nav class="tabs" aria-label="Instellingen">
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
