<!-- Thank-you / payment return page (P2-08). Polls briefly while the payment is still pending. -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import OrderSummary from '#lib/components/storefront/OrderSummary.svelte';
	import PaymentMethods from '#lib/components/storefront/PaymentMethods.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatDate } from '#lib/utils/format.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();

	const o = $derived(data.order);
	const MAX_POLLS = 8;
	let polls = $state(0);
	let timer: ReturnType<typeof setTimeout> | undefined;
	// svelte-ignore state_referenced_locally
	let method = $state(data.order.paymentMethod ?? data.paymentMethods[0]);
	let retrying = $state(false);

	$effect(() => {
		if (o.state !== 'pending' || polls >= MAX_POLLS) return;
		timer = setTimeout(async () => {
			polls++;
			await invalidateAll();
		}, 2000);
		return () => clearTimeout(timer);
	});
	onDestroy(() => clearTimeout(timer));

	const retryError = $derived(
		form?.retryError === 'stock'
			? m.thanks_retry_stock()
			: form?.retryError === 'paid'
				? m.thanks_retry_paid()
				: form?.retryError
					? m.thanks_retry_error()
					: null
	);
	const delivery = $derived(
		formatDate(o.deliveryEstimate, data.lang, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
	);
	const a = $derived(o.shippingAddress);
</script>

<Seo
	title={o.state === 'paid'
		? m.thanks_title()
		: o.state === 'pending'
			? m.thanks_pending_title()
			: m.thanks_failed_title()}
	noindex
/>

<div class="container-lux page">
	<section class="status status--{o.state}" aria-labelledby="thanks-title">
		{#if o.state === 'paid'}
			<Icon name="crown" size={44} stroke={1} class="orn" />
			<h1 id="thanks-title">{m.thanks_title()}</h1>
			<p class="lead" role="status">{m.thanks_paid_text({ number: o.number, email: o.email })}</p>
			<p class="eta"><Icon name="truck" size={18} /> {m.thanks_delivery_estimate({ date: delivery })}</p>
		{:else if o.state === 'pending'}
			<span class="spinner" aria-hidden="true"></span>
			<h1 id="thanks-title">{m.thanks_pending_title()}</h1>
			<p class="lead" role="status" aria-live="polite">
				{polls >= MAX_POLLS ? m.thanks_pending_slow() : m.thanks_pending_text({ number: o.number })}
			</p>
			{#if polls >= MAX_POLLS}<Button variant="outline" onclick={() => invalidateAll()} icon="refresh"
					>{m.thanks_refresh()}</Button
				>{/if}
		{:else}
			<Icon name="alert" size={40} stroke={1} class="warn" />
			<h1 id="thanks-title">{m.thanks_failed_title()}</h1>
			<p class="lead" role="alert">{m.thanks_failed_text({ number: o.number })}</p>
			<form
				method="POST"
				action={data.token ? `?/retry&t=${encodeURIComponent(data.token)}` : '?/retry'}
				class="retry"
				use:enhance={() => {
					retrying = true;
					return async ({ result, update }) => {
						if (
							result.type === 'redirect' &&
							/^https?:/.test(result.location) &&
							new URL(result.location).origin !== location.origin
						) {
							location.href = result.location;
							return;
						}
						await update();
						retrying = false;
					};
				}}
			>
				<PaymentMethods methods={data.paymentMethods} bind:value={method} />
				{#if retryError}<p class="err" role="alert">{retryError}</p>{/if}
				<Button type="submit" full size="lg" loading={retrying}>{m.thanks_retry()}</Button>
			</form>
		{/if}
	</section>

	<div class="grid">
		<div class="details">
			<div class="card">
				<h2>{o.shippingMethod === 'pickup' ? m.thanks_pickup_point() : m.thanks_delivery_address()}</h2>
				{#if o.shippingMethod === 'pickup' && o.servicePoint}
					<p>
						{o.servicePoint.name}<br />{o.servicePoint.street}<br />{o.servicePoint.postalCode}
						{o.servicePoint.city}
					</p>
					<p class="muted">{m.thanks_pickup_for({ name: a.name })}</p>
				{:else}
					<p>
						{a.name}<br />{#if a.company}{a.company}<br />{/if}{a.line1}<br />{#if a.line2}{a.line2}<br
							/>{/if}{a.postalCode}
						{a.city}
					</p>
				{/if}
				{#if o.giftWrap || o.giftMessage}
					<p class="gift">
						<Icon name="gift" size={16} />
						{m.thanks_gift()}{#if o.giftMessage}<br /><em>“{o.giftMessage}”</em>{/if}
					</p>
				{/if}
			</div>
			{#if data.guest}
				<div class="card account">
					<h2>{m.thanks_account_title()}</h2>
					<p>{m.thanks_account_text()}</p>
					<Button href={localizeHref('/account/register', data.lang)} variant="outline">{m.thanks_account_cta()}</Button
					>
				</div>
			{/if}
			<Button href="/{data.lang}" variant="link" iconRight="arrow-right">{m.cart_continue()}</Button>
		</div>
		<OrderSummary
			lines={data.lines}
			totals={o.totals}
			discountCode={o.discountCode}
			lang={data.lang}
			title={m.thanks_order_title({ number: o.number })}
		/>
	</div>
</div>

<style>
	.page {
		padding-block: var(--space-10) var(--space-16);
	}
	.status {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		max-width: var(--container-text);
		margin: 0 auto var(--space-12);
		text-align: center;
	}
	.status :global(.orn) {
		color: var(--ui-ornament);
	}
	.status :global(.warn) {
		color: var(--ui-danger);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-3xl);
	}
	.lead {
		margin: 0;
		font-size: var(--fs-lg);
	}
	.eta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		color: var(--ui-text-muted);
	}
	.spinner {
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid var(--ui-ornament);
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 3s;
		}
	}
	.retry {
		display: grid;
		gap: var(--space-4);
		width: 100%;
		text-align: left;
	}
	.err {
		margin: 0;
		color: var(--ui-danger);
		font-size: var(--fs-sm);
	}
	.grid {
		display: grid;
		gap: var(--space-8);
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: minmax(0, 1fr) 26rem;
			align-items: start;
			gap: var(--space-16);
		}
	}
	.details {
		display: grid;
		gap: var(--space-6);
		align-content: start;
		justify-items: start;
	}
	.card {
		width: 100%;
		padding: var(--space-6);
		border: 1px solid var(--ui-border);
		background: var(--ui-surface);
	}
	.card h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--fs-xl);
	}
	.card p {
		margin: 0 0 var(--space-3);
	}
	.muted {
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.gift {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		font-size: var(--fs-sm);
	}
</style>
