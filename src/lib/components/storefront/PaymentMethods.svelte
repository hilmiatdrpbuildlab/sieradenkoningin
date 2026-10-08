<!--
  @component PaymentMethods — payment method choice (Radio card variant), Bancontact first (§4.7).
  The chosen method is preselected at Mollie.
-->
<script lang="ts">
	import Radio from '#lib/components/ui/Radio.svelte';
	import { checkoutError } from './checkout-errors.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		methods: string[];
		value?: string;
		error?: string | null;
	}
	let { methods, value = $bindable(), error = null }: Props = $props();

	const label = (k: string) =>
		({
			bancontact: 'Bancontact',
			creditcard: m.checkout_method_creditcard(),
			applepay: 'Apple Pay',
			googlepay: 'Google Pay',
			kbc: 'KBC/CBC',
			belfius: 'Belfius'
		})[k] ?? k;
	const description = (k: string) =>
		k === 'bancontact' ? m.checkout_method_bancontact_hint() : k === 'creditcard' ? 'Visa · Mastercard' : undefined;
	const options = $derived(methods.map((k) => ({ value: k, label: label(k), description: description(k) })));
</script>

<Radio
	name="paymentMethod"
	legend={m.checkout_payment_title()}
	hideLegend
	variant="card"
	{options}
	bind:value
	error={error ? checkoutError(error) : null}
/>
