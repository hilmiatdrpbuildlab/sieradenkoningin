<!--
  @component Field — label + control + hint + error, wired with aria-describedby (DESIGN_SYSTEM §2.4).
  Errors use text + icon, never colour alone.
  <Field label="E-mail" error={form?.errors?.email?.[0]} required><Input name="email" type="email" /></Field>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { setFieldContext } from './field-context.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		label: string;
		hint?: string;
		error?: string | string[] | null;
		required?: boolean;
		optional?: boolean;
		/** Visually hide the label (still read by screen readers). */
		hideLabel?: boolean;
		id?: string;
		class?: string;
		children: Snippet;
	}

	let { label, hint, error, required = false, optional = false, hideLabel = false, id: idProp, class: className = '', children }: Props = $props();

	const uid = $props.id();
	const id = $derived(idProp ?? `f${uid}`);
	const message = $derived(Array.isArray(error) ? error[0] : error);
	const describedBy = $derived([hint && `${id}-hint`, message && `${id}-error`].filter(Boolean).join(' ') || undefined);

	setFieldContext({
		get id() {
			return id;
		},
		get describedBy() {
			return describedBy;
		},
		get invalid() {
			return !!message;
		},
		get required() {
			return required;
		}
	});
</script>

<div class="field {className}" class:invalid={!!message}>
	<label for={id} class="label" class:sr-only={hideLabel}>
		{label}
		{#if required}<span class="req" aria-hidden="true">*</span><span class="sr-only">({m.ui_required()})</span>{/if}
		{#if optional}<span class="opt">({m.ui_optional()})</span>{/if}
	</label>
	{@render children()}
	{#if hint}<p id="{id}-hint" class="hint">{hint}</p>{/if}
	{#if message}
		<p id="{id}-error" class="error" role="alert">
			<Icon name="alert" size={14} />
			<span><span class="sr-only">{m.ui_error_prefix()}</span> {message}</span>
		</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	.label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--ui-text);
	}
	:global([data-theme='admin']) .label {
		text-transform: none;
		letter-spacing: 0;
		font-size: var(--fs-sm);
	}
	.req {
		color: var(--ui-text-muted);
		margin-left: 2px;
	}
	.opt {
		color: var(--ui-text-muted);
		font-weight: var(--fw-regular);
		text-transform: none;
		letter-spacing: 0;
		margin-left: var(--space-1);
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.error {
		margin: 0;
		display: flex;
		align-items: flex-start;
		gap: var(--space-1);
		font-size: var(--fs-xs);
		color: var(--ui-danger);
	}
	.error :global(svg) {
		margin-top: 1px;
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
