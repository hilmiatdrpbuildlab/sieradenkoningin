<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '#lib/components/admin/AuthCard.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Inloggen — Beheer</title></svelte:head>

<AuthCard title="Inloggen" subtitle="Log in met je beheerdersaccount. Daarna vragen we je verificatiecode.">
	<form
		method="POST"
		action="?next={encodeURIComponent(data.next)}"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}
		<Field label="E-mailadres" required><Input name="email" type="email" autocomplete="username" value={form?.email ?? ''} autofocus /></Field>
		<Field label="Wachtwoord" required><Input name="password" type="password" autocomplete="current-password" /></Field>
		<Button type="submit" full loading={busy}>Inloggen</Button>
	</form>
</AuthCard>

<style>
	form {
		display: grid;
		gap: var(--space-4);
	}
	.err {
		margin: 0;
		padding: var(--space-3);
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
		border-radius: var(--r-xs);
		font-size: var(--fs-sm);
	}
</style>
