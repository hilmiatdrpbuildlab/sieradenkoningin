<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import Notice from '#lib/components/storefront/Notice.svelte';
	import OrderList from '#lib/components/storefront/OrderList.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
	const L = (p: string) => localizeHref(p, data.lang);
	const a = $derived(data.defaultAddress);
</script>

<Seo title={m.acct_overview_title()} noindex />

<h1 class="title">{m.acct_overview_title()}</h1>

{#if data.notice === 'verified'}<Notice kind="success"><p>{m.acct_verified_notice()}</p></Notice>{/if}
{#if data.notice === 'password'}<Notice kind="success"><p>{m.acct_password_reset_notice()}</p></Notice>{/if}

<section class="block" aria-labelledby="recent-title">
	<div class="row">
		<h2 id="recent-title">{m.acct_recent_orders()}</h2>
		{#if data.orderCount > 3}<a class="more" href={L('/account/orders')}>{m.acct_all_orders({ count: data.orderCount })}</a>{/if}
	</div>
	{#if data.orders.length}
		<OrderList orders={data.orders} lang={data.lang} />
	{:else}
		<EmptyState title={m.acct_no_orders()} text={m.acct_no_orders_text()}>
			{#snippet action()}<Button href={L('/')} variant="outline">{m.acct_start_shopping()}</Button>{/snippet}
		</EmptyState>
	{/if}
</section>

<div class="cards">
	<section class="card" aria-labelledby="addr-title">
		<h2 id="addr-title">{m.acct_default_address()}</h2>
		{#if a}
			<address>
				{a.name}<br />{#if a.company}{a.company}<br />{/if}{a.line1}<br />{#if a.line2}{a.line2}<br />{/if}{a.postalCode}
				{a.city}<br />{a.country}
			</address>
		{:else}
			<p class="muted">{m.acct_no_addresses()}</p>
		{/if}
		<a class="more" href={L('/account/addresses')}>{m.acct_manage_addresses()}</a>
	</section>
	<section class="card" aria-labelledby="pref-title">
		<h2 id="pref-title">{m.acct_preferences()}</h2>
		<p class="muted">
			{data.newsletter === 'confirmed'
				? m.acct_newsletter_status_on()
				: data.newsletter === 'pending'
					? m.acct_newsletter_status_pending()
					: m.acct_newsletter_status_off()}
		</p>
		<a class="more" href={L('/account/settings')}>{m.acct_manage_settings()}</a>
	</section>
	<section class="card" aria-labelledby="wl-title">
		<h2 id="wl-title">{m.acct_nav_wishlist()}</h2>
		<p class="muted">{m.acct_wishlist_text()}</p>
		<a class="more" href={L('/wishlist')}>{m.acct_view_wishlist()}</a>
	</section>
</div>

<style>
	.title {
		margin: 0 0 var(--space-6);
		font-size: var(--fs-3xl);
	}
	.block {
		margin-block: var(--space-8);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		margin-bottom: var(--space-4);
	}
	h2 {
		margin: 0;
		font-size: var(--fs-xl);
	}
	.cards {
		display: grid;
		gap: var(--space-4);
	}
	@media (min-width: 48rem) {
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.card {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding: var(--space-6);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
	}
	address {
		font-style: normal;
		line-height: 1.6;
	}
	.muted {
		margin: 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.more {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--ui-accent);
		font-size: var(--fs-sm);
	}
</style>
