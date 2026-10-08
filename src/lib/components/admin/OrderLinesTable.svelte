<!--
  @component OrderLinesTable — order lines from their SNAPSHOT (name, variant, price at purchase time),
  followed by the totals with the included VAT and any refunds. Admin (Dutch).
-->
<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { formatPrice } from '#lib/utils/format.ts';
	type I18n = { nl: string; fr?: string };

	interface Line {
		id: string;
		sku: string;
		name: I18n;
		variantLabel: I18n | null;
		unitPrice: number;
		qty: number;
		vatRate: number;
		vatAmount: number;
		lineTotal: number;
		discountAmount: number;
		refundedQty: number;
		giftWrap: boolean;
		engraving: { text: string; font: string } | null;
	}
	interface Totals {
		subtotal: number;
		discountTotal: number;
		discountCode: string | null;
		shippingTotal: number;
		vatTotal: number;
		total: number;
		refundedTotal: number;
	}
	let { lines, totals }: { lines: Line[]; totals: Totals } = $props();
</script>

<div class="wrap">
	<table>
		<caption class="sr-only">Artikelen</caption>
		<thead>
			<tr>
				<th scope="col">Artikel</th>
				<th scope="col" class="num">Prijs</th>
				<th scope="col" class="num">Aantal</th>
				<th scope="col" class="num">Totaal</th>
			</tr>
		</thead>
		<tbody>
			{#each lines as l (l.id)}
				<tr>
					<td>
						<strong>{l.name.nl}</strong>
						<span class="sub">{[l.variantLabel?.nl, l.sku].filter(Boolean).join(' · ')}</span>
						{#if l.engraving}<span class="sub">Gravure: “{l.engraving.text}” ({l.engraving.font})</span>{/if}
						{#if l.giftWrap || l.refundedQty}
							<span class="tags">
								{#if l.giftWrap}<Badge tone="gold">Cadeauverpakking</Badge>{/if}
								{#if l.refundedQty}<Badge tone="info">{l.refundedQty} terugbetaald</Badge>{/if}
							</span>
						{/if}
					</td>
					<td class="num">{formatPrice(l.unitPrice)}</td>
					<td class="num">{l.qty}</td>
					<td class="num">
						{formatPrice(l.lineTotal - l.discountAmount)}
						{#if l.discountAmount}<span class="sub">korting −{formatPrice(l.discountAmount)}</span>{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<dl class="totals">
		<dt>Subtotaal</dt>
		<dd>{formatPrice(totals.subtotal)}</dd>
		{#if totals.discountTotal}
			<dt>
				Korting{#if totals.discountCode}
					({totals.discountCode}){/if}
			</dt>
			<dd>−{formatPrice(totals.discountTotal)}</dd>
		{/if}
		<dt>Verzending</dt>
		<dd>{totals.shippingTotal ? formatPrice(totals.shippingTotal) : 'Gratis'}</dd>
		<dt class="grand">Totaal</dt>
		<dd class="grand">{formatPrice(totals.total)}</dd>
		<dt class="muted">waarvan btw (21%)</dt>
		<dd class="muted">{formatPrice(totals.vatTotal)}</dd>
		{#if totals.refundedTotal}
			<dt>Terugbetaald</dt>
			<dd>−{formatPrice(totals.refundedTotal)}</dd>
			<dt class="grand">Netto ontvangen</dt>
			<dd class="grand">{formatPrice(totals.total - totals.refundedTotal)}</dd>
		{/if}
	</dl>
</div>

<style>
	.wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
	th {
		text-align: left;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
		padding: var(--space-2) var(--space-5);
		background: var(--ui-surface-sunken);
		border-bottom: 1px solid var(--ui-border);
	}
	td {
		padding: var(--space-3) var(--space-5);
		border-bottom: 1px solid var(--ui-border);
		vertical-align: top;
	}
	.num {
		text-align: right;
		white-space: nowrap;
	}
	.sub {
		display: block;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-top: var(--space-1);
	}
	.totals {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-1) var(--space-6);
		margin: 0;
		padding: var(--space-4) var(--space-5) var(--space-5);
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
	.totals dt {
		text-align: right;
		color: var(--ui-text-muted);
	}
	.totals dd {
		margin: 0;
		text-align: right;
		min-width: 6rem;
	}
	.grand {
		font-weight: var(--fw-semibold);
		color: var(--ui-text) !important;
	}
	.muted {
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
