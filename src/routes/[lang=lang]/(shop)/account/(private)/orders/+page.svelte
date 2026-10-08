<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import OrderList from '#lib/components/storefront/OrderList.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
</script>

<Seo title={m.acct_orders_title()} noindex />

<h1>{m.acct_orders_title()}</h1>
{#if data.orders.length}
	<OrderList orders={data.orders} lang={data.lang} />
{:else}
	<EmptyState title={m.acct_no_orders()} text={m.acct_no_orders_text()}>
		{#snippet action()}<Button href={localizeHref('/', data.lang)} variant="outline">{m.acct_start_shopping()}</Button>{/snippet}
	</EmptyState>
{/if}

<style>
	h1 {
		margin: 0 0 var(--space-6);
		font-size: var(--fs-3xl);
	}
</style>
