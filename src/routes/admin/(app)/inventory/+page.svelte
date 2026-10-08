<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import DataTable from '#lib/components/admin/DataTable.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatDateTime } from '#lib/utils/format.ts';
	import { METAL_LABELS, type MetalValue } from '#lib/schemas/product.ts';
	import { MANUAL_STOCK_REASONS, STOCK_REASON_LABELS } from '#lib/schemas/inventory.ts';
	import type { Column } from '#lib/types.ts';

	let { data, form } = $props();
	/** Keeps the current filters in the action URL so a no-JS post returns to the same view. */
	const act = (name: string) => {
		const p = new URLSearchParams(page.url.search);
		p.set(`/${name}`, '');
		return `?${p.toString().replace(/=(&|$)/, '$1')}`;
	};
	type Row = (typeof data.rows)[number];
	const columns: Column<Row>[] = [
		{ key: 'sku', label: 'Variant', sortable: true },
		{ key: 'product', label: 'Product', sortable: true, hideBelow: 'md' },
		{ key: 'stock', label: 'Voorraad', sortable: true, align: 'end' },
		{ key: 'threshold', label: 'Drempel', sortable: true, align: 'end', hideBelow: 'lg' },
		{ key: 'id', label: 'Aanpassen (reden verplicht)' }
	];
	const filtered = $derived(!!(data.filters.q || data.filters.low || data.filters.out || data.filters.category));
	const errFor = (id: string, k: string) => (form && 'errors' in form && form.variantId === id ? (form.errors as Record<string, string[]>)[k]?.[0] : undefined);
	const valFor = (id: string, k: string) => (form && 'values' in form && form.variantId === id ? ((form.values as Record<string, string>)[k] ?? '') : '');
</script>

<svelte:head><title>Voorraad — Beheer</title></svelte:head>

