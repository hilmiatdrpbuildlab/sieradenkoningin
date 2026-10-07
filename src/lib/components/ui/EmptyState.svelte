<!-- @component EmptyState — crown illustration, title, text and one call to action. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';
	let { title, text, icon = 'crown', action }: { title: string; text?: string; icon?: IconName; action?: Snippet } = $props();
</script>

<div class="empty">
	<Icon name={icon} size={44} stroke={1} class="ornament" />
	<p class="title">{title}</p>
	{#if text}<p class="text">{text}</p>{/if}
	{#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		padding: var(--space-16) var(--space-4);
		text-align: center;
	}
	.empty :global(.ornament) {
		color: var(--ui-ornament);
	}
	.title {
		margin: 0;
		font-family: var(--ff-display);
		font-size: var(--fs-2xl);
		color: var(--ui-text-strong);
	}
	.text {
		margin: 0;
		max-width: 28rem;
		color: var(--ui-text-muted);
	}
	.action {
		margin-top: var(--space-3);
	}
	:global([data-theme='admin']) .title {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}
</style>
