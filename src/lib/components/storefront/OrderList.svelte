<!--
  @component OrderList — the customer's orders as cards (number, date, items, status in words, total),
  each linking to the order detail. Used on the account overview and the orders page.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatDate, formatPrice } from '#lib/utils/format.ts';
	import { localizeHref, type Lang } from '#lib/i18n/paths.ts';
	import { statusLabel } from './account-labels.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Row {
		number: string;
		status: string;
		total: number;
		placedAt: string;
		items: number;
	}
	let { orders, lang }: { orders: Row[]; lang: Lang } = $props();
</script>

<ul class="orders">
	{#each orders as o (o.number)}
		<li>
			<a href={localizeHref(`/account/orders/${o.number}`, lang)}>
				<span class="num">{o.number}</span>
				<span class="meta">
					<time datetime={o.placedAt}>{formatDate(o.placedAt, lang)}</time> · {m.acct_items({ count: o.items })}
				</span>
				<span class="status" data-status={o.status}>{statusLabel(o.status)}</span>
				<span class="total">{formatPrice(o.total, lang)}</span>
				<Icon name="chevron-right" size={16} class="chev" />
			</a>
		</li>
	{/each}
</ul>

<style>
	.orders {
		display: grid;
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--ui-border);
	}
	a {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-1) var(--space-4);
		align-items: center;
		min-height: 2.75rem;
		padding: var(--space-4) var(--space-1);
		border-bottom: 1px solid var(--ui-border);
		color: var(--ui-text);
		text-decoration: none;
	}
	a:hover .num {
		color: var(--ui-accent);
	}
	.num {
		font-weight: var(--fw-medium);
		font-variant-numeric: tabular-nums;
	}
	.meta {
		grid-column: 1;
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.status {
		grid-row: 1;
		grid-column: 2;
		justify-self: end;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--ui-text-muted);
	}
	.total {
		grid-column: 2;
		justify-self: end;
		font-variant-numeric: tabular-nums;
	}
	a :global(.chev) {
		display: none;
	}
	@media (min-width: 48rem) {
		a {
			grid-template-columns: 1.2fr 1.4fr 1fr 0.8fr auto;
		}
		.meta,
		.status,
		.total {
			grid-row: 1;
			grid-column: auto;
			justify-self: start;
		}
		.total {
			justify-self: end;
		}
		a :global(.chev) {
			display: block;
			color: var(--ui-accent);
		}
	}
</style>
