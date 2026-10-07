<!--
  @component Radio — a radio group rendered as a fieldset with a legend (keyboard: arrow keys, native).
  `variant="card"` renders selectable cards (shipping & payment methods); `variant="swatch"` renders
  metal swatches (PDP).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Option {
		value: string;
		label: string;
		description?: string;
		meta?: string;
		disabled?: boolean;
		swatch?: string;
	}
	interface Props {
		name: string;
		legend: string;
		hideLegend?: boolean;
		options: Option[];
		value?: string | null;
		required?: boolean;
		error?: string | null;
		variant?: 'list' | 'card' | 'swatch';
		onchange?: (value: string) => void;
		extra?: Snippet<[Option]>;
	}
	let { name, legend, hideLegend = false, options, value = $bindable(), required = false, error, variant = 'list', onchange, extra }: Props = $props();
	const uid = $props.id();
</script>

<fieldset class="group group--{variant}" aria-describedby={error ? `rg${uid}-err` : undefined}>
	<legend class:sr-only={hideLegend}>{legend}</legend>
	<div class="options">
		{#each options as o (o.value)}
			<label class="opt" class:disabled={o.disabled}>
				<input
					type="radio"
					{name}
					value={o.value}
					bind:group={value}
					disabled={o.disabled}
					{required}
					onchange={() => onchange?.(o.value)}
				/>
				{#if variant === 'swatch'}
					<span class="swatch" style:background={o.swatch} aria-hidden="true"></span>
					<span class="sw-label">{o.label}</span>
				{:else}
					<span class="dot" aria-hidden="true"></span>
					<span class="body">
						<span class="lbl">{o.label}</span>
						{#if o.description}<small>{o.description}</small>{/if}
					</span>
					{#if o.meta}<span class="meta">{o.meta}</span>{/if}
				{/if}
				{#if extra}{@render extra(o)}{/if}
			</label>
		{/each}
	</div>
	{#if error}<p id="rg{uid}-err" class="err" role="alert">{error}</p>{/if}
</fieldset>

<style>
	.group {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-3);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.options {
		display: grid;
		gap: var(--space-2);
	}
	.opt {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-3);
		min-height: 2.75rem;
		cursor: pointer;
		font-size: var(--fs-sm);
	}
	.opt.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	input {
		position: absolute;
		opacity: 0;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		cursor: inherit;
	}
	.dot {
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		border: 1px solid var(--ui-border-strong);
		background: var(--ui-surface);
		display: grid;
		place-items: center;
	}
	.dot::after {
		content: '';
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--ui-action);
		transform: scale(0);
		transition: transform var(--dur-fast) var(--motion-out);
	}
	input:checked ~ .dot::after {
		transform: scale(1);
	}
	input:checked ~ .dot {
		border-color: var(--ui-action);
	}
	input:focus-visible ~ .dot,
	input:focus-visible ~ .swatch {
		box-shadow: var(--elev-focus);
	}
	.body {
		display: grid;
		gap: 2px;
	}
	.body small {
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
	}
	.meta {
		font-weight: var(--fw-medium);
	}

	/* cards */
	.group--card .opt {
		padding: var(--space-4);
		border: 1px solid var(--ui-border);
		background: var(--ui-surface);
		transition: border-color var(--dur-fast);
	}
	.group--card .opt:has(input:checked) {
		border-color: var(--ui-text);
		box-shadow: inset 0 0 0 1px var(--ui-text);
	}

	/* swatches */
	.group--swatch .options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.group--swatch .opt {
		grid-template-columns: auto auto;
		padding: 0 var(--space-4) 0 var(--space-2);
		border: 1px solid var(--ui-border);
		min-height: 2.75rem;
	}
	.group--swatch .opt:has(input:checked) {
		border-color: var(--ui-text);
		box-shadow: inset 0 0 0 1px var(--ui-text);
	}
	.swatch {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		box-shadow: 0 0 0 1px var(--ui-border-strong);
	}
	.sw-label {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.err {
		margin: var(--space-2) 0 0;
		color: var(--ui-danger);
		font-size: var(--fs-xs);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
