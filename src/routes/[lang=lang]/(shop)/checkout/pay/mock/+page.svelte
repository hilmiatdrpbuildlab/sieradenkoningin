<!-- Mock payment provider page (only with the mock payments adapter). -->
<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatPrice } from '#lib/utils/format.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
</script>

<Seo title={m.mockpay_title()} noindex />

<div class="container-lux wrap">
	<section class="card" aria-labelledby="mock-title">
		<p class="badge"><Icon name="info" size={14} /> {m.mockpay_badge()}</p>
		<h1 id="mock-title">{m.mockpay_title()}</h1>
		<dl>
			<dt>{m.mockpay_order()}</dt>
			<dd>{data.number}</dd>
			<dt>{m.mockpay_amount()}</dt>
			<dd>{formatPrice(data.amount, data.lang)}</dd>
			{#if data.method}<dt>{m.mockpay_method()}</dt>
				<dd>{data.method}</dd>{/if}
			<dt>{m.mockpay_status()}</dt>
			<dd>{data.status}</dd>
		</dl>
		<form method="POST" class="actions">
			<Button type="submit" name="status" value="paid" full>{m.mockpay_paid()}</Button>
			<Button type="submit" name="status" value="failed" variant="outline" full>{m.mockpay_failed()}</Button>
			<Button type="submit" name="status" value="canceled" variant="outline" full>{m.mockpay_canceled()}</Button>
			<Button type="submit" name="status" value="expired" variant="ghost" full>{m.mockpay_expired()}</Button>
		</form>
	</section>
</div>

<style>
	.wrap {
		padding-block: var(--space-12) var(--space-16);
	}
	.card {
		max-width: 28rem;
		margin: 0 auto;
		padding: var(--space-8);
		border: 1px dashed var(--ui-border-strong);
		background: var(--ui-surface);
		display: grid;
		gap: var(--space-4);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-info);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-2xl);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-4);
		margin: 0;
		font-size: var(--fs-sm);
	}
	dt {
		color: var(--ui-text-muted);
	}
	dd {
		margin: 0;
	}
	.actions {
		display: grid;
		gap: var(--space-3);
	}
</style>
