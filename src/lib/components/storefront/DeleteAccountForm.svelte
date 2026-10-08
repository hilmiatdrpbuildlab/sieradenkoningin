<!--
  @component DeleteAccountForm — the irreversible "delete my account" form (P3-02): password +
  explicit confirmation checkbox, posts to `?/delete`. Rendered inside a dialog (JS) or inline (no JS).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Notice from './Notice.svelte';
	import { errText } from './account-labels.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		errors?: Record<string, string[]> | null;
		rate?: boolean;
		cancelHref?: string;
		oncancel?: () => void;
	}
	let { errors = null, rate = false, cancelHref, oncancel }: Props = $props();
	let busy = $state(false);
</script>

<form
	method="POST"
	action="?/delete"
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
	<Notice kind="error">
		<p>{m.acct_delete_warning()}</p>
		<p>{m.acct_delete_keeps_invoices()}</p>
	</Notice>
	{#if rate}<Notice kind="error"><p>{m.acct_err_rate()}</p></Notice>{/if}
	<Field label={m.acct_password()} required error={errText(errors, 'password')}>
		<Input name="password" type="password" autocomplete="current-password" />
	</Field>
	<Field label={m.acct_delete_confirm_label()} hideLabel error={errText(errors, 'confirm')}>
		<Checkbox name="confirm">{m.acct_delete_confirm()}</Checkbox>
	</Field>
	<div class="actions">
		<Button type="submit" variant="danger" loading={busy}>{m.acct_delete_submit()}</Button>
		{#if oncancel}
			<Button type="button" variant="ghost" onclick={oncancel}>{m.acct_cancel()}</Button>
		{:else if cancelHref}
			<Button href={cancelHref} variant="ghost">{m.acct_cancel()}</Button>
		{/if}
	</div>
</form>

<style>
	.form {
		display: grid;
		gap: var(--space-5);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
</style>
