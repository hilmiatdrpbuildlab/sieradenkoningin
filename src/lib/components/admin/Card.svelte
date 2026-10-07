<!-- @component Card — admin panel with optional title and header actions. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, description, actions, children, padded = true, id }: { title?: string; description?: string; actions?: Snippet; children: Snippet; padded?: boolean; id?: string } = $props();
</script>

<section class="card" class:padded aria-labelledby={title && id ? `${id}-t` : undefined} {id}>
	{#if title || actions}
		<header>
			<div>
				{#if title}<h2 id={id ? `${id}-t` : undefined}>{title}</h2>{/if}
				{#if description}<p>{description}</p>{/if}
			</div>
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	<div class="body">{@render children()}</div>
</section>

<style>
	.card {
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		box-shadow: var(--elev-xs);
		min-width: 0;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5) 0;
	}
	h2 {
		margin: 0;
		font-size: var(--fs-base);
		font-weight: var(--fw-semibold);
		letter-spacing: 0;
		color: var(--ui-text);
	}
	p {
		margin: var(--space-1) 0 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
	}
	.padded .body {
		padding: var(--space-4) var(--space-5) var(--space-5);
	}
	.body {
		display: grid;
		gap: var(--space-4);
	}
</style>
