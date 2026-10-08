<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import AuthShell from '#lib/components/storefront/AuthShell.svelte';
	import Notice from '#lib/components/storefront/Notice.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { errText } from '#lib/components/storefront/account-labels.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	let busy = $state(false);
	const errors = $derived(form && 'errors' in form ? form.errors : null);
	const invalid = $derived(!data.valid || (form && 'expired' in form));
</script>

<Seo title={m.acct_reset_title()} noindex />

<AuthShell title={m.acct_reset_title()} lead={invalid ? undefined : m.acct_reset_lead()}>
	{#if invalid}
		<Notice kind="error"><p>{m.acct_link_invalid()}</p></Notice>
		<a class="again" href={localizeHref('/account/forgot', data.lang)}>{m.acct_request_new_link()}</a>
	{:else}
		<form
			method="POST"
			class="form"
			novalidate
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					if (result.type === 'redirect') return window.location.assign(result.location);
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<Field label={m.acct_new_password()} required hint={m.acct_password_hint({ min: 10 })} error={errText(errors, 'password')}>
				<Input name="password" type="password" autocomplete="new-password" minlength={10} />
			</Field>
			<Field label={m.acct_confirm_password()} required error={errText(errors, 'confirm')}>
				<Input name="confirm" type="password" autocomplete="new-password" />
			</Field>
			<Button type="submit" full loading={busy}>{m.acct_reset_submit()}</Button>
		</form>
	{/if}
</AuthShell>

<style>
	.form {
		display: grid;
		gap: var(--space-5);
	}
	.again {
		display: inline-flex;
		align-items: center;
		justify-self: center;
		min-height: 2.75rem;
		color: var(--ui-accent);
	}
</style>
