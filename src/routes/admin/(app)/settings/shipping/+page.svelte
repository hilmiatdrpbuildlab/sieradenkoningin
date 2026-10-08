<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { centsToInput } from '#lib/utils/format.ts';

	let { data, form } = $props();
	const errs = $derived(form && 'errors' in form ? (form.errors as Record<string, string[]>) : {});
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
	const methodLabel = { home: 'Thuislevering', pickup: 'Afhaalpunt / pakjesautomaat' } as const;
</script>

<svelte:head><title>Verzending — Beheer</title></svelte:head>

<PageHeader title="Verzending" description="Wijzigingen gelden meteen voor winkelmandjes en de kassa. Prijzen incl. btw.">
	{#snippet meta()}Levering naar: {#each data.shipping.shipToCountries as c (c)}<Badge>{c}</Badge>{/each}{/snippet}
</PageHeader>

<div class="grid">
	<Card title="Algemeen">
		<form method="POST" action="?/general" use:enhance={keep}>
			{#if form?.form === 'general' && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
			<Field label="Gratis verzending vanaf" hint="Standaarddrempel (beslissing D9). Een tarief kan een eigen drempel hebben." error={errs.freeFrom}>
				<Input name="freeFrom" inputmode="decimal" prefix="€" value={centsToInput(data.shipping.freeFrom)} />
			</Field>
			<div class="two">
				<Field label="Uiterste besteltijd" hint="Uur (0–23) voor 'morgen in huis'" error={errs.cutoffHour}><Input name="cutoffHour" type="number" min={0} max={23} value={String(data.shipping.cutoffHour)} /></Field>
				<Field label="Levertijd (werkdagen)" error={errs.deliveryDays}><Input name="deliveryDays" type="number" min={1} max={10} value={String(data.shipping.deliveryDays)} /></Field>
			</div>
			<div><Button type="submit" size="sm">Opslaan</Button></div>
		</form>
	</Card>

	{#each data.zones as z (z.id)}
		<Card title={z.name} description="Landen: {z.countries.join(', ')}">
			{#snippet actions()}
				<form method="POST" action="?/zone" use:enhance={keep}>
					<input type="hidden" name="id" value={z.id} />
					{#if z.active}<Badge tone="success">Actief</Badge>{:else}<Badge>Niet actief</Badge>{/if}
					<Button type="submit" size="sm" variant="ghost">{z.active ? 'Uitschakelen' : 'Inschakelen'}</Button>
				</form>
			{/snippet}
			{#if form?.form === z.id && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
			{#each z.rates as r (r.id)}
				<form method="POST" action="?/rate" use:enhance={keep} class="rate">
					<input type="hidden" name="id" value={r.id} />
					<p class="method">{methodLabel[r.method]}</p>
					{#if form?.form === r.id && 'error' in form}<p class="err" role="alert">{form.error}</p>{/if}
					{#if form?.form === r.id && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
					<div class="three">
						<Field label="Prijs"><Input name="price" inputmode="decimal" prefix="€" value={centsToInput(r.price)} /></Field>
						<Field label="Gratis vanaf" optional><Input name="freeFrom" inputmode="decimal" prefix="€" value={centsToInput(r.freeFrom)} /></Field>
						<Field label="Vervoerder"><Input name="carrier" value={r.carrier} /></Field>
					</div>
					<label class="check"><input type="checkbox" name="active" checked={r.active} /> Aangeboden in de kassa</label>
					<div><Button type="submit" size="sm" variant="outline">Tarief opslaan</Button></div>
				</form>
			{/each}
		</Card>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		gap: var(--space-6);
		max-width: 52rem;
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
	.rate {
		padding-top: var(--space-4);
		border-top: 1px solid var(--ui-border);
	}
	.rate:first-of-type {
		border-top: 0;
		padding-top: 0;
	}
	.method {
		margin: 0;
		font-weight: var(--fw-semibold);
	}
	.two,
	.three {
		display: grid;
		gap: var(--space-3);
	}
	@media (min-width: 48rem) {
		.two {
			grid-template-columns: 1fr 1fr;
		}
		.three {
			grid-template-columns: 1fr 1fr 1fr;
		}
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		font-size: var(--fs-sm);
	}
	.check input {
		accent-color: var(--ui-action);
		width: 1rem;
		height: 1rem;
	}
	:global(.card) form:has(> input[name='id']) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ok,
	.err {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--r-xs);
	}
	.ok {
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.err {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
</style>
