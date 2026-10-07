<!--
  @component Accordion — native <details>/<summary> (keyboard + screen reader support built in,
  works without JS, content is findable with Ctrl+F).
  <Accordion items={[{ id: 'details', title: 'Details' }]}>{#snippet content(id)}…{/snippet}</Accordion>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Item {
		id: string;
		title: string;
		open?: boolean;
	}
	let { items, exclusive = false, content }: { items: Item[]; exclusive?: boolean; content: Snippet<[string]> } = $props();
	const uid = $props.id();
</script>

<div class="accordion">
	{#each items as item (item.id)}
		<details open={item.open} name={exclusive ? `acc${uid}` : undefined}>
			<summary>
				<span>{item.title}</span>
				<Icon name="plus" size={16} class="ico" />
			</summary>
			<div class="content">{@render content(item.id)}</div>
		</details>
	{/each}
</div>

<style>
	.accordion {
		border-top: 1px solid var(--ui-border);
	}
	details {
		border-bottom: 1px solid var(--ui-border);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: 3.5rem;
		cursor: pointer;
		list-style: none;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	summary :global(.ico) {
		transition: transform var(--dur-base) var(--motion-out);
	}
	details[open] summary :global(.ico) {
		transform: rotate(45deg);
	}
	.content {
		padding-bottom: var(--space-5);
		font-size: var(--fs-sm);
		line-height: var(--lh-relaxed);
		color: var(--ui-text);
	}
	.content :global(p) {
		margin: 0 0 var(--space-3);
	}
</style>
