<!--
  @component ConfirmDialog — native <dialog>; `danger` for destructive actions. When `formAction`
  is given, the confirm button submits that form action (works without JS when wrapped in a form).
  <ConfirmDialog bind:open title="Product archiveren?" danger confirmLabel="Archiveren" onconfirm={…} />
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dialog from './Dialog.svelte';
	import Button from './Button.svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		open?: boolean;
		title: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		/** Submit button inside a form: `formaction` of the confirm button. */
		formAction?: string;
		form?: string;
		onconfirm?: () => void;
		children?: Snippet;
	}
	let { open = $bindable(false), title, message, confirmLabel, cancelLabel, danger = false, formAction, form, onconfirm, children }: Props = $props();
</script>

<Dialog bind:open {title} size="sm">
	{#if message}<p class="msg">{message}</p>{/if}
	{#if children}{@render children()}{/if}
	{#snippet footer()}
		<Button variant="ghost" size="sm" onclick={() => (open = false)}>{cancelLabel ?? m.ui_cancel()}</Button>
		<Button
			variant={danger ? 'danger' : 'primary'}
			size="sm"
			type={formAction || form ? 'submit' : 'button'}
			formaction={formAction}
			{form}
			onclick={() => {
				onconfirm?.();
				if (!formAction && !form) open = false;
			}}
		>
			{confirmLabel ?? m.ui_confirm()}
		</Button>
	{/snippet}
</Dialog>

<style>
	.msg {
		margin: 0;
		color: var(--ui-text);
	}
</style>
