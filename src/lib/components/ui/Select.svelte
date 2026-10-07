<!--
  @component Select — native <select> (best mobile UX + a11y), styled to match Input.
  <Select name="category" options={[{ value: 'rings', label: 'Ringen' }]} value={x} />
-->
<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { getFieldContext } from './field-context.ts';
	import Icon from './Icon.svelte';

	interface Option {
		value: string;
		label: string;
		disabled?: boolean;
	}
	type Props = Omit<HTMLSelectAttributes, 'value'> & { value?: string | null; options: Option[]; placeholder?: string };

	let { value = $bindable(), options, placeholder, class: className = '', ...rest }: Props = $props();
	const field = getFieldContext();
</script>

<div class="wrap {className}">
	<select
		class="select"
		id={field?.id}
		aria-describedby={field?.describedBy}
		aria-invalid={field?.invalid || undefined}
		required={field?.required || undefined}
		bind:value
		{...rest}
	>
		{#if placeholder !== undefined}<option value="">{placeholder}</option>{/if}
		{#each options as o (o.value)}
			<option value={o.value} disabled={o.disabled}>{o.label}</option>
		{/each}
	</select>
	<Icon name="chevron-down" size={16} class="chev" />
</div>

<style>
	.wrap {
		position: relative;
	}
	.select {
		width: 100%;
		height: 3rem;
		padding: 0 2.25rem 0 var(--space-1);
		font: inherit;
		font-size: var(--fs-base);
		color: var(--ui-text);
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--ui-border-strong);
		border-radius: 0;
		appearance: none;
		cursor: pointer;
	}
	.select:focus-visible {
		outline: none;
		border-bottom-color: var(--ui-border-focus);
		box-shadow: 0 1px 0 0 var(--ui-border-focus);
	}
	.select[aria-invalid='true'] {
		border-bottom-color: var(--ui-danger);
	}
	.wrap :global(.chev) {
		position: absolute;
		right: var(--space-2);
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		color: var(--ui-text-muted);
	}
	:global([data-theme='admin']) .select {
		height: 2.5rem;
		padding-left: var(--space-3);
		font-size: var(--fs-sm);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
	}
	:global([data-theme='admin']) .select:focus-visible {
		border-color: var(--ui-border-focus);
		box-shadow: var(--elev-focus);
	}
</style>
