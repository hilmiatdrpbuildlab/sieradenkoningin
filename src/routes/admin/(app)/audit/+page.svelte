<script lang="ts">
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import DataTable from '#lib/components/admin/DataTable.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatDateTime } from '#lib/utils/format.ts';
	import type { Column } from '#lib/types.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];
	const columns: Column<Row>[] = [
		{ key: 'createdAt', label: 'Tijdstip' },
		{ key: 'actorName', label: 'Gebruiker' },
		{ key: 'action', label: 'Actie' },
		{ key: 'entity', label: 'Object' },
		{ key: 'entityId', label: 'ID', hideBelow: 'lg' },
		{ key: 'diff', label: 'Wijzigingen', hideBelow: 'md' },
		{ key: 'ip', label: 'IP', hideBelow: 'lg' }
	];
</script>

<svelte:head><title>Auditlog — Beheer</title></svelte:head>

<PageHeader title="Auditlog" description="Elke wijziging in het beheer wordt hier vastgelegd (alleen-lezen)." />

<DataTable rows={data.rows} {columns} total={data.total} pageSize={data.pageSize} density="compact">
	{#snippet toolbar()}
		<form method="GET" class="filters">
			<label><span class="sr-only">Zoeken</span><input name="q" placeholder="Zoek gebruiker, actie of ID" value={data.filters.q} /></label>
			<label><span class="sr-only">Object</span>
				<select name="entity" value={data.filters.entity}>
					<option value="">Alle objecten</option>
					{#each data.entities as e (e)}<option value={e}>{e}</option>{/each}
				</select>
			</label>
			<label>Van <input type="date" name="from" value={data.filters.from} /></label>
			<label>Tot <input type="date" name="to" value={data.filters.to} /></label>
			<Button type="submit" size="sm" variant="outline">Filteren</Button>
		</form>
	{/snippet}
	{#snippet cell(row, col)}
		{#if col.key === 'createdAt'}{formatDateTime(row.createdAt)}
		{:else if col.key === 'diff'}<code class="diff" title={row.diff}>{row.diff}</code>
		{:else if col.key === 'actorName'}{row.actorName ?? 'Systeem'}
		{:else}{String(row[col.key] ?? '—')}{/if}
	{/snippet}
</DataTable>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		font-size: var(--fs-sm);
	}
	input,
	select {
		height: 2.25rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
	}
	.diff {
		display: inline-block;
		max-width: 22rem;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: var(--fs-xs);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
