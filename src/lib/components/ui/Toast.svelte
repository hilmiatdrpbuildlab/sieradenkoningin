<!--
  @component Toast region — bottom-centre on mobile, top-right on desktop (DESIGN_SYSTEM §2.3).
  Announced politely via a live region. Render once per layout; push with getToasts().push(…).
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { getToasts } from '#lib/stores/toast.svelte.ts';
	import Icon from './Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const toasts = getToasts();
</script>

<div class="region" role="region" aria-label={m.ui_notifications()}>
	<div aria-live="polite" aria-atomic="false" class="stack">
		{#each toasts.items as t (t.id)}
			<div class="toast toast--{t.kind}" role={t.kind === 'error' ? 'alert' : 'status'} transition:fly={{ y: 16, duration: 300 }}>
				{#if t.image}<img src={t.image} alt="" width="48" height="60" />{:else}<Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} size={18} />{/if}
				<p>{t.message}</p>
				{#if t.action}
					{#if t.action.href}<a class="action" href={t.action.href}>{t.action.label}</a>
					{:else}<button class="action" onclick={t.action.onclick}>{t.action.label}</button>{/if}
				{/if}
				<button class="x" aria-label={m.ui_close()} onclick={() => toasts.dismiss(t.id)}><Icon name="close" size={14} /></button>
			</div>
		{/each}
	</div>
</div>

<style>
	.region {
		position: fixed;
		z-index: var(--z-toast);
		inset-inline: var(--space-3);
		bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
		pointer-events: none;
	}
	@media (min-width: 48rem) {
		.region {
			inset-inline: auto var(--space-6);
			top: calc(var(--header-h) + var(--space-4));
			bottom: auto;
			width: 24rem;
		}
	}
	.stack {
		display: grid;
		gap: var(--space-2);
	}
	.toast {
		pointer-events: auto;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
		background: var(--ui-surface);
		color: var(--ui-text);
		border: 1px solid var(--ui-border);
		box-shadow: var(--elev-lg);
		font-size: var(--fs-sm);
	}
	.toast--error {
		border-left: 3px solid var(--ui-danger);
	}
	.toast--success :global(svg) {
		color: var(--ui-success);
	}
	.toast img {
		width: 3rem;
		height: 3.75rem;
		object-fit: cover;
		background: var(--ui-surface-sunken);
	}
	p {
		margin: 0;
	}
	.action {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		background: none;
		border: 0;
		color: var(--ui-accent);
		text-decoration: underline;
		cursor: pointer;
		padding: var(--space-2);
	}
	.x {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		background: none;
		border: 0;
		color: var(--ui-text-muted);
		cursor: pointer;
	}
</style>
