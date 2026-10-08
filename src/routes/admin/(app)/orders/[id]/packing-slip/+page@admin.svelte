<!-- Packing slip: A4, print-optimised (the toolbar is hidden when printing). -->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { formatDate } from '#lib/utils/format.ts';

	let { data } = $props();
	const o = $derived(data.order);
	const a = $derived(o.shippingAddress);
	const items = $derived(data.lines.reduce((s, l) => s + l.qty, 0));
</script>

<svelte:head><title>Pakbon {o.number}</title></svelte:head>

<div class="toolbar">
	<Button href="/admin/orders/{o.id}" size="sm" variant="ghost" icon="arrow-left">Terug naar bestelling</Button>
	<Button size="sm" icon="printer" onclick={() => window.print()}>Afdrukken</Button>
</div>

<article class="slip">
	<header>
		<div>
			<p class="brand">{data.store.name || 'Sieradenkoningin'}</p>
			<p class="small">
				{[data.store.street, [data.store.postalCode, data.store.city].filter(Boolean).join(' ')]
					.filter(Boolean)
					.join(' · ')}
				{#if data.store.email}<br />{data.store.email}{/if}
			</p>
		</div>
		<div class="meta">
			<h1>Pakbon</h1>
			<p><span>Bestelling</span> <strong>{o.number}</strong></p>
			<p><span>Datum</span> {formatDate(o.placedAt)}</p>
			<p><span>Artikelen</span> {items}</p>
		</div>
	</header>

	<section class="ship">
		<h2>{o.shippingMethod === 'pickup' ? 'Afhaalpunt' : 'Leveradres'}</h2>
		{#if o.shippingMethod === 'pickup' && o.servicePoint}
			<p>
				<strong>{o.servicePoint.name}</strong><br />{o.servicePoint.street}<br />{o.servicePoint.postalCode}
				{o.servicePoint.city}
			</p>
			<p class="small">Voor: {a.name}</p>
		{:else}
			<p>
				<strong>{a.name}</strong>{#if a.company}<br />{a.company}{/if}<br />{a.line1}{#if a.line2}<br
					/>{a.line2}{/if}<br />{a.postalCode}
				{a.city}<br />{a.country}
			</p>
		{/if}
	</section>

	<table>
		<thead>
			<tr
				><th scope="col" class="cb"><span class="sr-only">Gecontroleerd</span></th><th scope="col">Artikel</th><th
					scope="col">SKU</th
				><th scope="col" class="num">Aantal</th></tr
			>
		</thead>
		<tbody>
			{#each data.lines as l (l.id)}
				<tr>
					<td class="cb"><span class="box" aria-hidden="true"></span></td>
					<td>
						<strong>{l.name}</strong>{#if l.variant}<span class="small"> · {l.variant}</span>{/if}
						{#if l.engraving}<span class="note">Gravure: “{l.engraving.text}” ({l.engraving.font})</span>{/if}
						{#if l.giftWrap}<span class="note">Cadeauverpakking</span>{/if}
					</td>
					<td class="mono">{l.sku}</td>
					<td class="num">{l.qty}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if o.giftWrap || o.giftMessage}
		<section class="gift">
			<h2>Cadeau</h2>
			{#if o.giftWrap}<p>Verpakken in de signature box.</p>{/if}
			{#if o.giftMessage}<p class="msg">Kaartje: “{o.giftMessage}”</p>{/if}
		</section>
	{/if}

	<footer class="small">Taal klant: {o.locale.toUpperCase()} · {o.email}</footer>
</article>

<style>
	.toolbar {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		max-width: 52rem;
		margin: 0 auto;
		padding: var(--space-4);
	}
	.slip {
		max-width: 52rem;
		margin: 0 auto var(--space-8);
		padding: var(--space-8);
		background: var(--ui-surface);
		color: var(--ui-text);
		border: 1px solid var(--ui-border);
		font-size: var(--fs-sm);
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: var(--space-6);
		flex-wrap: wrap;
		padding-bottom: var(--space-5);
		border-bottom: 2px solid var(--ui-text);
	}
	.brand {
		margin: 0;
		font-family: var(--ff-serif);
		font-size: var(--fs-2xl);
	}
	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--fs-xl);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
	}
	.meta p {
		margin: 0;
	}
	.meta span {
		display: inline-block;
		min-width: 6rem;
		color: var(--ui-text-muted);
	}
	.ship {
		padding: var(--space-5) 0;
	}
	.ship p {
		margin: 0;
		font-size: var(--fs-base);
		line-height: var(--lh-normal);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		text-align: left;
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
		border-bottom: 1px solid var(--ui-text);
		padding: var(--space-2);
	}
	td {
		padding: var(--space-3) var(--space-2);
		border-bottom: 1px solid var(--ui-border);
		vertical-align: top;
	}
	.num {
		text-align: right;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}
	.cb {
		width: 2rem;
	}
	.box {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border: 1.5px solid var(--ui-text);
	}
	.mono {
		font-family: var(--ff-mono, monospace);
		font-size: var(--fs-xs);
	}
	.note {
		display: block;
		margin-top: var(--space-1);
		font-weight: var(--fw-semibold);
	}
	.gift {
		margin-top: var(--space-5);
		padding: var(--space-4);
		border: 1.5px dashed var(--ui-text);
	}
	.gift p {
		margin: 0;
	}
	.msg {
		font-style: italic;
		margin-top: var(--space-2) !important;
	}
	.small {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	footer {
		margin-top: var(--space-6) !important;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	@media (max-width: 40rem) {
		.slip {
			padding: var(--space-4);
		}
	}
	@media print {
		.toolbar {
			display: none;
		}
		.slip {
			max-width: none;
			margin: 0;
			padding: 0;
			border: 0;
			background: none;
			color: var(--ui-text);
		}
		:global(.admin-root) {
			background: none !important;
		}
		tr {
			break-inside: avoid;
		}
	}
	@page {
		size: A4;
		margin: 15mm;
	}
</style>