<PageHeader title="Voorraad" description="Elke wijziging wordt gelogd met een reden. Voorraad kan nooit negatief worden.">
	{#snippet actions()}
		<Button href="/admin/import" variant="outline" size="sm" icon="import">Import / export</Button>
	{/snippet}
</PageHeader>

{#if form && 'ok' in form && form.ok}
	<p class="notice" role="status"><Icon name="check" size={16} />{form.message}</p>
{:else if form && 'errors' in form}
	<p class="notice alert" role="alert"><Icon name="alert" size={16} />Niet aangepast — {Object.values(form.errors as Record<string, string[]>)[0]?.[0]}</p>
{/if}

<DataTable rows={data.rows} {columns} total={data.total} pageSize={data.pageSize} density="compact">
	{#snippet toolbar()}
		<form method="GET" class="filters" role="search" data-sveltekit-keepfocus>
			{#if data.sort.key}<input type="hidden" name="sort" value={data.sort.key} /><input type="hidden" name="dir" value={data.sort.dir} />{/if}
			<label class="search"><span class="sr-only">Zoek op SKU of product</span><input type="search" name="q" value={data.filters.q} placeholder="Zoek op SKU of product" /></label>
			<label>
				<span class="sr-only">Categorie</span>
				<select name="category" value={data.filters.category}>
					<option value="">Alle categorieën</option>
					{#each data.categories as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
				</select>
			</label>
			<label class="chk"><input type="checkbox" name="low" value="1" checked={data.filters.low} /> Lage voorraad</label>
			<label class="chk"><input type="checkbox" name="out" value="1" checked={data.filters.out} /> Uitverkocht</label>
			<Button type="submit" size="sm" variant="outline" icon="filter">Filteren</Button>
			{#if filtered}<a class="reset" href="/admin/inventory">Wis filters</a>{/if}
		</form>
	{/snippet}
	{#snippet cell(row, col)}
		{#if col.key === 'sku'}
			<span class="var">
				{#if row.image}<img src={row.image} alt="" width="28" height="35" loading="lazy" />{/if}
				<span><code>{row.sku}</code><small>{METAL_LABELS[row.metal as MetalValue]}{row.size ? ` · maat ${row.size}` : ''}</small></span>
			</span>
		{:else if col.key === 'product'}
			<a href="/admin/products/{row.productId}">{row.product}</a>
			{#if row.status !== 'active'}<StatusBadge status={row.status} />{/if}
		{:else if col.key === 'stock'}
			<span class="stock" class:out={row.stock === 0} class:low={row.stock > 0 && row.stock <= row.threshold}>{row.stock}</span>
			{#if row.stock === 0}<span class="tag">Uitverkocht</span>{:else if row.stock <= row.threshold}<StatusBadge status="low_stock" />{/if}
		{:else if col.key === 'threshold'}{row.threshold}
		{:else if col.key === 'id'}
			{#if data.canWrite}
				<form method="POST" action={act('adjust')} class="adjust" use:enhance={() => async ({ update }) => update({ reset: true })}>
					<input type="hidden" name="variantId" value={row.id} />
					<label>
						<span class="sr-only">Wijziging voor {row.sku} (bv. +5 of -2)</span>
						<input name="delta" inputmode="numeric" placeholder="+/−" value={valFor(row.id, 'delta')} class="delta" aria-invalid={!!errFor(row.id, 'delta') || undefined} />
					</label>
					<label>
						<span class="sr-only">Reden voor {row.sku}</span>
						<select name="reason" value={valFor(row.id, 'reason')} aria-invalid={!!errFor(row.id, 'reason') || undefined}>
							<option value="">Reden…</option>
							{#each MANUAL_STOCK_REASONS as r (r)}<option value={r}>{STOCK_REASON_LABELS[r]}</option>{/each}
						</select>
					</label>
					<label>
						<span class="sr-only">Notitie voor {row.sku}</span>
						<input name="note" placeholder="Notitie" maxlength="200" value={valFor(row.id, 'note')} class="note" />
					</label>
					<button type="submit" aria-label="Voorraad van {row.sku} aanpassen"><Icon name="check" size={14} /></button>
					{#if errFor(row.id, 'delta') || errFor(row.id, 'reason')}
						<p class="err" role="alert"><Icon name="alert" size={12} />{errFor(row.id, 'delta') ?? errFor(row.id, 'reason')}</p>
					{/if}
				</form>
			{:else}<span class="muted">Alleen-lezen</span>{/if}
		{/if}
	{/snippet}
</DataTable>

<div class="moves">
	<Card title="Laatste voorraadbewegingen">
		{#if data.movements.length}
			<ul>
				{#each data.movements as mv (mv.id)}
					<li>
						<span class="d" class:neg={mv.delta < 0}>{mv.delta > 0 ? '+' : ''}{mv.delta}</span>
						<code>{mv.sku}</code>
						<span>{STOCK_REASON_LABELS[mv.reason] ?? mv.reason}{mv.note ? ` — ${mv.note}` : ''}</span>
						<small>{mv.actor ?? 'Systeem'} · {formatDateTime(mv.createdAt)}</small>
					</li>
				{/each}
			</ul>
		{:else}<p class="muted">Nog geen bewegingen.</p>{/if}
	</Card>
</div>

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
		flex: 1 1 12rem;
	}
	.search input {
		width: 100%;
	}
	.filters input[type='search'],
	.filters select,
	.adjust input,
	.adjust select {
		height: 2.25rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-sm);
	}
	[aria-invalid='true'] {
		border-color: var(--ui-danger) !important;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
	}
	.reset {
		color: var(--ui-text-muted);
	}
	.var {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.var img {
		width: 1.75rem;
		height: 2.2rem;
		object-fit: cover;
		border-radius: var(--r-xs);
	}
	.var > span {
		display: grid;
		line-height: 1.25;
	}
	.var small,
	.muted {
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
	}
	code {
		font-size: var(--fs-xs);
	}
	.stock {
		font-weight: var(--fw-semibold);
		margin-right: var(--space-2);
	}
	.stock.out {
		color: var(--ui-danger);
	}
	.stock.low {
		color: var(--ui-warning);
	}
	.tag {
		font-size: var(--fs-xs);
		padding: 2px 8px;
		border-radius: var(--r-full);
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
	.adjust {
		display: flex;
		flex-wrap: nowrap;
		gap: 4px;
		align-items: center;
		padding-block: 4px;
	}
	.delta {
		width: 4.5rem;
	}
	.note {
		width: 7rem;
	}
	.adjust button {
		width: 2.25rem;
		height: 2.25rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--ui-action);
		border-radius: var(--r-xs);
		background: var(--ui-action);
		color: var(--ui-action-text);
		cursor: pointer;
	}
	.adjust button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.err {
		display: flex;
		gap: 4px;
		align-items: center;
		margin: 0;
		color: var(--ui-danger);
		font-size: var(--fs-xs);
		white-space: normal;
	}
	.moves {
		margin-top: var(--space-6);
	}
	.moves ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
		font-size: var(--fs-sm);
	}
	.moves li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: baseline;
	}
	.moves small {
		color: var(--ui-text-muted);
		margin-left: auto;
	}
	.d {
		min-width: 2.5rem;
		font-weight: var(--fw-semibold);
		color: var(--ui-success);
		font-variant-numeric: tabular-nums;
	}
	.d.neg {
		color: var(--ui-danger);
	}
	.notice {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-6);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--ui-success);
		border-radius: var(--r-md);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		font-size: var(--fs-sm);
	}
	.notice.alert {
		border-color: var(--ui-danger);
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
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
