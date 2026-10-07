<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import AuthCard from '#lib/components/admin/AuthCard.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	let { form } = $props();
</script>

<svelte:head><title>Verificatiecode — Beheer</title></svelte:head>

<AuthCard title="Verificatiecode" subtitle="Voer de 6-cijferige code uit je authenticator-app in, of een van je herstelcodes.">
	<form method="POST" action="?next={encodeURIComponent(page.url.searchParams.get('next') ?? '')}" use:enhance>
		{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}
		<Field label="Code"><Input name="code" inputmode="text" autocomplete="one-time-code" maxlength={9} required autofocus /></Field>
		<Button type="submit" full>Verifiëren</Button>
	</form>
	<form method="POST" action="/admin/logout"><Button type="submit" variant="link" size="sm">Annuleren en uitloggen</Button></form>
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
