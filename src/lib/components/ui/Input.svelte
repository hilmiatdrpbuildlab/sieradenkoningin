<!--
  @component Input — storefront: 48px, bottom border only; admin ([data-theme=admin]): 40px, full border.
  Picks up id / aria-describedby / aria-invalid from the surrounding <Field>.
  Password inputs get a show/hide toggle.
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { getFieldContext } from './field-context.ts';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	type Props = Omit<HTMLInputAttributes, 'value'> & { value?: string | number | null; prefix?: string; suffix?: string };

	let { value = $bindable(), type = 'text', prefix, suffix, class: className = '', ...rest }: Props = $props();

	const field = getFieldContext();
	let reveal = $state(false);
	const effectiveType = $derived(type === 'password' && reveal ? 'text' : type);
</script>

<div class="wrap {className}" class:has-prefix={!!prefix} class:has-suffix={!!suffix || type === 'password'}>
	{#if prefix}<span class="affix prefix" aria-hidden="true">{prefix}</span>{/if}
	<input
		class="input"
		id={field?.id}
		aria-describedby={field?.describedBy}
		aria-invalid={field?.invalid || undefined}
		required={field?.required || undefined}
		type={effectiveType}
		bind:value
		{...rest}
	/>
	{#if suffix}<span class="affix suffix" aria-hidden="true">{suffix}</span>{/if}
	{#if type === 'password'}
		<button type="button" class="reveal" aria-pressed={reveal} aria-label={reveal ? m.ui_hide_password() : m.ui_show_password()} onclick={() => (reveal = !reveal)}>
			<Icon name={reveal ? 'eye-off' : 'eye'} size={18} />
		</button>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	.input {
		width: 100%;
		height: 3rem;
		padding: 0 var(--space-1);
		font: inherit;
		font-size: var(--fs-base);
		color: var(--ui-text);
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--ui-border-strong);
		border-radius: 0;
		transition: border-color var(--dur-fast) var(--motion-out), box-shadow var(--dur-fast);
	}
	.input::placeholder {
		color: var(--ui-text-muted);
		opacity: 0.8;
	}
	.input:hover {
		border-bottom-color: var(--ui-text);
	}
	.input:focus-visible {
		outline: none;
		border-bottom-color: var(--ui-border-focus);
		box-shadow: 0 1px 0 0 var(--ui-border-focus);
	}
	.input[aria-invalid='true'] {
		border-bottom-color: var(--ui-danger);
	}
	.input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.has-prefix .input {
		padding-left: 1.75rem;
	}
	.has-suffix .input {
		padding-right: 2.75rem;
	}
	.affix {
		position: absolute;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
		pointer-events: none;
	}
	.prefix {
		left: var(--space-2);
	}
	.suffix {
		right: var(--space-3);
	}
	.reveal {
		position: absolute;
		right: 0;
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		background: none;
		border: 0;
		color: var(--ui-text-muted);
		cursor: pointer;
	}

	:global([data-theme='admin']) .input {
		height: 2.5rem;
		padding: 0 var(--space-3);
		font-size: var(--fs-sm);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
	}
	:global([data-theme='admin']) .input:focus-visible {
		border-color: var(--ui-border-focus);
		box-shadow: var(--elev-focus);
	}
	:global([data-theme='admin']) .input[aria-invalid='true'] {
		border-color: var(--ui-danger);
	}
	:global([data-theme='admin']) .has-prefix .input {
		padding-left: 1.75rem;
	}
	:global([data-theme='admin']) .reveal {
		height: 2.5rem;
	}
</style>
