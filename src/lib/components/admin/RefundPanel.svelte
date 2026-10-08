<!--
  @component RefundPanel — full / partial refund form (P3-06): by amount or by lines + quantities,
  optional restock and reason. A <details> disclosure (works without JS); with JS the estimated
  amount for the chosen lines updates live. The server recomputes and validates everything.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { centsToInput, formatPrice } from '#lib/utils/format.ts';

	interface Line {
		id: string;
		sku: string;
		name: { nl: string };
		refundableQty: number;
		unitRefund: number;
	}
	interface Props {
		lines: Line[];
		refundable: number;
		captured: number;
		shippingTotal: number;
		error?: string | null;
		errors?: Record<string, string[]> | null;
	}
	let { lines, refundable, captured, shippingTotal, error = null, errors = null }: Props = $props();

	let mode = $state<'amount' | 'lines'>('lines');
	let qty = $state<Record<string, number>>({});
	let shipping = $state(false);
	let busy = $state(false);
	const estimate = $derived(
		Math.min(
			refundable,
			lines.reduce((s, l) => s + (qty[l.id] ?? 0) * l.unitRefund, 0) + (shipping ? shippingTotal : 0)
		)
	);
	const uid = $props.id();
	// The disclosure stays under the user's control; a failed submit (errors) re-opens it.
	let open = $state(false);
	$effect(() => {
		if (error || errors) open = true;
	});
</script>

<details class="panel" bind:open>
	<summary>Terugbetaling maken</summary>
	<form
		method="POST"
		action="?/refund"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update();
			};
		}}
	>
		<p class="hint">Nog terug te betalen: <strong>{formatPrice(refundable)}</strong> van {formatPrice(captured)}.</p>
		{#if error}<p class="err" role="alert">{error}</p>{/if}

		<fieldset>
			<legend>Hoe?</legend>
			<label class="radio"><input type="radio" name="mode" value="lines" bind:group={mode} /> Per artikel</label>
			<label class="radio"><input type="radio" name="mode" value="amount" bind:group={mode} /> Vrij bedrag</label>
		</fieldset>

		<div class="section" class:dim={mode !== 'lines'}>
			<table>
				<caption class="sr-only">Aantallen om terug te betalen</caption>
				<thead><tr><th scope="col">Artikel</th><th scope="col" class="num">Aantal</th></tr></thead>
				<tbody>
					{#each lines as l (l.id)}
						<tr>
							<td
								><label for="{uid}-{l.id}">{l.name.nl}</label><span class="sub"
									>{l.sku} · {formatPrice(l.unitRefund)} / st.</span
								></td
							>
							<td class="num">
								<input
									id="{uid}-{l.id}"
									type="number"
									name="qty_{l.id}"
									min="0"
									max={l.refundableQty}
									step="1"
									inputmode="numeric"
									disabled={l.refundableQty === 0}
									bind:value={qty[l.id]}
									aria-describedby="{uid}-max-{l.id}"
								/>
								<span class="sub" id="{uid}-max-{l.id}">max {l.refundableQty}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if shippingTotal}
				<label class="check"
					><input type="checkbox" name="shipping" value="on" bind:checked={shipping} /> Verzendkosten ({formatPrice(
						shippingTotal
					)}) ook terugbetalen</label
				>
			{/if}
			{#if errors?.lines}<p class="err">{errors.lines[0]}</p>{/if}
			{#if mode === 'lines' && estimate > 0}<p class="hint">
					Terug te betalen: <strong>{formatPrice(estimate)}</strong>
				</p>{/if}
		</div>

		<div class="section" class:dim={mode !== 'amount'}>
			<label class="field">
				<span>Bedrag (€)</span>
				<input
					name="amount"
					inputmode="decimal"
					placeholder={centsToInput(refundable)}
					aria-invalid={!!errors?.amount}
					aria-describedby={errors?.amount ? `${uid}-amount-err` : undefined}
				/>
			</label>
			{#if errors?.amount}<p class="err" id="{uid}-amount-err">{errors.amount[0]}</p>{/if}
			<p class="hint">Volledige terugbetaling: vul {centsToInput(refundable)} in.</p>
		</div>

		<label class="check"
			><input type="checkbox" name="restock" value="on" /> Teruggestuurde artikelen terug in voorraad zetten</label
		>
		<label class="field"
			><span>Reden (intern)</span><input
				name="reason"
				maxlength="500"
				placeholder="bv. retour binnen bedenktijd"
			/></label
		>

		<div>
			<Button type="submit" variant="danger" size="sm" icon="return" loading={busy} disabled={busy || refundable <= 0}
				>Terugbetalen</Button
			>
		</div>
	</form>
</details>

<style>
	.panel {
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
	}
	summary {
		cursor: pointer;
		padding: var(--space-3) var(--space-4);
		font-weight: var(--fw-medium);
		font-size: var(--fs-sm);
		min-height: 2.75rem;
		display: flex;
		align-items: center;
	}
	summary:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	form {
		display: grid;
		gap: var(--space-4);
		padding: 0 var(--space-4) var(--space-4);
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}
	legend {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		margin-bottom: var(--space-1);
	}
	.radio,
	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		min-height: 2.75rem;
	}
	input[type='radio'],
	input[type='checkbox'] {
		accent-color: var(--ui-action);
		width: 1rem;
		height: 1rem;
	}
	.section {
		display: grid;
		gap: var(--space-2);
		transition: opacity var(--dur-fast);
	}
	.dim {
		opacity: 0.5;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th {
		text-align: left;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		font-weight: var(--fw-medium);
		padding-bottom: var(--space-1);
	}
	td {
		padding: var(--space-2) 0;
		border-top: 1px solid var(--ui-border);
		vertical-align: top;
	}
	.num {
		text-align: right;
	}
	td input {
		width: 4.5rem;
	}
	.field {
		display: grid;
		gap: var(--space-1);
		font-size: var(--fs-sm);
	}
	.field span {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	input:not([type='radio'], [type='checkbox']) {
		height: 2.5rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
		font-variant-numeric: tabular-nums;
	}
	input:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 1px;
	}
	.sub {
		display: block;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.hint {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.err {
		margin: 0;
		color: var(--ui-danger);
		font-size: var(--fs-sm);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
