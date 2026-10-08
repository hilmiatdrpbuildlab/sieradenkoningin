<script lang="ts">
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import DataTable from '#lib/components/admin/DataTable.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { formatDate, formatPrice } from '#lib/utils/format.ts';
	import { STATUS_LABELS, PRODUCT_STATUSES } from '#lib/schemas/product.ts';
	import type { Column } from '#lib/types.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];
	const columns: Column<Row>[] = [
		{ key: 'name', label: 'Product', sortable: true },
		{ key: 'status', label: 'Status', sortable: true },
		{ key: 'category', label: 'Categorie', hideBelow: 'md' },
		{ key: 'price', label: 'Prijs', sortable: true, align: 'end' },
		{ key: 'stock', label: 'Voorraad', sortable: true, align: 'end' },
		{ key: 'updated', label: 'Gewijzigd', sortable: true, hideBelow: 'lg' }
	];
	const filtered = $derived(!!(data.filters.q || data.filters.status || data.filters.category));
	const autoSubmit = (e: Event) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit();
</script>

<svelte:head><title>Producten — Beheer</title></svelte:head>

<PageHeader title="Producten" description="{data.total} {data.total === 1 ? 'product' : 'producten'}{data.filters.status ? '' : ' (zonder gearchiveerde)'}">
	{#snippet actions()}
		{#if data.canWrite}
			<Button href="/admin/import" variant="outline" size="sm" icon="import">Import / export</Button>
			<Button href="/admin/products/nieuw" size="sm" icon="plus">Nieuw product</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable rows={data.rows} {columns} total={data.total} pageSize={data.pageSize} rowHref={(r) => `/admin/products/${r.id}`}>
	{#snippet toolbar()}
		<form method="GET" class="filters" role="search" data-sveltekit-keepfocus>
			{#if data.sort.key}<input type="hidden" name="sort" value={data.sort.key} /><input type="hidden" name="dir" value={data.sort.dir} />{/if}
			<label class="search">
				<span class="sr-only">Zoek op naam, slug of SKU</span>
				<input type="search" name="q" placeholder="Zoek op naam, slug of SKU" value={data.filters.q} />
			</label>
			<label>
				<span class="sr-only">Status</span>
				<select name="status" value={data.filters.status} onchange={autoSubmit}>
					<option value="">Alle statussen</option>
					{#each PRODUCT_STATUSES as s (s)}<option value={s}>{STATUS_LABELS[s]}</option>{/each}
				</select>
			</label>
			<label>
				<span class="sr-only">Categorie</span>
				<select name="category" value={data.filters.category} onchange={autoSubmit}>
					<option value="">Alle categorieën</option>
					{#each data.categories as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
				</select>
			</label>
			<Button type="submit" size="sm" variant="outline" icon="filter">Filteren</Button>
			{#if filtered}<a class="reset" href="/admin/products">Wis filters</a>{/if}
		</form>
	{/snippet}
	{#snippet cell(row, col)}
		{#if col.key === 'name'}
			<span class="prod">
				{#if row.image}<img src={row.image} alt="" width="36" height="45" loading="lazy" />{:else}<span class="ph" aria-hidden="true"></span>{/if}
				<span class="txt"><span class="nm">{row.name}</span><small>{row.variants} variant{row.variants === 1 ? '' : 'en'} · {row.slug}</small></span>
			</span>
		{:else if col.key === 'status'}<StatusBadge status={row.status} />
		{:else if col.key === 'price'}
			{#if row.compareAtPrice}<s class="was">{formatPrice(row.compareAtPrice)}</s>{/if}
			{formatPrice(row.price)}
		{:else if col.key === 'stock'}
			<span class:zero={row.stock === 0}>{row.stock}{#if row.stock === 0}<span class="sr-only"> (uitverkocht)</span>{/if}</span>
		{:else if col.key === 'updated'}{formatDate(row.updated)}
		{:else}{String(row[col.key] ?? '—')}{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState title={filtered ? 'Geen producten gevonden' : 'Nog geen producten'} text={filtered ? 'Pas je zoekopdracht of filters aan.' : 'Voeg je eerste juweel toe.'}>
			{#snippet action()}
				{#if filtered}<Button href="/admin/products" variant="outline" size="sm">Wis filters</Button>
				{:else if data.canWrite}<Button href="/admin/products/nieuw" size="sm" icon="plus">Nieuw product</Button>{/if}
			{/snippet}
		</EmptyState>
	{/snippet}
</DataTable>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		width: 100%;
		font-size: var(--fs-sm);
	}
	.search {
		flex: 1 1 14rem;
	}
	.search input {
		width: 100%;
	}
	input,
	select {
		height: 2.5rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
		max-width: 100%;
	}
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.reset {
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.prod {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		padding-block: var(--space-1);
	}
	.prod img,
	.ph {
		width: 2.25rem;
		height: 2.8rem;
		object-fit: cover;
		border-radius: var(--r-xs);
		background: var(--ui-surface-sunken);
		flex: none;
	}
	.txt {
		display: grid;
		line-height: 1.3;
	}
	.nm {
		max-width: 22rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.txt small {
		font-weight: var(--fw-regular, 400);
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
	}
	.was {
		color: var(--ui-text-muted);
		margin-right: var(--space-1);
		font-size: var(--fs-xs);
	}
	.zero {
		color: var(--ui-danger);
		font-weight: var(--fw-semibold);
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
