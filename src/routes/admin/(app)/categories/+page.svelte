<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';

	let { data } = $props();
</script>

<svelte:head><title>Categorieën — Beheer</title></svelte:head>

<PageHeader title="Categorieën" description="De zes vaste categorieën. Pas namen, slugs, teksten, SEO en volgorde aan." />

<div class="card">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable) -->
	<div class="scroller" tabindex="0" role="region" aria-label="Categorieën">
		<table>
			<thead>
				<tr>
					<th>Volgorde</th>
					<th>Categorie</th>
					<th class="hide-md">Slug NL</th>
					<th class="hide-md">Slug FR</th>
					<th class="num">Producten</th>
					<th><span class="sr-only">Acties</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.categories as c, i (c.id)}
					<tr>
						<td class="order">
							{#if data.canWrite}
								<form method="POST" action="?/move" use:enhance={() => async ({ update }) => update({ reset: false })}>
									<input type="hidden" name="id" value={c.id} />
									<button name="dir" value="up" disabled={i === 0} aria-label="{c.name.nl} omhoog"><Icon name="arrow-up" size={14} /></button>
									<button name="dir" value="down" disabled={i === data.categories.length - 1} aria-label="{c.name.nl} omlaag"><Icon name="arrow-down" size={14} /></button>
								</form>
							{:else}{i + 1}{/if}
						</td>
						<td>
							<a class="name" href="/admin/categories/{c.id}">
								<Icon name={c.icon as IconName} size={28} stroke={1} />
								<span><strong>{c.name.nl}</strong><small>{c.name.fr ?? '—'}</small></span>
							</a>
						</td>
						<td class="hide-md"><code>{c.slugs.nl}</code></td>
						<td class="hide-md"><code>{c.slugs.fr}</code></td>
						<td class="num"><a href="/admin/products?category={c.id}">{c.products}</a></td>
						<td class="num"><a class="edit" href="/admin/categories/{c.id}" aria-label="{c.name.nl} bewerken"><Icon name="edit" size={16} /></a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.card {
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		overflow: hidden;
	}
	.scroller {
		position: relative;
		overflow-x: auto;
	}
	.scroller:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: -2px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th,
	td {
		padding: var(--space-2) var(--space-4);
		text-align: left;
		border-bottom: 1px solid var(--ui-border);
		white-space: nowrap;
	}
	th {
		background: var(--ui-surface-sunken);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
	}
	.num {
		text-align: right;
	}
	.order form {
		display: flex;
		gap: 4px;
	}
	.order button,
	.edit {
		width: 2.25rem;
		height: 2.25rem;
		display: inline-grid;
		place-items: center;
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		cursor: pointer;
	}
	.order button:disabled {
		opacity: 0.3;
		cursor: default;
	}
	:is(.order button, .edit, .name):focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.name {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		text-decoration: none;
		color: inherit;
	}
	.name :global(svg) {
		color: var(--ui-accent);
	}
	.name span {
		display: grid;
	}
	.name small {
		color: var(--ui-text-muted);
	}
	code {
		font-size: var(--fs-xs);
	}
	@media (max-width: 47.99rem) {
		.hide-md {
			display: none;
		}
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
