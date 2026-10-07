<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import AuthCard from '#lib/components/admin/AuthCard.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	let { data, form } = $props();
	const next = $derived(data.next && data.next.startsWith('/admin') ? data.next : '/admin');
</script>

<svelte:head><title>Tweestapsverificatie instellen — Beheer</title></svelte:head>

{#if form?.recoveryCodes}
	<AuthCard title="Bewaar je herstelcodes" subtitle="Elke code werkt één keer, als je je authenticator-app niet bij de hand hebt. Ze worden maar één keer getoond.">
		<ol class="codes" data-testid="recovery-codes">
			{#each form.recoveryCodes as c (c)}<li><code>{c}</code></li>{/each}
		</ol>
		<Button href={next} full>Ik heb ze bewaard — naar het dashboard</Button>
	</AuthCard>
{:else if data.done}
	<AuthCard title="Tweestapsverificatie actief" subtitle="Je account is beveiligd.">
		<Button href={next} full>Naar het dashboard</Button>
	</AuthCard>
{:else}
	<AuthCard title="Tweestapsverificatie instellen" subtitle="Verplicht voor elk beheerdersaccount. Scan de QR-code met een authenticator-app (bv. Google Authenticator, 1Password).">
		<div class="qr" aria-hidden="true">{@html data.qr}</div>
		<p class="manual">Lukt scannen niet? Voer deze sleutel handmatig in voor <strong>{data.email}</strong>:<br /><code data-testid="totp-secret">{data.secret}</code></p>
		<form
			method="POST"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') await applyAction(result);
					else await update();
				}}
		>
			{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}
			<Field label="Code uit je app" hint="6 cijfers"><Input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength={7} required autofocus /></Field>
			<Button type="submit" full>Bevestigen</Button>
		</form>
	</AuthCard>
{/if}

<style>
	.qr {
		width: 12rem;
		margin-inline: auto;
		background: var(--sk-white);
		padding: var(--space-2);
		border-radius: var(--r-sm);
	}
	.manual {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	code {
		font-size: var(--fs-sm);
		letter-spacing: 0.08em;
		color: var(--ui-text);
	}
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
	.codes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2) var(--space-6);
		margin: 0;
		padding: var(--space-4) var(--space-4) var(--space-4) var(--space-8);
		background: var(--ui-surface-sunken);
		border-radius: var(--r-sm);
	}
</style>
