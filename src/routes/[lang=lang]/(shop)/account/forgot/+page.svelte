<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import AuthShell from '#lib/components/storefront/AuthShell.svelte';
	import Notice from '#lib/components/storefront/Notice.svelte';
	import Turnstile from '#lib/components/storefront/Turnstile.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { errText } from '#lib/components/storefront/account-labels.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	let busy = $state(false);
	const errors = $derived(form && 'errors' in form ? form.errors : null);
</script>

<Seo title={m.acct_forgot_title()} description={m.acct_forgot_lead()} noindex />

<AuthShell title={m.acct_forgot_title()} lead={m.acct_forgot_lead()}>
	{#if form && 'sent' in form}
		<Notice kind="success">
			<p>{m.acct_forgot_sent({ email: form.email ?? '' })}</p>
			<p>{m.acct_check_spam()}</p>
		</Notice>
	{:else}
		{#if data.expired}<Notice kind="error"><p>{m.acct_link_invalid()}</p></Notice>{/if}
		<form
			method="POST"
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
			{#if form && 'error' in form}
				<Notice kind="error"><p>{form.error === 'rate' ? m.acct_err_rate() : m.acct_err_captcha()}</p></Notice>
			{/if}
			<Field label={m.acct_email()} required error={errText(errors, 'email')}>
				<Input name="email" type="email" autocomplete="email" inputmode="email" value={form && 'values' in form ? (form.values?.email ?? '') : ''} />
			</Field>
			<Turnstile />
			<Button type="submit" full loading={busy}>{m.acct_forgot_submit()}</Button>
		</form>
	{/if}
	{#snippet footer()}
		<p><a href={localizeHref('/account/login', data.lang)}>{m.acct_back_to_login()}</a></p>
	{/snippet}
</AuthShell>

<style>
	.form {
		display: grid;
		gap: var(--space-5);
	}
</style>
