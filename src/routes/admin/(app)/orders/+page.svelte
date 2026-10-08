<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import DataTable from '#lib/components/admin/DataTable.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import {
		ORDER_STATUS_LABELS,
		PAYMENT_STATUS_LABELS,
		PAYMENT_TONES,
		SHIPMENT_LABELS
	} from '#lib/components/admin/order-labels.ts';
	import { formatDateTime, formatPrice } from '#lib/utils/format.ts';
	import type { Column, OrderStatus, PaymentStatus } from '#lib/types.ts';

	let { data, form } = $props();
	type Row = (typeof data.rows)[number] & { customer: string; placed: string };
	const rows = $derived(data.rows.map((r) => ({ ...r, customer: r.name, placed: '' })) as Row[]);
	const columns: Column<Row>[] = [
		{ key: 'number', label: 'Bestelling', sortable: true },
		{ key: 'placed', label: 'Datum', sortable: true, hideBelow: 'md' },
		{ key: 'customer', label: 'Klant', sortable: true },
		{ key: 'status', label: 'Status' },
		{ key: 'paymentStatus', label: 'Betaling', hideBelow: 'lg' },
		{ key: 'shipment', label: 'Verzending', hideBelow: 'lg' },
		{ key: 'total', label: 'Totaal', sortable: true, align: 'end' }
	];
	const filtered = $derived(Object.values(data.filters).some(Boolean));
	const statusOptions = Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][];
	const paymentOptions = Object.entries(PAYMENT_STATUS_LABELS) as [PaymentStatus, string][];
	let busy = $state(false);
</script>

<svelte:head><title>Bestellingen — Beheer</title></svelte:head>

<PageHeader title="Bestellingen" description="{data.total} bestellingen{filtered ? ' met deze filters' : ''}." />

{#if form && 'bulk' in form && form.bulk}
	<div class="notice" role="status">
		{#if form.bulk.action === 'processing'}
			{form.bulk.changed} bestelling(en) op "In behandeling" gezet.{#if form.bulk.skipped}
				{form.bulk.skipped} overgeslagen (niet in status Betaald).{/if}
		{:else}
			{form.bulk.changed} label(s) klaar.
			{#if 'shipmentIds' in form.bulk && form.bulk.shipmentIds?.length}
				<a
					href="/admin/orders/labels?{form.bulk.shipmentIds.map((s) => `s=${s}`).join('&')}"
					target="_blank"
					rel="noopener"
					data-sveltekit-reload>Labels afdrukken (PDF)</a
				>
			{/if}
			{#if 'errors' in form.bulk && form.bulk.errors?.length}
				<ul>
					{#each form.bulk.errors as e, i (i)}<li>{e}</li>{/each}
				</ul>
			{/if}
		{/if}
	</div>
{/if}
{#if form && 'bulkError' in form}<p class="notice notice--error" role="alert">{form.bulkError}</p>{/if}

<DataTable
	{rows}
	{columns}
	total={data.total}
	pageSize={data.pageSize}
	selectable={data.canFulfil}
	rowHref={(r) => `/admin/orders/${r.id}`}
>
	{#snippet toolbar()}
		<form method="GET" class="filters" aria-label="Filters">
			<label class="search"
				><span class="sr-only">Zoeken</span><input
					name="q"
					type="search"
					placeholder="Nummer, e-mail of naam"
					value={data.filters.q}
				/></label
			>
			<label>
				<span class="lbl">Status</span>
				<select name="status" value={data.filters.status}>
					<option value="">Alle</option>
					{#each statusOptions as [v, l] (v)}<option value={v}>{l}</option>{/each}
				</select>
			</label>
			<label>
				<span class="lbl">Betaling</span>
				<select name="payment" value={data.filters.payment}>
					<option value="">Alle</option>
					{#each paymentOptions as [v, l] (v)}<option value={v}>{l}</option>{/each}
				</select>
			</label>
			<label><span class="lbl">Van</span><input type="date" name="from" value={data.filters.from} /></label>
			<label><span class="lbl">Tot en met</span><input type="date" name="to" value={data.filters.to} /></label>
			<Button type="submit" size="sm" variant="outline" icon="filter">Filteren</Button>
			{#if filtered}<a class="reset" href="/admin/orders">Wissen</a>{/if}
		</form>
	{/snippet}
	{#snippet bulk(ids)}
		<form
			method="POST"
			class="bulk"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update({ reset: false });
				};
			}}
		>
			{#each ids as id (id)}<input type="hidden" name="id" value={id} />{/each}
			<Button type="submit" size="sm" formaction="?/processing" disabled={busy}>Markeer in behandeling</Button>
			<Button
				type="submit"
				size="sm"
				variant="outline"
				icon="truck"
				formaction="?/labels"
				loading={busy}
				disabled={busy}>Labels aanmaken</Button
			>
		</form>
	{/snippet}
	{#snippet cell(row, col)}
		{#if col.key === 'number'}<span class="who"
				><strong>{row.number}</strong><small>{row.items} artikel{row.items === 1 ? '' : 'en'}</small></span
			>
		{:else if col.key === 'placed'}{formatDateTime(row.placedAt)}
		{:else if col.key === 'customer'}<span class="who"><span>{row.name}</span><small>{row.email}</small></span>
		{:else if col.key === 'status'}<StatusBadge status={row.status} />
		{:else if col.key === 'paymentStatus'}<Badge tone={PAYMENT_TONES[row.paymentStatus]}
				>{PAYMENT_STATUS_LABELS[row.paymentStatus]}</Badge
			>
		{:else if col.key === 'shipment'}{row.shipment
				? (SHIPMENT_LABELS[row.shipment] ?? row.shipment)
				: row.shippingMethod === 'pickup'
					? 'Afhaalpunt'
					: 'Thuislevering'}
		{:else if col.key === 'total'}{formatPrice(row.total)}{#if row.refundedTotal}<small class="refunded"
					>−{formatPrice(row.refundedTotal)}</small
				>{/if}
		{:else}{String(row[col.key] ?? '')}{/if}
	{/snippet}
	{#snippet empty()}<EmptyState
			icon="bag"
			title="Geen bestellingen gevonden"
			text={filtered ? 'Pas de filters aan of wis ze.' : undefined}
		/>{/snippet}
</DataTable>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: flex-end;
		width: 100%;
	}
	.filters label {
		display: grid;
		gap: 2px;
	}
	.lbl {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.search {
		flex: 1;
		min-width: 14rem;
	}
	.filters input,
	.filters select {
		width: 100%;
		height: 2.25rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-sm);
	}
	.filters input:focus-visible,
	.filters select:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 1px;
	}
	.reset {
		font-size: var(--fs-sm);
		align-self: center;
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.who {
		display: grid;
	}
	.who small,
	.refunded {
		color: var(--ui-text-muted);
		font-weight: var(--fw-regular);
		font-size: var(--fs-xs);
	}
	.refunded {
		display: block;
	}
	.notice {
		margin: 0 0 var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
	}
	.notice ul {
		margin: var(--space-2) 0 0;
		padding-left: var(--space-5);
		color: var(--ui-danger);
	}
	.notice--error {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
