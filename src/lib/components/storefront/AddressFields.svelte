<!--
  @component AddressFields — name + address block for delivery (prefix "") or billing (prefix
  "billing"). Field ids follow `fieldId()` so the error summary can link to them; autocomplete
  tokens use the shipping/billing sections.
-->
<script lang="ts">
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { checkoutError, fieldId } from './checkout-errors.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		prefix?: '' | 'billing';
		values: Record<string, string>;
		errors: Record<string, string[]>;
		countryOptions: { value: string; label: string }[];
		/** Fires when the postal code changes (pickup-point search default). */
		onpostal?: (code: string) => void;
	}
	let { prefix = '', values, errors, countryOptions, onpostal }: Props = $props();

	const key = (n: string) => (prefix ? `${prefix}${n[0].toUpperCase()}${n.slice(1)}` : n);
	const section = $derived(prefix ? 'billing' : 'shipping');
	const err = (n: string) => {
		const e = errors[key(n)]?.[0];
		return e ? checkoutError(e) : null;
	};
	const val = (n: string) => values[key(n)] ?? '';
</script>

<div class="grid">
	<Field label={m.checkout_first_name()} id={fieldId(key('firstName'))} error={err('firstName')} required>
		<Input name={key('firstName')} value={val('firstName')} autocomplete="{section} given-name" maxlength={60} />
	</Field>
	<Field label={m.checkout_last_name()} id={fieldId(key('lastName'))} error={err('lastName')} required>
		<Input name={key('lastName')} value={val('lastName')} autocomplete="{section} family-name" maxlength={60} />
	</Field>
	<Field label={m.checkout_line1()} id={fieldId(key('line1'))} error={err('line1')} required class="full">
		<Input name={key('line1')} value={val('line1')} autocomplete="{section} address-line1" maxlength={120} />
	</Field>
	<Field label={m.checkout_line2()} id={fieldId(key('line2'))} error={err('line2')} optional class="full">
		<Input name={key('line2')} value={val('line2')} autocomplete="{section} address-line2" maxlength={120} />
	</Field>
	<Field label={m.checkout_postal_code()} id={fieldId(key('postalCode'))} error={err('postalCode')} required>
		<Input
			name={key('postalCode')}
			value={val('postalCode')}
			autocomplete="{section} postal-code"
			inputmode="numeric"
			maxlength={12}
			onchange={(e) => onpostal?.(e.currentTarget.value)}
		/>
	</Field>
	<Field label={m.checkout_city()} id={fieldId(key('city'))} error={err('city')} required>
		<Input name={key('city')} value={val('city')} autocomplete="{section} address-level2" maxlength={80} />
	</Field>
	<Field
		label={m.checkout_country()}
		id={fieldId(key('country'))}
		error={err('country')}
		required
		class="full"
		hint={countryOptions.length === 1 ? m.checkout_country_hint() : undefined}
	>
		<Select
			name={key('country')}
			value={val('country') || countryOptions[0]?.value}
			options={countryOptions}
			autocomplete="{section} country"
		/>
	</Field>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-5) var(--space-4);
	}
	@media (min-width: 40rem) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
		.grid > :global(.full) {
			grid-column: 1 / -1;
		}
	}
</style>
