<script lang="ts">
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import StatCard from '#lib/components/admin/StatCard.svelte';
	import TrendChart from '#lib/components/admin/TrendChart.svelte';
	import BarList from '#lib/components/admin/BarList.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatDate, formatPrice } from '#lib/utils/format.ts';

	let { data } = $props();
	const eur = (c: number) => formatPrice(c);
	const eurShort = (c: number) => (c >= 100_000 ? `€ ${Math.round(c / 100_000)}k` : formatPrice(c).replace(/,00$/, ''));
	const q = $derived(`from=${data.from}&to=${data.to}`);
	const exportHref = (type: string) => `/admin/reports/export?type=${type}&${q}`;
	const monthLabel = (m: string) => formatDate(`${m}-15T12:00:00Z`, 'nl', { month: 'long', year: 'numeric' });

	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
	const monthStart = today.slice(0, 8) + '01';
	const yearStart = today.slice(0, 5) + '01-01';
</script>

<svelte:head><title>Rapporten — Beheer</title></svelte:head>

<PageHeader title="Rapporten" description="Bedragen incl. 21% btw, tenzij anders vermeld. Dagen volgens Belgische tijd.">
	{#snippet actions()}
		<form method="GET" class="range">
			<label>Van <input type="date" name="from" value={data.from} /></label>
			<label>Tot en met <input type="date" name="to" value={data.to} /></label>
			<Button type="submit" size="sm" variant="outline">Toon</Button>
		</form>
	{/snippet}
	{#snippet meta()}
		<a class="preset" href="?from={monthStart}&to={today}">Deze maand</a>
		<a class="preset" href="?from={yearStart}&to={today}">Dit jaar</a>
	{/snippet}
</PageHeader>

<section class="kpis" aria-label="Samenvatting">
	<StatCard label="Bruto-omzet" value={eur(data.summary.gross)} icon="chart" />
	<StatCard label="Netto na terugbetalingen" value={eur(data.summary.net)} icon="chart" />
	<StatCard label="Bestellingen" value={String(data.summary.orders)} icon="receipt" />
	<StatCard label="Gem. orderwaarde" value={eur(data.summary.aov)} icon="tag" />
	<StatCard label="Verkochte stuks" value={String(data.summary.units)} icon="box" />
	<StatCard label="Btw" value={eur(data.summary.vat)} icon="file" />
</section>

<div class="grid">
	<Card title="Omzet per dag">
		{#snippet actions()}<Button href={exportHref('days')} size="sm" variant="ghost" icon="download">CSV</Button>{/snippet}
		<TrendChart hideTitle title="Netto-omzet per dag" points={data.days.map((d) => ({ label: formatDate(d.day + 'T12:00:00Z', 'nl', { day: 'numeric', month: 'short' }), value: d.net }))} format={eurShort} />
	</Card>
	<Card title="Per categorie">
		{#snippet actions()}<Button href={exportHref('categories')} size="sm" variant="ghost" icon="download">CSV</Button>{/snippet}
		<BarList hideTitle title="Omzet per categorie" items={data.categories.map((c) => ({ label: c.label, value: c.revenue, meta: `${c.units} st.` }))} format={eur} />
	</Card>
	<Card title="Per product">
		{#snippet actions()}<Button href={exportHref('products')} size="sm" variant="ghost" icon="download">CSV</Button>{/snippet}
		<BarList hideTitle title="Top 15 producten (omzet)" items={data.top.map((t) => ({ label: t.label, value: t.revenue, meta: `${t.units} st.` }))} format={eur} />
	</Card>
	<Card title="Btw-overzicht per maand" padded={false}>
		{#snippet actions()}<Button href={exportHref('vat')} size="sm" variant="ghost" icon="download">CSV</Button>{/snippet}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable, WCAG 2.1.1) -->
		<div class="scroller" tabindex="0" role="region" aria-label="Btw per maand">
			<table>
				<thead><tr><th scope="col">Maand</th><th scope="col" class="num">Bestellingen</th><th scope="col" class="num">Incl. btw</th><th scope="col" class="num">Btw 21%</th><th scope="col" class="num">Excl. btw</th><th scope="col" class="num">Terugbetaald</th></tr></thead>
				<tbody>
					{#each data.vat as v (v.month)}
						<tr><th scope="row">{monthLabel(v.month)}</th><td class="num">{v.orders}</td><td class="num">{eur(v.gross)}</td><td class="num">{eur(v.vat)}</td><td class="num">{eur(v.netExVat)}</td><td class="num">{eur(v.refunded)}</td></tr>
					{:else}
						<tr><td colspan="6" class="empty">Geen verkopen in deze periode.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>
	<Card title="Kortingscodes" padded={false}>
		{#snippet actions()}<Button href={exportHref('discounts')} size="sm" variant="ghost" icon="download">CSV</Button>{/snippet}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable, WCAG 2.1.1) -->
		<div class="scroller" tabindex="0" role="region" aria-label="Kortingscodes">
			<table>
				<thead><tr><th scope="col">Code</th><th scope="col" class="num">Gebruikt</th><th scope="col" class="num">Korting</th><th scope="col" class="num">Omzet</th></tr></thead>
				<tbody>
					{#each data.codes as c (c.code)}
						<tr><th scope="row"><code>{c.code}</code></th><td class="num">{c.uses}</td><td class="num">{eur(c.discount)}</td><td class="num">{eur(c.revenue)}</td></tr>
					{:else}
						<tr><td colspan="4" class="empty">Geen kortingscodes gebruikt.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>
</div>

<style>
	.range {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-sm);
	}
	.range input {
		height: 2.25rem;
		padding: 0 var(--space-2);
		margin-left: var(--space-1);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
	}
	.preset {
		font-size: var(--fs-sm);
		color: var(--ui-accent);
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}
	.grid {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 80rem) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.scroller {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		text-align: left;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--ui-border);
		white-space: nowrap;
	}
	thead th {
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
		background: var(--ui-surface-sunken);
	}
	tbody th {
		font-weight: var(--fw-medium);
	}
	.num {
		text-align: right;
	}
	.empty {
		text-align: center;
		color: var(--ui-text-muted);
		padding: var(--space-8);
	}
</style>
