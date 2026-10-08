<!--
  @component CheckoutForm — Contact → Delivery → Shipping → Billing → Gift → Payment → Terms → submit.
  A plain POST form (works without JS up to the payment redirect), progressively enhanced:
  failed submits keep the values, move focus to the error summary and announce it.
  Native validation is off (`novalidate`) so every error goes through the same accessible summary.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import AddressFields from './AddressFields.svelte';
	import ShippingOptions from './ShippingOptions.svelte';
	import PaymentMethods from './PaymentMethods.svelte';
	import ErrorSummary from './ErrorSummary.svelte';
	import { checkoutError, fieldId, fieldLabel } from './checkout-errors.ts';
	import { promoMessage } from './promo-messages.ts';
	import { CHECKOUT_FIELD_ORDER, GIFT_MESSAGE_MAX } from '#lib/schemas/checkout.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Quote = { shipping: number; available: boolean };
	interface FormState {
		values?: Record<string, string>;
		errors?: Record<string, string[]>;
		formError?: string;
		shortages?: { name: string; available: number }[];
		discountReason?: string;
		points?: { id: string; name: string; street: string; postalCode: string; city: string }[];
		searched?: boolean;
	}
	interface Props {
		lang: 'nl' | 'fr';
		form: FormState | null | undefined;
		prefill: { email: string; firstName: string; lastName: string };
		loggedIn: boolean;
		countryOptions: { value: string; label: string }[];
		paymentMethods: string[];
		quotes: { home: Quote; pickup: Quote };
		termsHref: string;
		giftWrapDefault: boolean;
		method?: 'home' | 'pickup';
	}
	let {
		lang,
		form,
		prefill,
		loggedIn,
		countryOptions,
		paymentMethods,
		quotes,
		termsHref,
		giftWrapDefault,
		method = $bindable('home')
	}: Props = $props();

	const values = $derived<Record<string, string>>({
		email: prefill.email,
		firstName: prefill.firstName,
		lastName: prefill.lastName,
		country: countryOptions[0]?.value ?? 'BE',
		billingCountry: countryOptions[0]?.value ?? 'BE',
		...(form?.values ?? {})
	});
	const errors = $derived(form?.errors ?? {});
	const err = (k: string) => (errors[k]?.[0] ? checkoutError(errors[k][0]) : null);

	// svelte-ignore state_referenced_locally
	let payment = $state(form?.values?.paymentMethod ?? paymentMethods[0]);
	// svelte-ignore state_referenced_locally
	let billingSame = $state(form?.values ? form.values.billingSame === 'on' : true);
	// svelte-ignore state_referenced_locally
	let giftWrap = $state(form?.values ? form.values.giftWrap === 'on' : giftWrapDefault);
	// svelte-ignore state_referenced_locally
	let giftMessage = $state(form?.values?.giftMessage ?? '');
	// svelte-ignore state_referenced_locally
	let postal = $state(form?.values?.spPostalCode || form?.values?.postalCode || '');
	let submitting = $state(false);
	let summary: ReturnType<typeof ErrorSummary> | undefined = $state();

	$effect.pre(() => {
		if (form?.values?.shippingMethod === 'home' || form?.values?.shippingMethod === 'pickup')
			method = form.values.shippingMethod;
	});

	const summaryItems = $derived(
		[...CHECKOUT_FIELD_ORDER, 'spPostalCode']
			.filter((k) => errors[k]?.length)
			.map((k) => ({ id: fieldId(k), label: fieldLabel(k), message: checkoutError(errors[k][0]) }))
	);
	const formErrorText = $derived.by(() => {
		switch (form?.formError) {
			case 'stock':
				return m.checkout_error_stock();
			case 'unavailable':
				return m.checkout_error_unavailable();
			case 'discount':
				return `${m.checkout_error_discount()} ${promoMessage(form.discountReason, null, lang)}`;
			case 'shipping':
				return m.checkout_error_shipping();
			case 'payment':
				return m.checkout_error_payment_provider();
			default:
				return null;
		}
	});
	const hasErrors = $derived(summaryItems.length > 0 || !!formErrorText);

	onMount(() => {
		if (hasErrors) summary?.focus();
	});

	const nextHref = $derived(
		`${localizeHref('/account/login', lang)}?next=${encodeURIComponent(localizeHref('/checkout', lang))}`
	);
