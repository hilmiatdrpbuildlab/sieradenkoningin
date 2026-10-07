<!-- @component UspBar — 2–4 short promises with line icons; wraps to a scroll row on phones. -->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import { m } from '#lib/paraglide/messages.js';
	let { items }: { items: { icon: string; text: string }[] } = $props();
</script>

<section class="usp" aria-label={m.usp_label()}>
	<ul class="container-lux">
		{#each items as item, i (i)}
			<li><Icon name={item.icon as IconName} size={20} /> <span>{item.text}</span></li>
		{/each}
	</ul>
</section>

<style>
	.usp {
		border-bottom: 1px solid var(--ui-border);
		background: var(--ui-surface);
	}
	ul {
		display: flex;
		gap: var(--space-8);
		justify-content: center;
		list-style: none;
		margin: 0 auto;
		padding-block: var(--space-4);
		overflow-x: auto;
		scrollbar-width: none;
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	li :global(svg) {
		color: var(--ui-accent);
	}
	@media (max-width: 47.99rem) {
		ul {
			justify-content: flex-start;
		}
	}
</style>
