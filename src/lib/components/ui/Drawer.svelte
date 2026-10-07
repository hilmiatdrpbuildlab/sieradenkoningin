<!--
  @component Drawer — native <dialog> side/bottom sheet (filters on mobile, admin mobile nav).
  <Drawer bind:open side="bottom" title="Filters">…</Drawer>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		open?: boolean;
		title: string;
		side?: 'left' | 'right' | 'bottom';
		onclose?: () => void;
		children: Snippet;
		footer?: Snippet;
	}
	let { open = $bindable(false), title, side = 'right', onclose, children, footer }: Props = $props();

	let dialog: HTMLDialogElement;
	const uid = $props.id();

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="drawer drawer--{side}"
	aria-labelledby="drw{uid}"
	onclose={() => {
		open = false;
		onclose?.();
	}}
	onclick={(e) => e.target === dialog && (open = false)}
>
	<div class="panel">
		<header>
			<h2 id="drw{uid}">{title}</h2>
			<button type="button" class="x" aria-label={m.ui_close()} onclick={() => (open = false)}><Icon name="close" /></button>
		</header>
		<div class="body">{@render children()}</div>
		{#if footer}<footer>{@render footer()}</footer>{/if}
	</div>
</dialog>

<style>
	.drawer {
		padding: 0;
		border: 0;
		max-width: 100vw;
		max-height: 100dvh;
		background: var(--ui-bg);
		color: var(--ui-text);
		box-shadow: var(--elev-xl);
	}
	.drawer::backdrop {
		background: var(--ui-overlay);
	}
	.drawer--right {
		margin: 0 0 0 auto;
		width: var(--drawer-w);
		height: 100dvh;
	}
	.drawer--left {
		margin: 0 auto 0 0;
		width: min(24rem, 88vw);
		height: 100dvh;
	}
	.drawer--bottom {
		margin: auto 0 0;
		width: 100vw;
		max-height: 88dvh;
		border-radius: var(--r-md) var(--r-md) 0 0;
	}
	.drawer--right[open] {
		animation: from-right var(--dur-slow) var(--motion-out);
	}
	.drawer--left[open] {
		animation: from-left var(--dur-slow) var(--motion-out);
	}
	.drawer--bottom[open] {
		animation: from-bottom var(--dur-slow) var(--motion-out);
	}
	@keyframes from-right {
		from {
			transform: translateX(100%);
		}
	}
	@keyframes from-left {
		from {
			transform: translateX(-100%);
		}
	}
	@keyframes from-bottom {
		from {
			transform: translateY(100%);
		}
	}
	.panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: inherit;
	}
	.drawer--bottom .panel {
		height: auto;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) var(--space-6);
		border-bottom: 1px solid var(--ui-border);
	}
	h2 {
		margin: 0;
		font-size: var(--fs-xl);
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
	.body {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-4) var(--space-6);
		overscroll-behavior: contain;
	}
	footer {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-6) calc(var(--space-4) + env(safe-area-inset-bottom));
		border-top: 1px solid var(--ui-border);
		background: var(--ui-surface);
	}
</style>
