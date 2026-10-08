<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import I18nInput from '#lib/components/admin/I18nInput.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';

	let { data, form } = $props();
	const errs = (id: string) =>
		form && form.form === id && 'errors' in form ? (form.errors as Record<string, string[]>) : {};
	const vals = (id: string) =>
		form && form.form === id && 'values' in form ? (form.values as Record<string, string>) : null;
	const pair = (v: Record<string, string> | null, k: string, fallback?: { nl: string; fr?: string }) =>
		v ? { nl: v[`${k}_nl`] ?? '', fr: v[`${k}_fr`] ?? '' } : fallback;
	const keep =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
	const GROUP_LABELS: Record<string, string> = {
		general: 'Algemeen',
		orders: 'Bestellen',
		shipping: 'Verzending',
		returns: 'Retourneren',
		products: 'Producten & onderhoud',
		payment: 'Betalen'
	};
</script>

<svelte:head><title>FAQ — Beheer</title></svelte:head>

<PageHeader
	title="Veelgestelde vragen"
	description="Verschijnen op /nl/faq en /fr/faq (met FAQ-structuurdata voor Google) en in FAQ-blokken. Antwoorden ondersteunen markdown."
/>

<datalist id="faq-groups">
	{#each data.suggestions as g (g)}<option value={g}>{GROUP_LABELS[g] ?? g}</option>{/each}
</datalist>

<div class="stack">
	{#if data.canWrite}
		<Card title="Nieuwe vraag" id="faq-new">
			<form
				method="POST"
				action="?/create"
				use:enhance={() =>
					async ({ update, result }) =>
						update({ reset: result.type === 'success' })}
			>
				{#if form?.form === 'new' && 'saved' in form}<p class="ok" role="status">Vraag toegevoegd.</p>{/if}
				<Field label="Groep" hint="bv. orders, shipping, returns, products" error={errs('new').group}>
					<Input name="group" list="faq-groups" value={vals('new')?.group ?? 'general'} />
				</Field>
				<I18nInput
					label="Vraag"
					name="question"
					value={pair(vals('new'), 'question')}
					required
					error={errs('new').question_nl}
				/>
				<I18nInput
					label="Antwoord"
					name="answer"
					value={pair(vals('new'), 'answer')}
					multiline
					rows={4}
					required
					error={errs('new').answer_nl}
				/>
				<div><Button type="submit" size="sm" icon="plus">Toevoegen</Button></div>
			</form>
		</Card>
	{/if}

	{#each data.groups as g (g.group)}
		<Card title="{GROUP_LABELS[g.group] ?? g.group} ({g.items.length})" description="Groep: {g.group}">
			<ol class="list">
				{#each g.items as f, i (f.id)}
					{@const e = errs(f.id)}
					<li>
						<details open={Object.keys(e).length > 0}>
							<summary>
								<span class="q">{f.question.nl}</span>
								{#if !f.question.fr || !f.answer.fr}<Badge tone="warning">FR ontbreekt</Badge>{/if}
							</summary>
							<form method="POST" action="?/update" use:enhance={keep}>
								<input type="hidden" name="id" value={f.id} />
								{#if form?.form === f.id && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
								<fieldset disabled={!data.canWrite}>
									<Field label="Groep" error={e.group}
										><Input name="group" list="faq-groups" value={vals(f.id)?.group ?? f.group} /></Field
									>
									<I18nInput
										label="Vraag"
										name="question"
										value={pair(vals(f.id), 'question', f.question)}
										required
										error={e.question_nl}
									/>
									<I18nInput
										label="Antwoord"
										name="answer"
										value={pair(vals(f.id), 'answer', f.answer)}
										multiline
										rows={4}
										required
										error={e.answer_nl}
									/>
									<div class="actions">
										<Button type="submit" size="sm">Opslaan</Button>
										<Button
											type="submit"
											size="sm"
											variant="ghost"
											icon="arrow-up"
											formaction="?/move"
											name="dir"
											value="up"
											disabled={i === 0}>Omhoog</Button
										>
										<Button
											type="submit"
											size="sm"
											variant="ghost"
											icon="arrow-down"
											formaction="?/move"
											name="dir"
											value="down"
											disabled={i === g.items.length - 1}>Omlaag</Button
										>
										<Button
											type="submit"
											size="sm"
											variant="ghost"
											icon="trash"
											formaction="?/delete"
											onclick={(ev) => {
												if (!confirm('Deze vraag verwijderen?')) ev.preventDefault();
											}}>Verwijderen</Button
										>
									</div>
								</fieldset>
							</form>
						</details>
					</li>
				{/each}
			</ol>
		</Card>
	{:else}
		<p>Nog geen vragen.</p>
	{/each}
</div>

<style>
	.stack {
		display: grid;
		gap: var(--space-6);
		max-width: 60rem;
	}
	form,
	fieldset {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	details {
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
	}
	summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	summary:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.q {
		flex: 1;
		min-width: 0;
	}
	details form {
		padding: var(--space-3) var(--space-3) var(--space-4);
		border-top: 1px solid var(--ui-border);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.ok {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-xs);
	}
</style>
