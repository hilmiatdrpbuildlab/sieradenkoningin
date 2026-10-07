<!-- @component Badge — small label pill. Tone is never the only signal: always pass meaningful text. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'sale'; children: Snippet } = $props();
</script>

<span class="badge badge--{tone}">{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 1.375rem;
		padding-inline: 0.5rem;
		border-radius: var(--r-full);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.badge--neutral {
		background: var(--ui-surface-sunken);
		color: var(--ui-text);
		box-shadow: inset 0 0 0 1px var(--ui-border);
	}
	.badge--success {
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.badge--warning {
		background: var(--ui-warning-bg);
		color: var(--ui-warning);
	}
	.badge--danger {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
	.badge--info {
		background: var(--ui-info-bg);
		color: var(--ui-info);
	}
	.badge--gold {
		background: var(--ui-gold-gradient);
		color: var(--ui-text-strong);
	}
	.badge--sale {
		background: var(--ui-sale);
		color: var(--ui-text-inverse);
	}
</style>
