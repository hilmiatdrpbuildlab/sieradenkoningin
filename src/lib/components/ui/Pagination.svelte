<!--
  @component Pagination — real <a href="?page=n"> links (SEO + no-JS), current page marked aria-current.
-->
<script lang="ts">
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { page, pages, href }: { page: number; pages: number; href: (n: number) => string } = $props();

	const items = $derived.by(() => {
		const out: (number | '…')[] = [];
		for (let n = 1; n <= pages; n++) {
			if (n === 1 || n === pages || Math.abs(n - page) <= 1) out.push(n);
			else if (out[out.length - 1] !== '…') out.push('…');
		}
		return out;
	});
</script>

{#if pages > 1}
	<nav class="pager" aria-label={m.ui_pagination()}>
		{#if page > 1}<a class="step" href={href(page - 1)} rel="prev" aria-label={m.ui_previous_page()}><Icon name="chevron-left" size={16} /></a>{/if}
		<ol>
			{#each items as n, i (i)}
				<li>
					{#if n === '…'}<span class="gap" aria-hidden="true">…</span>
					{:else}<a href={href(n)} aria-current={n === page ? 'page' : undefined} aria-label={m.ui_page_n({ n })}>{n}</a>{/if}
				</li>
			{/each}
		</ol>
		{#if page < pages}<a class="step" href={href(page + 1)} rel="next" aria-label={m.ui_next_page()}><Icon name="chevron-right" size={16} /></a>{/if}
	</nav>
{/if}

<style>
	.pager {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--space-2);
	}
	ol {
		display: flex;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a,
	.gap {
		min-width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		font-size: var(--fs-sm);
		text-decoration: none;
	}
	a[aria-current='page'] {
		border-bottom: 1px solid var(--ui-text);
		font-weight: var(--fw-medium);
	}
	a:hover {
		color: var(--ui-accent);
	}
</style>
