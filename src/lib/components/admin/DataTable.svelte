<!--
  @component DataTable — generic, URL-driven (server-side sort / page / search).
  Sorting & paging write to ?sort=&dir=&page= so +page.server.ts does the SQL;
  the table stays dumb, shareable and back-button friendly.

  <DataTable rows={data.orders} total={data.total} {columns} selectable>
    {#snippet cell(row, col)}
      {#if col.key === 'status'}<StatusBadge status={row.status} />{:else}{row[col.key]}{/if}
    {/snippet}
    {#snippet bulk(ids)}<Button size="sm" variant="outline">Markeer verzonden ({ids.length})</Button>{/snippet}
  </DataTable>
-->
<script lang="ts" generics="T extends { id: string }">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { Column } from '#lib/types.ts';


	interface Props {
		rows: T[];
		columns: Column<T>[];
		total: number;
		pageSize?: number;
		selectable?: boolean;
		density?: 'comfortable' | 'compact';
		rowHref?: (row: T) => string;
		cell?: Snippet<[T, Column<T>]>;
		bulk?: Snippet<[string[]]>;
		toolbar?: Snippet;
		empty?: Snippet;
	}

	let {
		rows, columns, total, pageSize = 25, selectable = false, density = 'comfortable',
		rowHref, cell, bulk, toolbar, empty
	}: Props = $props();

	let selected = $state<Set<string>>(new Set());
	const allChecked = $derived(rows.length > 0 && rows.every((r) => selected.has(r.id)));
	const someChecked = $derived(!allChecked && rows.some((r) => selected.has(r.id)));

	const sort = $derived(page.url.searchParams.get('sort'));
	const dir = $derived(page.url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc');
	const current = $derived(Number(page.url.searchParams.get('page') ?? 1));
	const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	/** Real links (work without JS, shareable); SvelteKit keeps scroll + focus via data attributes. */
	function hrefWith(p: Record<string, string | null>) {
		const url = new URL(page.url.href);
		for (const [k, v] of Object.entries(p)) v === null ? url.searchParams.delete(k) : url.searchParams.set(k, v);
		return url.pathname + url.search;
	}
	const sortHref = (key: string) => hrefWith({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc', page: null });
	function toggleAll() {
		selected = allChecked ? new Set() : new Set(rows.map((r) => r.id));
	}
	function toggleRow(id: string) {
		const next = new Set(selected);
		next.has(id) ? next.delete(id) : next.add(id);
		selected = next;
	}
	const ariaSort = (key: string) => (sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
</script>

<div class="table-card" data-density={density}>
	{#if toolbar || (bulk && selected.size)}
		<div class="toolbar">
			{#if bulk && selected.size}
				<span class="sel">{selected.size} geselecteerd</span>
				{@render bulk([...selected])}
			{:else if toolbar}
				{@render toolbar()}
			{/if}
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable, WCAG 2.1.1) -->
	<div class="scroller" tabindex="0" role="region" aria-label="Tabel">
		<table>
			<thead>
				<tr>
					{#if selectable}
						<th class="check"><input type="checkbox" checked={allChecked} indeterminate={someChecked} onchange={toggleAll} aria-label="Alles selecteren" /></th>
					{/if}
					{#each columns as col}
						<th
							style:width={col.width}
							class="align-{col.align ?? 'start'} {col.hideBelow ? `hide-${col.hideBelow}` : ''}"
							aria-sort={col.sortable ? ariaSort(col.key) : undefined}
						>
							{#if col.sortable}
								<a class="sort" href={sortHref(col.key)} data-sveltekit-noscroll data-sveltekit-keepfocus>
									{col.label}
									<Icon name={sort === col.key ? (dir === 'asc' ? 'sort-asc' : 'sort-desc') : 'sort'} size={14} />
								</a>
							{:else}{col.label}{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr class:is-selected={selected.has(row.id)} class:clickable={!!rowHref}>
						{#if selectable}
							<td class="check"><input type="checkbox" checked={selected.has(row.id)} onchange={() => toggleRow(row.id)} aria-label="Selecteer rij" /></td>
						{/if}
						{#each columns as col, i}
							<td class="align-{col.align ?? 'start'} {col.hideBelow ? `hide-${col.hideBelow}` : ''}">
								{#if i === 0 && rowHref}<a href={rowHref(row)} class="row-link">{#if cell}{@render cell(row, col)}{:else}{String(row[col.key] ?? '')}{/if}</a>
								{:else if cell}{@render cell(row, col)}
								{:else}{String(row[col.key] ?? '')}{/if}
							</td>
						{/each}
					</tr>
				{:else}
					<tr><td colspan={columns.length + (selectable ? 1 : 0)} class="empty">
						{#if empty}{@render empty()}{:else}Geen resultaten gevonden.{/if}
					</td></tr>
				{/each}
			</tbody>
		</table>
	</div>

	<nav class="pager" aria-label="Paginering">
		<span>{Math.min(total, (current - 1) * pageSize + 1)}–{Math.min(total, current * pageSize)} van {total}</span>
		<div>
			{#if current > 1}<a href={hrefWith({ page: String(current - 1) })} data-sveltekit-noscroll aria-label="Vorige pagina"><Icon name="chevron-left" size={16} /></a>
			{:else}<span class="pg-disabled" aria-hidden="true"><Icon name="chevron-left" size={16} /></span>{/if}
			<span aria-current="page">{current} / {pages}</span>
			{#if current < pages}<a href={hrefWith({ page: String(current + 1) })} data-sveltekit-noscroll aria-label="Volgende pagina"><Icon name="chevron-right" size={16} /></a>
			{:else}<span class="pg-disabled" aria-hidden="true"><Icon name="chevron-right" size={16} /></span>{/if}
		</div>
	</nav>
</div>

<style>
	.table-card { background: var(--ui-surface); border: 1px solid var(--ui-border); border-radius: var(--r-md); overflow: hidden; }
	.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--ui-border); min-height: 3.5rem; }
	.sel { font-size: var(--fs-sm); font-weight: var(--fw-medium); }

	.scroller { position: relative; overflow-x: auto; -webkit-overflow-scrolling: touch; }
	.scroller:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: -2px; }
	table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
	th, td { padding: 0 var(--space-4); height: var(--row-h, 3rem); text-align: left; white-space: nowrap; border-bottom: 1px solid var(--ui-border); }
	[data-density='compact'] :is(th, td) { height: var(--row-h-compact, 2.5rem); }
	th {
		position: sticky;
		top: 0;
		background: var(--ui-surface-sunken);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--ui-text-muted);
	}
	/* Keep first data column visible while scrolling horizontally on phones */
	th:first-child, td:first-child { position: sticky; left: 0; background: inherit; z-index: 1; }
	tbody tr { background: var(--ui-surface); transition: background-color var(--dur-fast); }
	tbody tr:hover { background: var(--ui-surface-sunken); }
	tr.is-selected { background: color-mix(in srgb, var(--ui-ornament) 12%, var(--ui-surface)); }
	.clickable { position: relative; }
	.row-link { text-decoration: none; font-weight: var(--fw-medium); }
	.row-link::after { content: ''; position: absolute; inset: 0; }
	.check { width: 2.75rem; padding-right: 0; }
	.check input { position: relative; z-index: 2; accent-color: var(--ui-action); width: 1rem; height: 1rem; }
	.align-end { text-align: right; }
	.align-center { text-align: center; }
	.sort { color: inherit; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; min-height: 2rem; }
	.sort:focus-visible { outline: 2px solid var(--ui-border-focus); }
	.empty { text-align: center; height: 8rem; color: var(--ui-text-muted); white-space: normal; }

	@media (max-width: 47.99rem) { .hide-md { display: none; } }
	@media (max-width: 63.99rem) { .hide-lg { display: none; } }

	.pager { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) var(--space-4); font-size: var(--fs-xs); color: var(--ui-text-muted); }
	.pager div { display: flex; align-items: center; gap: var(--space-2); }
	.pager a, .pg-disabled { width: 2.25rem; height: 2.25rem; display: grid; place-items: center; border: 1px solid var(--ui-border); background: var(--ui-surface); border-radius: var(--r-xs); color: var(--ui-text); }
	.pager a:focus-visible { outline: 2px solid var(--ui-border-focus); }
	.pg-disabled { opacity: 0.4; }
</style>
