<!-- @component Breadcrumbs — nav + ordered list; the last item is the current page. -->
<script lang="ts">
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	let { items }: { items: { label: string; href?: string }[] } = $props();
</script>

<nav aria-label={m.ui_breadcrumbs()} class="crumbs">
	<ol>
		{#each items as item, i (i)}
			<li>
				{#if item.href && i < items.length - 1}
					<a href={item.href}>{item.label}</a>
					<Icon name="chevron-right" size={12} />
				{:else}
					<span aria-current="page">{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	ol {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	a {
		text-decoration: none;
		padding-block: var(--space-2);
	}
	a:hover {
		text-decoration: underline;
	}
	[aria-current='page'] {
		color: var(--ui-text);
	}
</style>
