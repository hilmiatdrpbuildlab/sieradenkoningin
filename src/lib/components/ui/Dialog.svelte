<!--
  @component Dialog — native modal <dialog> (focus trap, Esc, inert background for free).
  <Dialog bind:open title="Maatgids">…{#snippet footer()}<Button>OK</Button>{/snippet}</Dialog>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg';
		onclose?: () => void;
		children: Snippet;
		footer?: Snippet;
	}
	let { open = $bindable(false), title, description, size = 'md', onclose, children, footer }: Props = $props();

	let dialog: HTMLDialogElement;
	const uid = $props.id();

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="dialog dialog--{size}"
	aria-labelledby="dlg{uid}-t"
	aria-describedby={description ? `dlg${uid}-d` : undefined}
	onclose={() => {
		open = false;
		onclose?.();
	}}
	onclick={(e) => e.target === dialog && (open = false)}
>
	<div class="panel">
		<header>
			<h2 id="dlg{uid}-t">{title}</h2>
			<button type="button" class="x" aria-label={m.ui_close()} onclick={() => (open = false)}><Icon name="close" /></button>
		</header>
		{#if description}<p id="dlg{uid}-d" class="desc">{description}</p>{/if}
		<div class="body">{@render children()}</div>
		{#if footer}<footer>{@render footer()}</footer>{/if}
	</div>
</dialog>

<style>
	.dialog {
		width: min(100% - 2 * var(--space-4), var(--_w));
		max-height: min(90dvh, 52rem);
		padding: 0;
		border: 0;
		background: var(--ui-bg);
		color: var(--ui-text);
		box-shadow: var(--elev-xl);
		border-radius: var(--r-xs);
	}
	.dialog--sm {
		--_w: 26rem;
	}
	.dialog--md {
		--_w: 36rem;
	}
	.dialog--lg {
		--_w: 56rem;
	}
	.dialog::backdrop {
		background: var(--ui-overlay);
		backdrop-filter: blur(2px);
	}
	.dialog[open] {
		animation: rise var(--dur-base) var(--motion-out);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
	.panel {
		display: flex;
		flex-direction: column;
		max-height: inherit;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-6) var(--space-3);
	}
	h2 {
		margin: 0;
		font-size: var(--fs-2xl);
	}
	.x {
		width: 2.75rem;
		height: 2.75rem;
		margin-right: calc(var(--space-3) * -1);
		display: grid;
		place-items: center;
		background: none;
		border: 0;
		color: inherit;
		cursor: pointer;
	}
	.desc {
		margin: 0;
		padding: 0 var(--space-6);
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.body {
		padding: var(--space-4) var(--space-6) var(--space-6);
		overflow-y: auto;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-6);
		border-top: 1px solid var(--ui-border);
		background: var(--ui-surface);
	}
	:global([data-theme='admin']) .dialog {
		border-radius: var(--r-md);
	}
	:global([data-theme='admin']) h2 {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}
</style>
