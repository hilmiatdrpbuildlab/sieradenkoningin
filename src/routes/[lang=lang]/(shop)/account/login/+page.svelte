<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
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
	let busy = $state<'password' | 'magic' | null>(null);

	const pw = $derived(form?.form === 'password' ? form : null);
	const mg = $derived(form?.form === 'magic' ? form : null);
	const pwErrors = $derived(pw && 'errors' in pw ? pw.errors : null);
	const mgErrors = $derived(mg && 'errors' in mg ? mg.errors : null);
	const L = (p: string) => localizeHref(p, data.lang);
	const withNext = (p: string) => (data.next ? `${L(p)}?next=${encodeURIComponent(data.next)}` : L(p));

	/** A successful login reloads the page fully so cart + wishlist state is fetched for the account. */
	const submit =
		(which: 'password' | 'magic'): SubmitFunction =>
		() => {
			busy = which;
			return async ({ result, update }) => {
				if (result.type === 'redirect') {
					window.location.assign(result.location);
					return;
				}
				await update({ reset: false });
				busy = null;
			};
		};
</script>

<Seo title={m.acct_login_title()} description={m.acct_login_lead()} noindex />

<AuthShell title={m.acct_login_title()} lead={m.acct_login_lead()}>
	{#if data.deleted}<Notice kind="success"><p>{m.acct_deleted_notice()}</p></Notice>{/if}
	{#if data.loggedOut}<Notice kind="success"><p>{m.acct_logged_out()}</p></Notice>{/if}

	<form method="POST" action="?/password" use:enhance={submit('password')} class="form" novalidate>
		{#if data.next}<input type="hidden" name="next" value={data.next} />{/if}
		{#if pw && 'error' in pw}
			<Notice kind="error">
				<p>
					{pw.error === 'rate' ? m.acct_err_rate() : pw.error === 'unverified' ? m.acct_err_unverified() : m.acct_err_login_invalid()}
				</p>
			</Notice>
		{/if}
		<Field label={m.acct_email()} required error={errText(pwErrors, 'email')}>
			<Input name="email" type="email" autocomplete="email" inputmode="email" value={pw?.values?.email ?? ''} />
		</Field>
		<Field label={m.acct_password()} required error={errText(pwErrors, 'password')}>
			<Input name="password" type="password" autocomplete="current-password" />
		</Field>
		<p class="aside"><a href={L('/account/forgot')}>{m.acct_forgot_link()}</a></p>
		<Button type="submit" full loading={busy === 'password'}>{m.acct_login_submit()}</Button>
	</form>

	<div class="or" role="separator"><span>{m.acct_or()}</span></div>

	<section aria-labelledby="magic-title" class="form">
		<h2 id="magic-title">{m.acct_magic_title()}</h2>
		<p class="muted">{m.acct_magic_lead()}</p>
		{#if mg && 'sent' in mg}
			<Notice kind="success"><p>{m.acct_magic_sent()}</p></Notice>
		{:else}
			<form method="POST" action="?/magic" use:enhance={submit('magic')} class="form" novalidate>
				{#if data.next}<input type="hidden" name="next" value={data.next} />{/if}
				{#if mg && 'error' in mg}
					<Notice kind="error"><p>{mg.error === 'rate' ? m.acct_err_rate() : m.acct_err_captcha()}</p></Notice>
				{/if}
				<Field label={m.acct_email()} required error={errText(mgErrors, 'email')}>
					<Input name="email" type="email" autocomplete="email" inputmode="email" value={mg?.values?.email ?? ''} />
				</Field>
				<Turnstile />
				<Button type="submit" variant="outline" full loading={busy === 'magic'}>{m.acct_magic_submit()}</Button>
			</form>
		{/if}
	</section>

	{#snippet footer()}
		<p>{m.acct_no_account()} <a href={withNext('/account/register')}>{m.acct_register_link()}</a></p>
	{/snippet}
</AuthShell>

<style>
	.form {
		display: grid;
		gap: var(--space-5);
	}
	h2 {
		margin: 0;
		font-size: var(--fs-xl);
	}
	.muted {
		margin: 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.aside {
		margin: calc(-1 * var(--space-2)) 0 0;
		text-align: right;
		font-size: var(--fs-sm);
	}
	.aside a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--ui-accent);
	}
	.or {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	.or::before,
	.or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--ui-border);
	}
</style>
