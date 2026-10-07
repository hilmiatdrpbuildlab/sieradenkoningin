<!--
  @component Tooltip — shown on hover AND keyboard focus of the trigger; Esc dismisses (WCAG 1.4.13).
  The text is also wired as the trigger's accessible description.
  <Tooltip text="Inklappen">{#snippet children(describedby)}<button aria-describedby={describedby}>…</button>{/snippet}</Tooltip>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { text, placement = 'top', children }: { text: string; placement?: 'top' | 'right' | 'bottom'; children: Snippet<[string]> } = $props();
	const uid = $props.id();
	let visible = $state(false);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
	class="tt"
	onmouseenter={() => (visible = true)}
	onmouseleave={() => (visible = false)}
	onfocusin={() => (visible = true)}
	onfocusout={() => (visible = false)}
	onkeydown={(e) => e.key === 'Escape' && (visible = false)}
>
	{@render children(`tt${uid}`)}
	<span id="tt{uid}" role="tooltip" class="bubble bubble--{placement}" class:visible>{text}</span>
</span>

<style>
	.tt {
		position: relative;
		display: inline-flex;
	}
	.bubble {
		position: absolute;
		z-index: var(--z-toast);
		padding: var(--space-1) var(--space-2);
		background: var(--ui-text);
		color: var(--ui-bg);
		font-size: var(--fs-xs);
		white-space: nowrap;
		border-radius: var(--r-xs);
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--dur-fast);
	}
	.visible {
		opacity: 1;
	}
	.bubble--top {
		bottom: calc(100% + 6px);
		left: 50%;
		translate: -50% 0;
	}
	.bubble--bottom {
		top: calc(100% + 6px);
		left: 50%;
		translate: -50% 0;
	}
	.bubble--right {
		left: calc(100% + 8px);
		top: 50%;
		translate: 0 -50%;
	}
</style>
