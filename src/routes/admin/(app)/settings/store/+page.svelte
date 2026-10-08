<script lang="ts">
	import { enhance } from '$app/forms';
	import { PUBLIC_SITE_URL } from '$app/env/public';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';

	let { data, form } = $props();
	const err = (k: string) => (form && 'errors' in form ? (form.errors as Record<string, string[]>)[k] : undefined);
	const v = (k: string, fallback: string | number | undefined) => (form && 'values' in form ? String((form.values as Record<string, unknown>)[k] ?? '') : (fallback ?? ''));
	const previewUrl = $derived(`${PUBLIC_SITE_URL.replace(/\/$/, '')}/nl?preview=${data.maintenance.bypassToken ?? ''}`);
</script>

<svelte:head><title>Winkelinstellingen — Beheer</title></svelte:head>

<PageHeader title="Winkel" description="Bedrijfsgegevens verschijnen op facturen en in de wettelijke vermeldingen." />

<div class="grid">
	<Card title="Bedrijfsgegevens" id="store">
		<form method="POST" action="?/store" use:enhance={() => async ({ update }) => update({ reset: false })}>
			{#if form?.form === 'store' && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
			<div class="two">
				<Field label="Winkelnaam" required error={err('name')}><Input name="name" value={v('name', data.store.name)} /></Field>
				<Field label="Juridische naam" error={err('legalName')}><Input name="legalName" value={v('legalName', data.store.legalName)} /></Field>
			</div>
			<Field label="Straat en nummer" error={err('street')}><Input name="street" autocomplete="street-address" value={v('street', data.store.street)} /></Field>
			<div class="three">
				<Field label="Postcode" error={err('postalCode')}><Input name="postalCode" value={v('postalCode', data.store.postalCode)} /></Field>
				<Field label="Gemeente" error={err('city')}><Input name="city" value={v('city', data.store.city)} /></Field>
				<Field label="Land" error={err('country')}><Input name="country" maxlength={2} value={v('country', data.store.country)} /></Field>
			</div>
			<div class="two">
				<Field label="Ondernemingsnummer (KBO)" hint="bv. 0123.456.749" error={err('kbo')}><Input name="kbo" value={v('kbo', data.store.kbo)} /></Field>
				<Field label="Btw-nummer" hint="bv. BE0123456749" error={err('vat')}><Input name="vat" value={v('vat', data.store.vat)} /></Field>
			</div>
			<div class="two">
				<Field label="E-mail klantenservice" error={err('email')}><Input name="email" type="email" value={v('email', data.store.email)} /></Field>
				<Field label="Telefoon" error={err('phone')}><Input name="phone" type="tel" value={v('phone', data.store.phone)} /></Field>
			</div>
			<div><Button type="submit" size="sm">Opslaan</Button></div>
		</form>
	</Card>

	<Card title="Algemeen" id="general">
		<form method="POST" action="?/general" use:enhance={() => async ({ update }) => update({ reset: false })}>
			{#if form?.form === 'general' && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
			<Field label="Retourtermijn (dagen)" hint="Wettelijk minimum is 14 dagen (beslissing D4)." error={err('returnDays')}>
				<Input name="returnDays" type="number" min={14} max={365} value={v('returnDays', data.return_days)} />
			</Field>
			<fieldset>
				<legend>Onderhoudsmodus {#if data.maintenance.enabled}<Badge tone="warning">Actief</Badge>{:else}<Badge>Uit</Badge>{/if}</legend>
				<Checkbox name="maintenanceEnabled" checked={data.maintenance.enabled} description="Bezoekers zien een onderhoudspagina (503). Beheerders kunnen de winkel gewoon bekijken.">Winkel tijdelijk sluiten</Checkbox>
				<Field label="Bericht (NL)" optional><Textarea name="maintenanceNl" rows={2} value={data.maintenance.message?.nl ?? ''} /></Field>
				<Field label="Bericht (FR)" optional><Textarea name="maintenanceFr" rows={2} value={data.maintenance.message?.fr ?? ''} /></Field>
				{#if data.maintenance.bypassToken}
					<p class="hint">Preview-link voor genodigden (soft launch): <code>{previewUrl}</code></p>
				{/if}
			</fieldset>
			<div class="actions">
				<Button type="submit" size="sm">Opslaan</Button>
				<Button type="submit" size="sm" variant="ghost" formaction="?/rotateBypass">Nieuwe preview-link</Button>
			</div>
		</form>
	</Card>
</div>

<style>
	.grid {
		display: grid;
		gap: var(--space-6);
		max-width: 52rem;
	}
	form,
	fieldset {
		display: grid;
		gap: var(--space-4);
	}
	fieldset {
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		padding: var(--space-4);
		margin: 0;
	}
	legend {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-inline: var(--space-1);
		font-weight: var(--fw-medium);
	}
	.two,
	.three {
		display: grid;
		gap: var(--space-4);
	}
	@media (min-width: 48rem) {
		.two {
			grid-template-columns: 1fr 1fr;
		}
		.three {
			grid-template-columns: 1fr 2fr 6rem;
		}
	}
	.ok {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-xs);
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		word-break: break-all;
	}
	.actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
