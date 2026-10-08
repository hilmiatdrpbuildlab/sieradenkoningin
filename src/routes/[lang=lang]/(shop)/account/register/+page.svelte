<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import AuthShell from '#lib/components/storefront/AuthShell.svelte';
	import Notice from '#lib/components/storefront/Notice.svelte';
	import Turnstile from '#lib/components/storefront/Turnstile.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { errText } from '#lib/components/storefront/account-labels.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	let busy = $state(false);
	const errors = $derived(form && 'errors' in form ? form.errors : null);
	const values = $derived(form && 'values' in form ? form.values : null);
	const L = (p: string) => localizeHref(p, data.lang);
</script>

<Seo title={m.acct_register_title()} description={m.acct_register_lead()} noindex />

{#if form && 'registered' in form}
	<AuthShell title={m.acct_check_inbox_title()}>
		<Notice kind="success">
			<p>{m.acct_register_sent({ email: form.email ?? '' })}</p>
			<p>{m.acct_check_spam()}</p>
		</Notice>
		{#snippet footer()}
			<p><a href={L('/account/login')}>{m.acct_back_to_login()}</a></p>
		{/snippet}
	</AuthShell>
{:else}
	<AuthShell title={m.acct_register_title()} lead={m.acct_register_lead()}>
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
			<div class="two">
				<Field label={m.acct_first_name()} required error={errText(errors, 'firstName')}>
					<Input name="firstName" autocomplete="given-name" maxlength={80} value={values?.firstName ?? ''} />
				</Field>
				<Field label={m.acct_last_name()} required error={errText(errors, 'lastName')}>
					<Input name="lastName" autocomplete="family-name" maxlength={80} value={values?.lastName ?? ''} />
				</Field>
			</div>
			<Field label={m.acct_email()} required error={errText(errors, 'email')}>
				<Input name="email" type="email" autocomplete="email" inputmode="email" value={values?.email ?? ''} />
			</Field>
			<Field label={m.acct_password()} required hint={m.acct_password_hint({ min: 10 })} error={errText(errors, 'password')}>
				<Input name="password" type="password" autocomplete="new-password" minlength={10} />
			</Field>
			<Checkbox name="newsletter" checked={values?.newsletter ?? false} description={m.acct_newsletter_optin_hint()}>
				{m.acct_newsletter_optin()}
			</Checkbox>
			<Turnstile />
			<p class="legal">{m.acct_register_privacy()}</p>
			<Button type="submit" full loading={busy}>{m.acct_register_submit()}</Button>
		</form>
		{#snippet footer()}
			<p>
				{m.acct_have_account()}
				<a href={data.next ? `${L('/account/login')}?next=${encodeURIComponent(data.next)}` : L('/account/login')}>{m.acct_login_link()}</a>
			</p>
		{/snippet}
	</AuthShell>
{/if}

<style>
	.form {
		display: grid;
		gap: var(--space-5);
	}
	.two {
		display: grid;
		gap: var(--space-5);
	}
	@media (min-width: 40rem) {
		.two {
			grid-template-columns: 1fr 1fr;
		}
	}
	.legal {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
</style>
