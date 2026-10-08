<!--
  @component Notice — inline status message (success / error / info) with an icon, so the state is
  never conveyed by colour alone. Errors are announced (role=alert), the rest politely (role=status).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/components/ui/Icon.svelte';

	let { kind = 'info', children }: { kind?: 'success' | 'error' | 'info'; children: Snippet } = $props();
	const icon = $derived(kind === 'success' ? 'check' : kind === 'error' ? 'alert' : 'info');
</script>

<div class="notice {kind}" role={kind === 'error' ? 'alert' : 'status'}>
	<Icon name={icon} size={18} />
	<div class="body">{@render children()}</div>
</div>

<style>
	.notice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		font-size: var(--fs-sm);
		line-height: 1.55;
	}
	.notice :global(svg) {
		flex: none;
		margin-top: 2px;
	}
	.body :global(p) {
		margin: 0;
	}
	.body :global(p + p) {
		margin-top: var(--space-2);
	}
	.success {
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.error {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
	.info {
		background: var(--ui-info-bg);
		color: var(--ui-info);
	}
	.body :global(a) {
		color: inherit;
	}
</style>
