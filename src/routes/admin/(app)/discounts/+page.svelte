<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { centsToInput, formatDateTime, formatPrice } from '#lib/utils/format.ts';
	import { dateToBrusselsLocal } from '#lib/schemas/discount.ts';

	let { data, form } = $props();
	type D = (typeof data.discounts)[number];
	let editing = $state<D | null>(null);
	let type = $state<'percent' | 'amount' | 'free_shipping'>('percent');
	let formEl: HTMLFormElement | undefined = $state();

	const errs = $derived(form && 'errors' in form ? (form.errors as Record<string, string[]>) : {});
	const vals = $derived(form && 'values' in form ? (form.values as Record<string, string>) : null);
	const v = (k: string, fallback: string) => vals?.[k] ?? fallback;

	function edit(d: D | null) {
		editing = d;
		type = d?.type ?? 'percent';
		formEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	const now = new Date();
	function statusOf(d: D): { tone: 'success' | 'neutral' | 'warning' | 'info'; label: string } {
		if (!d.active) return { tone: 'neutral', label: 'Inactief' };
		if (d.startsAt && new Date(d.startsAt) > now) return { tone: 'info', label: 'Gepland' };
		if (d.endsAt && new Date(d.endsAt) <= now) return { tone: 'neutral', label: 'Verlopen' };
		if (d.usageLimit && d.uses >= d.usageLimit) return { tone: 'warning', label: 'Opgebruikt' };
		return { tone: 'success', label: 'Actief' };
	}
	const describe = (d: D) => (d.type === 'percent' ? `${d.value}% korting` : d.type === 'amount' ? `${formatPrice(d.value)} korting` : 'Gratis verzending');
</script>

<svelte:head><title>Kortingscodes — Beheer</title></svelte:head>

<PageHeader title="Kortingscodes" description="Klanten kunnen één code per bestelling gebruiken. Gebruik telt pas mee na betaling.">
	{#snippet actions()}{#if data.canWrite}<Button size="sm" icon="plus" onclick={() => edit(null)}>Nieuwe code</Button>{/if}{/snippet}
</PageHeader>

{#if form && 'deleteError' in form}<p class="err" role="alert">{form.deleteError}</p>{/if}
{#if form && 'saved' in form}<p class="ok" role="status">Code {form.saved} opgeslagen.</p>{/if}

<div class="grid">
	<Card title="Alle codes" padded={false}>
		{#if data.discounts.length}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable, WCAG 2.1.1) -->
			<div class="scroller" tabindex="0" role="region" aria-label="Kortingscodes">
				<table>
					<thead><tr><th scope="col">Code</th><th scope="col">Korting</th><th scope="col">Status</th><th scope="col" class="num">Gebruikt</th><th scope="col" class="num">Korting gegeven</th><th scope="col" class="num">Omzet</th><th scope="col"><span class="sr-only">Acties</span></th></tr></thead>
					<tbody>
						{#each data.discounts as d (d.id)}
							{@const s = statusOf(d)}
							<tr>
								<th scope="row"><code>{d.code}</code></th>
								<td>{describe(d)}{#if d.minSubtotal}<br /><small>vanaf {formatPrice(d.minSubtotal)}</small>{/if}{#if d.endsAt}<br /><small>tot {formatDateTime(d.endsAt)}</small>{/if}</td>
								<td><Badge tone={s.tone}>{s.label}</Badge></td>
								<td class="num">{d.uses}{#if d.usageLimit} / {d.usageLimit}{/if}</td>
								<td class="num">{formatPrice(d.discounted)}</td>
								<td class="num">{formatPrice(d.revenue)}</td>
								<td class="actions">
									{#if data.canWrite}
										<Button size="sm" variant="ghost" onclick={() => edit(d)}>Bewerken</Button>
										<form method="POST" action="?/toggle" use:enhance><input type="hidden" name="id" value={d.id} /><Button type="submit" size="sm" variant="ghost">{d.active ? 'Deactiveren' : 'Activeren'}</Button></form>
										{#if d.uses === 0}<form method="POST" action="?/delete" use:enhance><input type="hidden" name="id" value={d.id} /><Button type="submit" size="sm" variant="ghost" icon="trash" aria-label="Verwijder {d.code}" /></form>{/if}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<EmptyState icon="percent" title="Nog geen kortingscodes" text="Maak een code aan voor een actie, bv. VALENTIJN15." />
		{/if}
	</Card>

	{#if data.canWrite}
		<Card title={editing ? `Code ${editing.code} bewerken` : 'Nieuwe kortingscode'}>
			<form bind:this={formEl} method="POST" action="?/save" use:enhance={() => async ({ update, result }) => { await update(); if (result.type === 'success') edit(null); }}>
				{#key editing?.id}
					<input type="hidden" name="id" value={editing?.id ?? ''} />
					<Field label="Code" required hint="Hoofdletters, cijfers, - en _" error={errs.code}><Input name="code" value={v('code', editing?.code ?? '')} autocapitalize="characters" /></Field>
					<Field label="Type" error={errs.type}>
						<Select name="type" bind:value={type} options={[{ value: 'percent', label: 'Percentage' }, { value: 'amount', label: 'Vast bedrag' }, { value: 'free_shipping', label: 'Gratis verzending' }]} />
					</Field>
					{#if type === 'percent'}<Field label="Percentage" error={errs.percent}><Input name="percent" type="number" min={1} max={100} suffix="%" value={v('percent', editing?.type === 'percent' ? String(editing.value) : '')} /></Field>{/if}
					{#if type === 'amount'}<Field label="Bedrag" error={errs.amount}><Input name="amount" inputmode="decimal" prefix="€" value={v('amount', editing?.type === 'amount' ? centsToInput(editing.value) : '')} /></Field>{/if}
					<Field label="Minimum bestelbedrag" optional error={errs.minSubtotal}><Input name="minSubtotal" inputmode="decimal" prefix="€" value={v('minSubtotal', centsToInput(editing?.minSubtotal))} /></Field>
					<div class="two">
						<Field label="Geldig vanaf" optional hint="Belgische tijd" error={errs.startsAt}><Input name="startsAt" type="datetime-local" value={v('startsAt', dateToBrusselsLocal(editing?.startsAt))} /></Field>
						<Field label="Geldig tot" optional error={errs.endsAt}><Input name="endsAt" type="datetime-local" value={v('endsAt', dateToBrusselsLocal(editing?.endsAt))} /></Field>
					</div>
					<div class="two">
						<Field label="Max. aantal keer" optional error={errs.usageLimit}><Input name="usageLimit" type="number" min={1} value={v('usageLimit', editing?.usageLimit ? String(editing.usageLimit) : '')} /></Field>
						<Field label="Max. per klant" optional error={errs.perCustomerLimit}><Input name="perCustomerLimit" type="number" min={1} value={v('perCustomerLimit', editing?.perCustomerLimit ? String(editing.perCustomerLimit) : '')} /></Field>
					</div>
					<Checkbox name="active" checked={editing ? editing.active : true}>Actief</Checkbox>
					<div class="row">
						<Button type="submit" size="sm">Opslaan</Button>
						{#if editing}<Button size="sm" variant="ghost" onclick={() => edit(null)}>Annuleren</Button>{/if}
					</div>
				{/key}
			</form>
		</Card>
	{/if}
</div>

<style>
	.grid {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 80rem) {
		.grid {
			grid-template-columns: 2fr 1fr;
			align-items: start;
		}
	}
	.scroller {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th,
	td {
		text-align: left;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--ui-border);
		vertical-align: middle;
	}
	thead th {
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
		background: var(--ui-surface-sunken);
		white-space: nowrap;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	small {
		color: var(--ui-text-muted);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-1);
		white-space: nowrap;
	}
	.actions form {
		display: inline;
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
	.ok,
	.err {
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