</script>

<form
	method="POST"
	action="?/place"
	class="form"
	novalidate
	use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			if (
				result.type === 'redirect' &&
				/^https?:/.test(result.location) &&
				new URL(result.location).origin !== location.origin
			) {
				location.href = result.location; // external payment page (Mollie)
				return;
			}
			await update({ reset: false });
			submitting = false;
			if (result.type === 'failure' && !(result.data as FormState | undefined)?.searched) {
				await tick();
				summary?.focus();
			}
		};
	}}
>
	<ErrorSummary
		bind:this={summary}
		title={m.checkout_error_summary_title()}
		items={summaryItems}
		text={formErrorText}
	/>
	{#if form?.formError === 'stock' && form.shortages?.length}
		<ul class="shortages" aria-label={m.checkout_error_stock()}>
			{#each form.shortages as s (s.name)}
				<li>{s.name} — {s.available > 0 ? m.checkout_stock_left({ n: s.available }) : m.checkout_stock_none()}</li>
			{/each}
		</ul>
	{/if}

	<section aria-labelledby="co-h-contact">
		<div class="head">
			<h2 id="co-h-contact"><span class="step" aria-hidden="true">1</span>{m.checkout_contact_title()}</h2>
			{#if !loggedIn}<p class="login">{m.checkout_have_account()} <a href={nextHref}>{m.checkout_login()}</a></p>{/if}
		</div>
		<div class="grid2">
			<Field
				label={m.checkout_email()}
				id={fieldId('email')}
				error={err('email')}
				required
				hint={m.checkout_email_hint()}
			>
				<Input type="email" name="email" value={values.email} autocomplete="email" inputmode="email" maxlength={254} />
			</Field>
			<Field
				label={m.checkout_phone()}
				id={fieldId('phone')}
				error={err('phone')}
				optional
				hint={m.checkout_phone_hint()}
			>
				<Input type="tel" name="phone" value={values.phone ?? ''} autocomplete="tel" maxlength={30} />
			</Field>
		</div>
		{#if !loggedIn}<p class="guest">{m.checkout_guest_note()}</p>{/if}
	</section>

	<section aria-labelledby="co-h-delivery">
		<h2 id="co-h-delivery"><span class="step" aria-hidden="true">2</span>{m.checkout_delivery_title()}</h2>
		<AddressFields {values} {errors} {countryOptions} onpostal={(c) => (postal = postal || c)} />
	</section>

	<section aria-labelledby="co-h-shipping">
		<h2 id="co-h-shipping"><span class="step" aria-hidden="true">3</span>{m.checkout_shipping_title()}</h2>
		<ShippingOptions
			bind:method
			prices={{ home: quotes.home, pickup: quotes.pickup }}
			{lang}
			country={values.country}
			postalCode={postal}
			points={form?.points ?? []}
			selectedPoint={values.servicePointId ?? ''}
			searched={!!form?.searched}
			{errors}
		/>
	</section>

	<section aria-labelledby="co-h-billing">
		<h2 id="co-h-billing"><span class="step" aria-hidden="true">4</span>{m.checkout_billing_title()}</h2>
		<Checkbox name="billingSame" bind:checked={billingSame}>{m.checkout_billing_same()}</Checkbox>
		<div class="billing" class:hidden={billingSame}>
			<AddressFields prefix="billing" {values} {errors} {countryOptions} />
		</div>
		<div class="grid2 company">
			<Field label={m.checkout_company()} id={fieldId('company')} error={err('company')} optional>
				<Input name="company" value={values.company ?? ''} autocomplete="organization" maxlength={120} />
			</Field>
			<Field
				label={m.checkout_vat_number()}
				id={fieldId('vatNumber')}
				error={err('vatNumber')}
				optional
				hint={m.checkout_vat_hint()}
			>
				<Input
					name="vatNumber"
					value={values.vatNumber ?? ''}
					autocomplete="off"
					maxlength={30}
					placeholder="BE0123456749"
				/>
			</Field>
		</div>
	</section>

	<section aria-labelledby="co-h-gift">
		<h2 id="co-h-gift"><span class="step" aria-hidden="true">5</span>{m.checkout_gift_title()}</h2>
		<Checkbox name="giftWrap" bind:checked={giftWrap} description={m.checkout_gift_wrap_hint()}
			>{m.checkout_gift_wrap()}</Checkbox
		>
		<Field
			label={m.checkout_gift_message()}
			id={fieldId('giftMessage')}
			error={err('giftMessage')}
			optional
			hint={m.checkout_gift_message_hint({ max: GIFT_MESSAGE_MAX })}
		>
			<Textarea name="giftMessage" bind:value={giftMessage} maxlength={GIFT_MESSAGE_MAX} counter rows={3} />
		</Field>
	</section>

	<section aria-labelledby="co-h-payment">
		<h2 id="co-h-payment"><span class="step" aria-hidden="true">6</span>{m.checkout_payment_title()}</h2>
		<PaymentMethods methods={paymentMethods} bind:value={payment} error={errors.paymentMethod?.[0] ?? null} />
		<p class="secure"><Icon name="lock" size={14} /> {m.checkout_payment_secure()}</p>
	</section>

	<section class="confirm" aria-label={m.checkout_confirm_title()}>
		<Checkbox
			name="terms"
			id={fieldId('terms')}
			aria-invalid={errors.terms ? true : undefined}
			aria-describedby={errors.terms ? 'co-terms-error' : undefined}
		>
			<span
				>{m.checkout_terms_prefix()}
				<a href={termsHref} target="_blank" rel="noopener">{m.checkout_terms_link()}</a
				>{m.checkout_terms_suffix()}</span
			>
		</Checkbox>
		{#if err('terms')}<p id="co-terms-error" class="err" role="alert">
				<Icon name="alert" size={14} />
				{err('terms')}
			</p>{/if}
		<p class="withdrawal">{m.checkout_withdrawal_note()}</p>
		<Button type="submit" full size="lg" loading={submitting}>{m.checkout_pay_obligation()}</Button>
	</section>
</form>

<style>
	.form {
		display: grid;
		gap: var(--space-10);
	}
	section {
		display: grid;
		gap: var(--space-5);
		min-width: 0;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}
	h2 {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: 0;
		font-size: var(--fs-xl);
	}
	.step {
		display: inline-grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-full);
		font-family: var(--ff-body);
		font-size: var(--fs-xs);
	}
	.login,
	.guest,
	.withdrawal {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.login a {
		color: var(--ui-text);
		min-height: 2.75rem;
		text-underline-offset: 3px;
	}
	.grid2 {
		display: grid;
		gap: var(--space-5) var(--space-4);
	}
	@media (min-width: 40rem) {
		.grid2 {
			grid-template-columns: 1fr 1fr;
		}
	}
	/* Without JS the CSS :has() toggle hides the billing block; with JS the class does. */
	.form:has(:global(input[name='billingSame']:checked)) .billing,
	.billing.hidden {
		display: none;
	}
	.company {
		padding-top: var(--space-2);
	}
	.secure {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.confirm {
		padding-top: var(--space-6);
		border-top: 1px solid var(--ui-border);
	}
	.err {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-danger);
	}
	.shortages {
		margin: calc(-1 * var(--space-6)) 0 0;
		padding: 0 var(--space-5) var(--space-2) var(--space-10);
		font-size: var(--fs-sm);
	}
</style>
