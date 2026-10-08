<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';

	let { data, form } = $props();
	let busy = $state(false);
	let onlyErrors = $state(false);

	const rows = $derived((form && 'rows' in form ? form.rows : undefined) ?? []);
	const summary = $derived(form && 'summary' in form ? form.summary : null);
	const shown = $derived(onlyErrors ? rows.filter((r) => r.action === 'error') : rows);
	const ACTION_LABEL = { create: 'Nieuw', update: 'Bijwerken', error: 'Fout' } as const;
	const submit = () => {
		busy = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
		};
	};
</script>

<svelte:head><title>Import / export — Beheer</title></svelte:head>

<PageHeader title="Import / export" description="Producten, varianten en voorraad in bulk via CSV (één rij per variant).">
	{#snippet actions()}
		<Button href="/admin/import/export.csv" variant="outline" size="sm" icon="download" data-sveltekit-reload>Exporteer producten</Button>
	{/snippet}
</PageHeader>

<div class="layout">
	<div class="main">
		{#if data.canWrite}
			<Card title="1. CSV uploaden" description="Eerst wordt een proefimport getoond; er wordt nog niets opgeslagen.">
				<form method="POST" action="?/preview" enctype="multipart/form-data" class="upload" use:enhance={submit}>
					<label class="file">
						<span>CSV-bestand (max. 5 MB, scheiding ; of ,)</span>
						<input type="file" name="file" accept=".csv,text/csv" required />
					</label>
					<Button type="submit" size="sm" icon="eye" loading={busy}>Proefimport</Button>
				</form>
				{#if form?.message}<p class="err" role="alert"><Icon name="alert" size={14} />{form.message}</p>{/if}
			</Card>
		{:else}
			<p class="muted">Je kan exporteren, maar niet importeren.</p>
		{/if}

		{#if summary}
			<Card title={form?.step === 'done' ? '3. Resultaat' : '2. Proefimport controleren'}>
				<div class="summary" role="status">
					<span class="pill create"><strong>{summary.create}</strong> nieuw</span>
					<span class="pill update"><strong>{summary.update}</strong> bijwerken</span>
					<span class="pill error"><strong>{summary.errors}</strong> fout{summary.errors === 1 ? '' : 'en'}</span>
					<span class="muted">{summary.rows} rijen · {summary.productsCreate} nieuwe en {summary.productsUpdate} bestaande producten</span>
				</div>
				{#if form?.step === 'done'}
					<p class="ok"><Icon name="check" size={16} />Import uitgevoerd. {summary.errors ? 'Rijen met fouten zijn overgeslagen; corrigeer ze en importeer opnieuw.' : 'Alle rijen zijn verwerkt.'}</p>
				{:else if form && 'csv' in form}
					<form method="POST" action="?/commit" class="commit" use:enhance={submit}>
						<input type="hidden" name="csv" value={form.csv} />
						<Button type="submit" size="sm" icon="check" loading={busy} disabled={summary.rows === summary.errors}>
							Importeer {summary.rows - summary.errors} geldige rij{summary.rows - summary.errors === 1 ? '' : 'en'}
						</Button>
						{#if summary.errors}<span class="muted">{summary.errors} rij{summary.errors === 1 ? '' : 'en'} met fouten worden overgeslagen.</span>{/if}
					</form>
				{/if}
				{#if summary.errors}
					<label class="only"><input type="checkbox" bind:checked={onlyErrors} /> Toon enkel fouten</label>
				{/if}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable) -->
				<div class="scroller" tabindex="0" role="region" aria-label="Rijen van de import">
					<table>
						<thead><tr><th>Regel</th><th>Actie</th><th>Product</th><th>SKU</th><th>Voorraad</th><th>Meldingen</th></tr></thead>
						<tbody>
							{#each shown as r (r.line)}
								<tr class={r.action}>
									<td>{r.line}</td>
									<td><span class="tag {r.action}">{#if r.action === 'error'}<Icon name="alert" size={12} />{/if}{ACTION_LABEL[r.action]}</span></td>
									<td><code>{r.slug || '—'}</code>{#if r.productAction !== 'none'}<small> ({r.productAction === 'create' ? 'nieuw product' : 'product bijwerken'})</small>{/if}</td>
									<td><code>{r.sku ?? '—'}</code></td>
									<td class="num">{r.stockDelta ? (r.stockDelta > 0 ? `+${r.stockDelta}` : r.stockDelta) : '—'}</td>
									<td class="msgs">
										{#each r.errors as m (m)}<span class="e">{m}</span>{/each}
										{#each r.warnings as m (m)}<span class="w">{m}</span>{/each}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		{/if}
	</div>

	<aside class="side">
		<Card title="Sjabloon">
			<p class="muted">Download het sjabloon, vul het in Excel of Numbers in en sla op als CSV (UTF-8).</p>
			<Button href="/admin/import/template.csv" variant="outline" size="sm" icon="download" data-sveltekit-reload>Download sjabloon</Button>
		</Card>
		<Card title="Kolommen">
			<ul class="cols">
				<li><code>product_slug</code> verplicht · groepeert rijen per product</li>
				<li><code>sku</code> één rij per variant; bestaande SKU = bijwerken</li>
				<li><code>name_nl</code>, <code>category</code>, <code>price</code> verplicht voor nieuwe producten</li>
				<li><code>category</code>: rings, ringen, bagues … · <code>metal</code>: gold, rosegold, silver</li>
				<li><code>price</code> in euro: 49,95 · <code>stock</code> = nieuwe voorraad (verschil wordt gelogd)</li>
				<li>Lege cel = ongewijzigd · <code>-</code> wist van-prijs of prijs-override</li>
				<li>Nieuwe producten worden als concept aangemaakt (eerst foto’s toevoegen)</li>
			</ul>
			<details><summary>Alle kolommen</summary><p class="muted">{data.columns.join(' ; ')}</p></details>
		</Card>
	</aside>
</div>

<style>
	.layout {
		display: grid;
		gap: var(--space-6);
		align-items: start;
	}
	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 22rem;
		}
	}
	.main,
	.side {
		display: grid;
		gap: var(--space-6);
		min-width: 0;
	}
	.upload,
	.commit {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: end;
	}
	.file {
		display: grid;
		gap: var(--space-1);
		font-size: var(--fs-sm);
		flex: 1 1 16rem;
	}
	.file input {
		min-height: 2.75rem;
	}
	.muted {
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
		margin: 0 0 var(--space-3);
	}
	.err,
	.ok {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin: var(--space-3) 0 0;
		font-size: var(--fs-sm);
		color: var(--ui-danger);
	}
	.ok {
		color: var(--ui-success);
		margin-bottom: var(--space-3);
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		margin-bottom: var(--space-4);
	}
	.summary .muted {
		margin: 0;
	}
	.pill {
		padding: var(--space-1) var(--space-3);
		border-radius: var(--r-full);
		font-size: var(--fs-sm);
	}
	.pill.create {
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.pill.update {
		background: var(--ui-info-bg);
		color: var(--ui-info);
	}
	.pill.error {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
	.commit {
		margin-bottom: var(--space-4);
		align-items: center;
	}
	.only {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		min-height: 2.75rem;
		font-size: var(--fs-sm);
	}
	.scroller {
		position: relative;
		overflow: auto;
		max-height: 32rem;
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
	}
	.scroller:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-xs);
	}
	th,
	td {
		padding: var(--space-2);
		text-align: left;
		border-bottom: 1px solid var(--ui-border);
		vertical-align: top;
	}
	th {
		position: sticky;
		top: 0;
		background: var(--ui-surface-sunken);
		font-weight: var(--fw-semibold);
		color: var(--ui-text-muted);
	}
	tr.error td {
		background: var(--ui-danger-bg);
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.tag {
		display: inline-flex;
		gap: 4px;
		align-items: center;
		white-space: nowrap;
		font-weight: var(--fw-medium);
	}
	.tag.create {
		color: var(--ui-success);
	}
	.tag.update {
		color: var(--ui-info);
	}
	.tag.error {
		color: var(--ui-danger);
	}
	.msgs {
		display: grid;
		gap: 2px;
		min-width: 14rem;
	}
	.e {
		color: var(--ui-danger);
	}
	.w {
		color: var(--ui-warning);
	}
	small {
		color: var(--ui-text-muted);
	}
	.cols {
		margin: 0;
		padding-left: var(--space-4);
		display: grid;
		gap: var(--space-2);
		font-size: var(--fs-sm);
	}
	details {
		margin-top: var(--space-3);
		font-size: var(--fs-sm);
	}
	details p {
		overflow-wrap: anywhere;
		margin-top: var(--space-2);
	}
</style>
