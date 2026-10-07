<!--
  @component Textarea — with optional live character counter (`maxlength` + `counter`).
-->
<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { getFieldContext } from './field-context.ts';

	type Props = Omit<HTMLTextareaAttributes, 'value'> & { value?: string | null; counter?: boolean };
	let { value = $bindable(''), rows = 4, maxlength, counter = false, class: className = '', ...rest }: Props = $props();
	const field = getFieldContext();
	const length = $derived((value ?? '').length);
</script>

<div class="wrap {className}">
	<textarea
		class="textarea"
		id={field?.id}
		aria-describedby={field?.describedBy}
		aria-invalid={field?.invalid || undefined}
		required={field?.required || undefined}
		{rows}
		{maxlength}
		bind:value
		{...rest}
	></textarea>
	{#if counter && maxlength}<span class="count" aria-live="polite">{length}/{maxlength}</span>{/if}
</div>

<style>
	.wrap {
		position: relative;
		display: grid;
	}
	.textarea {
		width: 100%;
		padding: var(--space-3);
		font: inherit;
		font-size: var(--fs-base);
		line-height: var(--lh-normal);
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		resize: vertical;
	}
	.textarea:focus-visible {
		outline: none;
		border-color: var(--ui-border-focus);
		box-shadow: var(--elev-focus);
	}
	.textarea[aria-invalid='true'] {
		border-color: var(--ui-danger);
	}
	.count {
		justify-self: end;
		margin-top: var(--space-1);
		font-size: var(--fs-2xs);
		color: var(--ui-text-muted);
	}
	:global([data-theme='admin']) .textarea {
		font-size: var(--fs-sm);
		padding: var(--space-2) var(--space-3);
	}
</style>
