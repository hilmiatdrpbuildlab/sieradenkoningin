<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import Notice from '#lib/components/storefront/Notice.svelte';
	import DeleteAccountForm from '#lib/components/storefront/DeleteAccountForm.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { errText } from '#lib/components/storefront/account-labels.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	let busy = $state<string | null>(null);
	let deleteOpen = $state(false);

	const p = $derived(data.profile);
	const sec = $derived(form?.section ?? null);
	const errorsFor = (s: string) => (form && form.section === s && 'errors' in form ? (form.errors as Record<string, string[]>) : null);
	const pv = $derived(form?.section === 'profile' && 'values' in form ? form.values : null);
	const base = $derived(localizeHref('/account/settings', data.lang));
	const inlineDelete = $derived(data.showDelete || (sec === 'delete' && !deleteOpen));

	const submit =
		(name: string): SubmitFunction =>
		() => {
			busy = name;
			return async ({ update }) => {
				await update({ reset: name !== 'profile' });
				busy = null;
			};
		};
</script>

<Seo title={m.acct_settings_title()} noindex />

<h1>{m.acct_settings_title()}</h1>

<section aria-labelledby="profile-title" class="panel">
	<h2 id="profile-title">{m.acct_profile_title()}</h2>
	{#if sec === 'profile' && form && 'saved' in form}<Notice kind="success"><p>{m.acct_profile_saved()}</p></Notice>{/if}
	<form method="POST" action="?/profile" class="form" novalidate use:enhance={submit('profile')}>
		<div class="two">
			<Field label={m.acct_first_name()} required error={errText(errorsFor('profile'), 'firstName')}>
				<Input name="firstName" autocomplete="given-name" maxlength={80} value={pv?.firstName ?? p.firstName} />
			</Field>
			<Field label={m.acct_last_name()} required error={errText(errorsFor('profile'), 'lastName')}>
				<Input name="lastName" autocomplete="family-name" maxlength={80} value={pv?.lastName ?? p.lastName} />
			</Field>
		</div>
		<Field label={m.acct_email()} hint={m.acct_email_fixed_hint()}>
			<Input type="email" value={p.email} readonly />
		</Field>
		<Field label={m.acct_phone()} optional error={errText(errorsFor('profile'), 'phone')}>
			<Input name="phone" type="tel" autocomplete="tel" maxlength={30} value={pv?.phone ?? p.phone} />
		</Field>
		<Field label={m.acct_language()} hint={m.acct_language_hint()}>
			<Select
				name="locale"
				options={[
					{ value: 'nl', label: 'Nederlands' },
					{ value: 'fr', label: 'Français' }
				]}
				value={pv?.locale ?? p.locale}
			/>
		</Field>
		<div><Button type="submit" loading={busy === 'profile'}>{m.acct_save()}</Button></div>
	</form>
</section>

<section aria-labelledby="pw-title" class="panel">
	<h2 id="pw-title">{m.acct_password_title()}</h2>
	{#if sec === 'password' && form && 'saved' in form}<Notice kind="success"><p>{m.acct_password_saved()}</p></Notice>{/if}
	{#if sec === 'password' && form && 'error' in form}<Notice kind="error"><p>{m.acct_err_rate()}</p></Notice>{/if}
	<form method="POST" action="?/password" class="form" novalidate use:enhance={submit('password')}>
		<Field label={m.acct_current_password()} required error={errText(errorsFor('password'), 'current')}>
			<Input name="current" type="password" autocomplete="current-password" />
		</Field>
		<Field label={m.acct_new_password()} required hint={m.acct_password_hint({ min: 10 })} error={errText(errorsFor('password'), 'password')}>
			<Input name="password" type="password" autocomplete="new-password" minlength={10} />
		</Field>
		<Field label={m.acct_confirm_password()} required error={errText(errorsFor('password'), 'confirm')}>
			<Input name="confirm" type="password" autocomplete="new-password" />
		</Field>
		<div><Button type="submit" loading={busy === 'password'}>{m.acct_password_submit()}</Button></div>
	</form>
</section>

<section aria-labelledby="nl-title" class="panel">
	<h2 id="nl-title">{m.acct_newsletter_title()}</h2>
	{#if sec === 'newsletter' && form && 'subscribed' in form}
		<Notice kind="success"><p>{form.subscribed === 'already' ? m.acct_newsletter_status_on() : m.acct_newsletter_check()}</p></Notice>
	{:else if sec === 'newsletter' && form && 'unsubscribed' in form}
		<Notice kind="success"><p>{m.acct_newsletter_unsubscribed()}</p></Notice>
	{:else if sec === 'newsletter' && form && 'error' in form}
		<Notice kind="error"><p>{m.acct_err_generic()}</p></Notice>
	{/if}
	<p class="muted">
		{p.newsletter === 'confirmed'
			? m.acct_newsletter_status_on()
			: p.newsletter === 'pending'
				? m.acct_newsletter_status_pending()
				: m.acct_newsletter_status_off()}
	</p>
	<form method="POST" action="?/newsletter" use:enhance={submit('newsletter')}>
		{#if p.newsletter === 'confirmed'}
			<input type="hidden" name="subscribe" value="0" />
			<Button type="submit" variant="outline" loading={busy === 'newsletter'}>{m.acct_newsletter_unsubscribe()}</Button>
		{:else}
			<input type="hidden" name="subscribe" value="1" />
			<Button type="submit" variant="outline" loading={busy === 'newsletter'}>
				{p.newsletter === 'pending' ? m.acct_newsletter_resend() : m.acct_newsletter_subscribe()}
			</Button>
		{/if}
	</form>
</section>

<section aria-labelledby="privacy-title" class="panel">
	<h2 id="privacy-title">{m.acct_privacy_title()}</h2>
	<div class="privacy">
		<div>
			<h3>{m.acct_export_title()}</h3>
			<p class="muted">{m.acct_export_text()}</p>
			<a class="link" href={localizeHref('/account/export', data.lang)} download data-sveltekit-reload>
				<Icon name="download" size={18} />{m.acct_export_button()}
			</a>
		</div>
		<div>
			<h3>{m.acct_delete_title()}</h3>
			<p class="muted">{m.acct_delete_text()}</p>
			{#if inlineDelete}
				<DeleteAccountForm
					errors={errorsFor('delete')}
					rate={sec === 'delete' && !!form && 'error' in form}
					cancelHref={base}
				/>
			{:else}
				<a
					class="link danger"
					href="{base}?delete"
					onclick={(e) => {
						e.preventDefault();
						deleteOpen = true;
					}}
				>
					<Icon name="trash" size={18} />{m.acct_delete_open()}
				</a>
			{/if}
		</div>
	</div>
</section>

<Dialog bind:open={deleteOpen} title={m.acct_delete_dialog_title()} size="sm">
	<DeleteAccountForm
		errors={errorsFor('delete')}
		rate={sec === 'delete' && !!form && 'error' in form}
		oncancel={() => (deleteOpen = false)}
	/>
</Dialog>

<style>
	h1 {
		margin: 0 0 var(--space-6);
		font-size: var(--fs-3xl);
	}
	h2 {
		margin: 0;
		font-size: var(--fs-xl);
	}
	h3 {
		margin: 0 0 var(--space-2);
		font-size: var(--fs-lg);
	}
	.panel {
		display: grid;
		gap: var(--space-5);
		padding-block: var(--space-8);
		border-top: 1px solid var(--ui-border);
	}
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
			grid-template-columns: 1fr 1fr;
		}
	}
	.muted {
		margin: 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.privacy {
		display: grid;
		gap: var(--space-8);
	}
	@media (min-width: 48rem) {
		.privacy {
			grid-template-columns: 1fr 1fr;
		}
	}
	.link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		margin-top: var(--space-2);
		color: var(--ui-accent);
	}
	.link.danger {
		color: var(--ui-danger);
	}
</style>
