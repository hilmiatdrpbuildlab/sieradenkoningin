<!-- Checkout (P2-04): form left, sticky order summary right (collapsible <details> on phones). -->
<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import CheckoutForm from '#lib/components/storefront/CheckoutForm.svelte';
	import OrderSummary from '#lib/components/storefront/OrderSummary.svelte';
	import PaymentMarks from '#lib/components/storefront/PaymentMarks.svelte';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	// svelte-ignore state_referenced_locally (initial value only; CheckoutForm keeps it in sync after enhanced submits)
	let method = $state<'home' | 'pickup'>(form?.values?.shippingMethod === 'pickup' ? 'pickup' : 'home');

	const quote = $derived(data.quotes[method]);
	const lines = $derived(
		data.cart.lines.map((l) => ({
			name: l.name,
			variantLabel: l.variantLabel,
			qty: l.quantity,
			lineTotal: l.unitPrice * l.quantity,
			imageKey: l.imageKey,
			giftWrap: l.giftWrap
		}))
	);
</script>

<Seo title={m.checkout_title()} noindex />

<div class="container-lux py-8 lg:py-12">
	<h1 class="title">{m.checkout_title()}</h1>
	<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-16">
		<div class="lg:order-2 lg:sticky lg:top-28">
			<OrderSummary
				{lines}
				totals={quote}
				discountCode={data.discountCode}
				lang={data.lang}
				editHref={localizeHref('/cart', data.lang)}
			/>
			<div class="mt-4 hidden lg:block"><PaymentMarks methods={data.paymentMethods} /></div>
		</div>
		<div class="lg:order-1">
			<CheckoutForm
				lang={data.lang}
				{form}
				prefill={data.prefill}
				loggedIn={data.loggedIn}
				countryOptions={data.countryOptions}
				paymentMethods={data.paymentMethods}
				quotes={data.quotes}
				termsHref={data.termsHref}
				giftWrapDefault={data.cart.lines.some((l) => l.giftWrap)}
				bind:method
			/>
		</div>
	</div>
</div>

<style>
	.title {
		font-size: var(--fs-3xl);
		margin: 0 0 var(--space-8);
	}
</style>
