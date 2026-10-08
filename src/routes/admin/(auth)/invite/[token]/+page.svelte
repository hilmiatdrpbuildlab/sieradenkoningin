<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '#lib/components/admin/AuthCard.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Account activeren — Beheer</title></svelte:head>

<AuthCard title="Welkom, {data.name}" subtitle="Kies een wachtwoord voor {data.email}. Daarna stel je tweestapsverificatie in.">
	<form method="POST" use:enhance>
		{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}
		<Field label="Nieuw wachtwoord" hint="Minstens 10 tekens" required><Input name="password" type="password" autocomplete="new-password" /></Field>
		<Field label="Herhaal wachtwoord" required><Input name="confirm" type="password" autocomplete="new-password" /></Field>
		<Button type="submit" full>Account activeren</Button>
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
