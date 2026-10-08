<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import I18nInput from '#lib/components/admin/I18nInput.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Juridische teksten — Beheer</title></svelte:head>

<PageHeader
	title="Juridische teksten"
	description="Plak hier de teksten die je jurist aanlevert (NL en FR). Zolang een tekst leeg is, toont de winkel een duidelijke plaatshouder. Schrijf zelf geen juridische tekst."
/>

<div class="notice" role="note">
	<strong>Wettelijke vermeldingen</strong> (bedrijfsnaam, adres, KBO, btw, e-mail, telefoon) worden automatisch ingevuld
	uit
	<a href="/admin/settings/store">Instellingen → Winkel</a>. Het modelformulier voor herroeping (PDF en online) is de
	wettelijke modeltekst en wordt automatisch aangevuld met je bedrijfsgegevens.
</div>

<div class="stack">
	{#each data.slots as s (s.key)}
		<Card title={s.label} id="legal-{s.key}">
			{#snippet actions()}
				{#if !s.body.nl}<Badge tone="warning">Plaatshouder</Badge>
				{:else if s.reviewed}<Badge tone="success">Nagelezen</Badge>
				{:else}<Badge tone="warning">Niet nagelezen</Badge>{/if}
				{#if s.body.nl && !s.body.fr}<Badge tone="warning">FR ontbreekt</Badge>{/if}
			{/snippet}
			<form
				method="POST"
				action="?/save"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="slot" value={s.key} />
				{#if form?.slot === s.key && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
				{#if form?.slot === s.key && 'error' in form}<p class="bad" role="alert">{form.error}</p>{/if}
				<I18nInput
					label="Tekst"
					name="body"
					value={s.body}
					multiline
					rows={12}
					hint="Markdown: ## kop, ### subkop, **vet**, lijstjes met - of 1., [link](https://…)."
				/>
				<Checkbox
					name="reviewed"
					checked={s.reviewed}
					description="Vink pas aan als de Belgische jurist deze NL- én FR-versie heeft goedgekeurd."
					>Nagelezen door jurist</Checkbox
				>
				<div class="row">
					<Button type="submit" size="sm">Opslaan</Button>
					{#if s.paths}
						<a href={s.paths.nl} target="_blank" rel="noopener">Bekijk NL</a>
						<a href={s.paths.fr} target="_blank" rel="noopener">Bekijk FR</a>
					{/if}
					{#if s.key === 'withdrawal'}
						<a href="/api/legal/withdrawal-form.pdf?lang=nl" target="_blank" rel="noopener">Modelformulier PDF (NL)</a>
						<a href="/api/legal/withdrawal-form.pdf?lang=fr" target="_blank" rel="noopener">PDF (FR)</a>
					{/if}
				</div>
			</form>
		</Card>
	{/each}
</div>

<style>
	.stack {
		display: grid;
		gap: var(--space-6);
		max-width: 60rem;
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
	.notice {
		max-width: 60rem;
		margin-bottom: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--ui-info-bg);
		color: var(--ui-text);
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
	}
	.notice a,
	.row a {
		color: var(--ui-accent);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4);
		font-size: var(--fs-sm);
	}
	.ok,
	.bad {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--r-xs);
		font-size: var(--fs-sm);
	}
	.ok {
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.bad {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
</style>
