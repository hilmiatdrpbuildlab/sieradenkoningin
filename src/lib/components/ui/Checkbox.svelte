<!--
  @component Checkbox — native input with a custom box; the whole row is the 44px hit target.
  <Checkbox name="terms" required>Ik ga akkoord met de <a href=…>voorwaarden</a></Checkbox>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { getFieldContext } from './field-context.ts';

	type Props = Omit<HTMLInputAttributes, 'type' | 'children'> & { checked?: boolean; children?: Snippet; description?: string };
	let { checked = $bindable(false), children, description, class: className = '', id, ...rest }: Props = $props();
	const field = getFieldContext();
	const uid = $props.id();
	const inputId = $derived(id ?? field?.id ?? `cb${uid}`);
</script>

<label class="check {className}" for={inputId}>
	<input
		type="checkbox"
		id={inputId}
		aria-describedby={field?.describedBy}
		aria-invalid={field?.invalid || undefined}
		bind:checked
		{...rest}
	/>
	<span class="box" aria-hidden="true"></span>
	<span class="text">
		{#if children}{@render children()}{/if}
		{#if description}<small>{description}</small>{/if}
	</span>
</label>

<style>
	.check {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: var(--space-3);
		min-height: 2.75rem;
		padding-block: var(--space-2);
		cursor: pointer;
		font-size: var(--fs-sm);
		line-height: var(--lh-snug);
	}
	input {
		position: absolute;
		opacity: 0;
		width: 1.25rem;
		height: 1.25rem;
		margin: var(--space-2) 0 0;
	}
	.box {
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 1px;
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		display: grid;
		place-items: center;
		transition: background-color var(--dur-fast), border-color var(--dur-fast);
	}
	.box::after {
		content: '';
		width: 0.375rem;
		height: 0.7rem;
		border: solid var(--ui-action-text);
		border-width: 0 1.5px 1.5px 0;
		transform: rotate(45deg) translate(-1px, -1px);
		opacity: 0;
	}
	input:checked + .box {
		background: var(--ui-action);
		border-color: var(--ui-action);
	}
	input:checked + .box::after {
		opacity: 1;
	}
	input:focus-visible + .box {
		box-shadow: var(--elev-focus);
	}
	input[aria-invalid='true'] + .box {
		border-color: var(--ui-danger);
	}
	input:disabled + .box {
		opacity: 0.5;
	}
	.text {
		display: grid;
		gap: 2px;
	}
	small {
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
	}
	.text :global(a) {
		color: var(--ui-accent);
	}
</style>
