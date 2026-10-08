<script lang="ts">
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { formatDate } from '#lib/utils/format.ts';

	let { data } = $props();
</script>

<svelte:head><title>Collecties — Beheer</title></svelte:head>

<PageHeader title="Collecties" description="Handmatige collecties (zelf gekozen volgorde) of regels die automatisch producten selecteren.">
	{#snippet actions()}
		{#if data.canWrite}<Button href="/admin/collections/nieuw" size="sm" icon="plus">Nieuwe collectie</Button>{/if}
	{/snippet}
</PageHeader>

{#if data.collections.length}
	<ul class="list">
		{#each data.collections as c (c.id)}
			<li>
				<a href="/admin/collections/{c.id}">
					<span class="main">
						<strong>{c.name}</strong>
						<small>/nl/collectie/{c.slug}</small>
					</span>
					<span class="meta">
						<Badge tone={c.type === 'rule' ? 'info' : 'neutral'}>{c.type === 'rule' ? 'Regel' : 'Handmatig'}</Badge>
						{#if !c.active}<Badge tone="warning">Verborgen</Badge>{/if}
						<span class="summary">{c.summary}</span>
					</span>
					<span class="date">{formatDate(c.updatedAt)}</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<EmptyState title="Nog geen collecties" text="Maak bijvoorbeeld een collectie “Nieuw” met de regel ‘toegevoegd in de laatste 30 dagen’.">
		{#snippet action()}{#if data.canWrite}<Button href="/admin/collections/nieuw" size="sm" icon="plus">Nieuwe collectie</Button>{/if}{/snippet}
	</EmptyState>
{/if}

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		overflow: hidden;
	}
	li + li {
		border-top: 1px solid var(--ui-border);
	}
	a {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5);
		color: inherit;
		text-decoration: none;
	}
	@media (min-width: 48rem) {
		a {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto;
			align-items: center;
		}
	}
	a:hover {
		background: var(--ui-surface-sunken);
	}
	a:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: -2px;
	}
	.main {
		display: grid;
	}
	.main small,
	.date,
	.summary {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		font-size: var(--fs-sm);
	}
</style>
