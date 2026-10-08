<script lang="ts">
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import StatCard from '#lib/components/admin/StatCard.svelte';
	import TrendChart from '#lib/components/admin/TrendChart.svelte';
	import BarList from '#lib/components/admin/BarList.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatDate, formatDateTime, formatPrice } from '#lib/utils/format.ts';

	let { data } = $props();
	const periods = [
		{ id: 'today', label: 'Vandaag' },
		{ id: '7d', label: '7 dagen' },
		{ id: '30d', label: '30 dagen' }
	];
	const vs = $derived(data.period === 'today' ? 'vs gisteren' : `vs vorige ${data.period === '7d' ? '7' : '30'} dagen`);
	const eur = (c: number) => formatPrice(c);
	const eurShort = (c: number) => (c >= 100_000 ? `€ ${Math.round(c / 100_000)}k` : formatPrice(c).replace(/,00$/, ''));
	const spark = $derived(data.trend.map((d) => d.net));
	const points = $derived(data.trend.map((d) => ({ label: formatDate(d.day + 'T12:00:00Z', 'nl', { day: 'numeric', month: 'short' }), value: d.net })));
</script>

<svelte:head><title>Dashboard — Beheer</title></svelte:head>

<PageHeader title="Dashboard" description="Netto-omzet = betaalde bestellingen min terugbetalingen, incl. btw.">
	{#snippet actions()}
		<nav class="periods" aria-label="Periode">
			{#each periods as p (p.id)}
				<a href="?period={p.id}" aria-current={data.period === p.id ? 'page' : undefined}>{p.label}</a>
			{/each}
		</nav>
	{/snippet}
</PageHeader>

<section class="kpis" aria-label="Kerncijfers">
	<StatCard label="Netto-omzet" value={eur(data.kpis.revenue.value)} delta={data.kpis.revenue.delta} deltaLabel={vs} icon="chart" trend={spark} />
	<StatCard label="Bestellingen" value={String(data.kpis.orders.value)} delta={data.kpis.orders.delta} deltaLabel={vs} icon="receipt" />
	<StatCard label="Gem. orderwaarde" value={eur(data.kpis.aov.value)} delta={data.kpis.aov.delta} deltaLabel={vs} icon="tag" />
	<StatCard label="Terugbetaald" value={eur(data.kpis.refunded.value)} delta={data.kpis.refunded.delta} deltaLabel={vs} icon="return" invert />
</section>

<div class="grid">
	<Card title="Omzet per dag">
		<TrendChart hideTitle title="Netto-omzet per dag (laatste {data.trend.length} dagen)" {points} format={eurShort} />
	</Card>
	<Card title="Per categorie">
		<BarList hideTitle title="Omzet per categorie" items={data.categories.map((c) => ({ label: c.label, value: c.value, meta: `${c.units} st.` }))} format={eur} />
	</Card>

	<Card title="Te verwerken" description="Betaalde bestellingen die nog niet in behandeling zijn." padded={false}>
		{#snippet actions()}<Button href="/admin/orders?status=paid" size="sm" variant="ghost">Alle</Button>{/snippet}
		{#if data.queue.length}
			<ul class="list">
				{#each data.queue as o (o.id)}
					<li>
						<a href="/admin/orders/{o.id}"><strong>{o.number}</strong> <small>{o.email}</small></a>
						<span class="meta">{formatDateTime(o.placedAt)} · {o.shippingMethod === 'pickup' ? 'Afhaalpunt' : 'Thuis'}</span>
						<span class="amount">{eur(o.total)}</span>
						<StatusBadge status={o.status} />
					</li>
				{/each}
			</ul>
		{:else}
			<EmptyState icon="check" title="Alles verwerkt" text="Er wachten geen betaalde bestellingen." />
		{/if}
	</Card>

	<Card title="Lage voorraad" padded={false}>
		{#snippet actions()}<Button href="/admin/inventory?low=1" size="sm" variant="ghost">Voorraad</Button>{/snippet}
		{#if data.low.length}
			<ul class="list">
				{#each data.low as v (v.id)}
					<li>
						<a href="/admin/products/{v.productId}"><strong>{v.name}</strong> <small>{v.sku}</small></a>
						<span class="amount">{v.stock === 0 ? 'Uitverkocht' : `${v.stock} st.`}</span>
						<StatusBadge status="low_stock" />
					</li>
				{/each}
			</ul>
		{:else}
			<EmptyState icon="check" title="Voorraad in orde" />
		{/if}
	</Card>

	<Card title="Topproducten">
		<BarList hideTitle title="Meest verkocht (omzet)" items={data.top.map((t) => ({ label: t.label, value: t.value, meta: `${t.units} st.` }))} format={eur} />
	</Card>
</div>

<style>
	.periods {
		display: inline-flex;
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		overflow: hidden;
	}
	.periods a {
		padding: var(--space-2) var(--space-3);
		font-size: var(--fs-sm);
		text-decoration: none;
		color: var(--ui-text-muted);
		min-height: 2.25rem;
		display: inline-flex;
		align-items: center;
	}
	.periods a[aria-current='page'] {
		background: var(--ui-action);
		color: var(--ui-action-text);
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}
	.grid {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 80rem) {
		.grid {
			grid-template-columns: 3fr 2fr;
		}
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.list li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-3) var(--space-5);
		border-top: 1px solid var(--ui-border);
		font-size: var(--fs-sm);
	}
	.list a {
		text-decoration: none;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.list small,
	.meta {
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
	}
	.meta {
		grid-column: 1;
	}
	.amount {
		font-variant-numeric: tabular-nums;
	}
</style>
