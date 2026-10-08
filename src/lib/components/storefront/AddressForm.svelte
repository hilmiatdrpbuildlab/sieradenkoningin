<!--
  @component AddressForm — create / edit an address-book entry (P3-02). Posts to `?/save` (works
  without JS); server errors are message keys translated by errText().
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { errText } from './account-labels.ts';
	import type { AddressView } from './account-types.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Nullable<T> = { [K in keyof T]?: T[K] | null };
	interface Props {
		value?: (Nullable<AddressView> & { id?: string; isDefault?: boolean }) | null;
		errors?: Record<string, string[]> | null;
		cancelHref: string;
	}
	let { value = null, errors = null, cancelHref }: Props = $props();
	let busy = $state(false);
	const countries = $derived([
		{ value: 'BE', label: m.acct_country_be() },
		{ value: 'NL', label: m.acct_country_nl() },
		{ value: 'LU', label: m.acct_country_lu() }
	]);
</script>

<form
	method="POST"
	action="?/save"
	class="form"
	novalidate
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	{#if value?.id}<input type="hidden" name="id" value={value.id} />{/if}
	<Field label={m.acct_addr_name()} required error={errText(errors, 'name')}>
		<Input name="name" autocomplete="name" maxlength={120} value={value?.name ?? ''} />
	</Field>
	<Field label={m.acct_addr_company()} optional error={errText(errors, 'company')}>
		<Input name="company" autocomplete="organization" maxlength={120} value={value?.company ?? ''} />
	</Field>
	<Field label={m.acct_addr_line1()} required error={errText(errors, 'line1')}>
		<Input name="line1" autocomplete="address-line1" maxlength={160} value={value?.line1 ?? ''} />
	</Field>
	<Field label={m.acct_addr_line2()} optional error={errText(errors, 'line2')}>
		<Input name="line2" autocomplete="address-line2" maxlength={160} value={value?.line2 ?? ''} />
	</Field>
	<div class="two">
		<Field label={m.acct_addr_postal()} required error={errText(errors, 'postalCode')}>
			<Input name="postalCode" autocomplete="postal-code" maxlength={10} value={value?.postalCode ?? ''} />
		</Field>
		<Field label={m.acct_addr_city()} required error={errText(errors, 'city')}>
			<Input name="city" autocomplete="address-level2" maxlength={80} value={value?.city ?? ''} />
		</Field>
	</div>
	<Field label={m.acct_addr_country()} required error={errText(errors, 'country')}>
		<Select name="country" autocomplete="country" options={countries} value={value?.country ?? 'BE'} />
	</Field>
	<Field label={m.acct_phone()} optional error={errText(errors, 'phone')}>
		<Input name="phone" type="tel" autocomplete="tel" maxlength={30} value={value?.phone ?? ''} />
	</Field>
	<Checkbox name="isDefault" checked={value?.isDefault ?? false}>{m.acct_addr_make_default()}</Checkbox>
	<div class="actions">
		<Button type="submit" loading={busy}>{m.acct_addr_save()}</Button>
		<Button href={cancelHref} variant="ghost">{m.acct_cancel()}</Button>
	</div>
</form>

<style>
	.form {
		display: grid;
		gap: var(--space-5);
		max-width: 36rem;
	}
	.two {
		display: grid;
		gap: var(--space-5);
	}
	@media (min-width: 40rem) {
		.two {
			grid-template-columns: 1fr 2fr;
		}
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
</style>
