<!-- @component PageHeader — admin page title, optional description and action buttons. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, description, actions, meta }: { title: string; description?: string; actions?: Snippet; meta?: Snippet } = $props();
</script>

<div class="ph">
	<div class="txt">
		<h1>{title}</h1>
		{#if description}<p>{description}</p>{/if}
		{#if meta}<div class="meta">{@render meta()}</div>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.ph {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: 0;
		color: var(--ui-text);
	}
	p {
		margin: var(--space-1) 0 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.meta {
		margin-top: var(--space-2);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
