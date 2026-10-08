<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import I18nInput from '#lib/components/admin/I18nInput.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { toBrusselsInput, formatBrussels } from '#lib/utils/brussels-time.ts';

	let { data, form } = $props();
	const a = $derived(data.announcement);
	const values = $derived((form && 'values' in form ? form.values : null) as Record<string, string> | null);
	const errors = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string[]>);
	const live = $derived(
		!!a && (!a.from || new Date(a.from) <= new Date()) && (!a.until || new Date(a.until) > new Date())
	);
</script>

<svelte:head><title>Aankondiging — Beheer</title></svelte:head>

<PageHeader
	title="Aankondigingsbalk"
	description="De smalle bordeaux balk bovenaan de winkel, bv. “Gratis verzending vanaf € 50”. Leeg = geen balk."
>
	{#snippet meta()}
		{#if !a}<Badge>Uit</Badge>{:else if live}<Badge tone="success">Nu zichtbaar</Badge>{:else}<Badge tone="warning"
				>Gepland / verlopen</Badge
			>{/if}
	{/snippet}
</PageHeader>

<Card title="Aankondiging">
	<form
		method="POST"
		action="?/save"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		{#if form && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
		<fieldset disabled={!data.canWrite}>
			<I18nInput
				label="Tekst"
				name="text"
				value={values ? { nl: values.text_nl, fr: values.text_fr } : a?.text}
				maxlength={140}
				error={errors.text_nl}
				errorFr={errors.text_fr}
				hint="Kort houden: max. 140 tekens."
			/>
			<Field
				label="Link"
				optional
				hint="Volledig pad, bv. /nl/collectie/nieuw. Eén link voor beide talen."
				error={errors.href}
			>
				<Input name="href" value={values?.href ?? a?.href ?? ''} />
			</Field>
			<div class="two">
				<Field label="Zichtbaar vanaf" optional hint="Brusselse tijd" error={errors.from}>
					<Input type="datetime-local" name="from" value={values?.from ?? toBrusselsInput(a?.from)} />
				</Field>
				<Field label="Zichtbaar tot" optional hint="Brusselse tijd" error={errors.until}>
					<Input type="datetime-local" name="until" value={values?.until ?? toBrusselsInput(a?.until)} />
				</Field>
			</div>
			{#if a?.from || a?.until}
				<p class="hint">
					Huidige planning: {a.from ? formatBrussels(a.from) : 'meteen'} → {a.until
						? formatBrussels(a.until)
						: 'onbeperkt'}
				</p>
			{/if}
			<div><Button type="submit" size="sm">Opslaan</Button></div>
		</fieldset>
	</form>
</Card>

<style>
	form,
	fieldset {
		display: grid;
		gap: var(--space-4);
		max-width: 48rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.two {
		display: grid;
		gap: var(--space-4);
	}
	@media (min-width: 48rem) {
		.two {
			grid-template-columns: 1fr 1fr;
		}
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.ok {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-xs);
	}
</style>
