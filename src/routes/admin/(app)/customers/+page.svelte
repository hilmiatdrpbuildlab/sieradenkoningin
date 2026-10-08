<script lang="ts">
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import DataTable from '#lib/components/admin/DataTable.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { formatDate, formatPrice } from '#lib/utils/format.ts';
	import type { Column } from '#lib/types.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number] & { name: string; created: string };
	const rows = $derived(data.rows.map((r) => ({ ...r, name: [r.firstName, r.lastName].filter(Boolean).join(' ') || '—', created: '' })) as Row[]);
	const columns: Column<Row>[] = [
		{ key: 'name', label: 'Klant', sortable: true },
		{ key: 'orders', label: 'Bestellingen', sortable: true, align: 'end' },
		{ key: 'spent', label: 'Besteed', sortable: true, align: 'end' },
		{ key: 'marketingOptIn', label: 'Nieuwsbrief', hideBelow: 'md' },
		{ key: 'locale', label: 'Taal', hideBelow: 'lg' },
		{ key: 'created', label: 'Klant sinds', sortable: true, hideBelow: 'md' }
	];
</script>

<svelte:head><title>Klanten — Beheer</title></svelte:head>

<PageHeader title="Klanten" description="{data.total} klantaccounts. Gastbestellingen verschijnen bij het account zodra de klant zich registreert met hetzelfde e-mailadres." />

<DataTable {rows} {columns} total={data.total} pageSize={data.pageSize} rowHref={(r) => `/admin/customers/${r.id}`}>
	{#snippet toolbar()}
		<form method="GET" class="filters">
			<label class="search"><span class="sr-only">Zoeken</span><input name="q" type="search" placeholder="Zoek op naam, e-mail of telefoon" value={data.q} /></label>
			<label class="check"><input type="checkbox" name="newsletter" value="1" checked={data.newsletter} /> Alleen nieuwsbrief</label>
			<Button type="submit" size="sm" variant="outline">Filteren</Button>
		</form>
	{/snippet}
	{#snippet cell(row, col)}
		{#if col.key === 'name'}<span class="who"><strong>{row.name}</strong><small>{row.email}</small></span>
		{:else if col.key === 'spent'}{formatPrice(row.spent)}
		{:else if col.key === 'marketingOptIn'}{#if row.marketingOptIn}<Badge tone="success">Ja</Badge>{:else}<Badge>Nee</Badge>{/if}
		{:else if col.key === 'locale'}{row.locale.toUpperCase()}
		{:else if col.key === 'created'}{formatDate(row.createdAt)}
		{:else}{String(row[col.key] ?? '')}{/if}
	{/snippet}
	{#snippet empty()}<EmptyState icon="users" title="Geen klanten gevonden" />{/snippet}
</DataTable>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		width: 100%;
	}
	.search {
		flex: 1;
		min-width: 14rem;
	}
	.search input {
		width: 100%;
		height: 2.25rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
	}
	.check {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
		font-size: var(--fs-sm);
	}
	.who {
		display: grid;
	}
	.who small {
		color: var(--ui-text-muted);
		font-weight: var(--fw-regular);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
