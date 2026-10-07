<!--
  @component QuantityStepper — − [n] + with min/max caps; the input stays a real form field (`name`).
-->
<script lang="ts">
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		value?: number;
		min?: number;
		max?: number;
		name?: string;
		label?: string;
		size?: 'sm' | 'md';
		disabled?: boolean;
		onchange?: (n: number) => void;
	}
	let { value = $bindable(1), min = 1, max = 99, name, label, size = 'md', disabled = false, onchange }: Props = $props();

	function set(n: number) {
		const next = Math.max(min, Math.min(max, Math.round(n) || min));
		if (next === value) return;
		value = next;
		onchange?.(next);
	}
</script>

<div class="qty qty--{size}" role="group" aria-label={label ?? m.ui_quantity()}>
	<button type="button" aria-label={m.ui_decrease()} disabled={disabled || value <= min} onclick={() => set(value - 1)}><Icon name="minus" size={14} /></button>
	<input
		type="number"
		inputmode="numeric"
		{name}
		{min}
		{max}
		{disabled}
		value={value}
		aria-label={label ?? m.ui_quantity()}
		onchange={(e) => set(Number(e.currentTarget.value))}
	/>
	<button type="button" aria-label={m.ui_increase()} disabled={disabled || value >= max} onclick={() => set(value + 1)}><Icon name="plus" size={14} /></button>
</div>

<style>
	.qty {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--ui-border-strong);
		height: 3rem;
	}
	.qty--sm {
		height: 2.75rem;
	}
	button {
		width: 2.75rem;
		height: 100%;
		display: grid;
		place-items: center;
		background: none;
		border: 0;
		color: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: -2px;
	}
	input {
		width: 2.5rem;
		height: 100%;
		border: 0;
		background: transparent;
		text-align: center;
		font: inherit;
		font-size: var(--fs-sm);
		color: inherit;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>
