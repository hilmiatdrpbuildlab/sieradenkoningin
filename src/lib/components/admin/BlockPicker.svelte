<!--
  @component BlockPicker — "Blok toevoegen" dialog listing every block type in `blockSchemas` (P4-01).
  `onpick(type)` receives the chosen type; the caller inserts a block with default data.
-->
<script lang="ts">
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { BLOCK_DESCRIPTIONS, BLOCK_LABELS, PICKER_TYPES } from './block-defaults.ts';
	import type { BlockType } from '#lib/schemas/page-block.ts';

	let { onpick, label = 'Blok toevoegen' }: { onpick: (type: BlockType) => void; label?: string } = $props();
	let open = $state(false);
</script>

<Button variant="outline" size="sm" icon="plus" onclick={() => (open = true)}>{label}</Button>

<Dialog
	bind:open
	title="Blok toevoegen"
	description="Kies het type blok. Je vult de inhoud daarna in, in het Nederlands en het Frans."
	size="lg"
>
	<ul class="types">
		{#each PICKER_TYPES as type (type)}
			<li>
				<button
					type="button"
					onclick={() => {
						onpick(type);
						open = false;
					}}
				>
					<strong>{BLOCK_LABELS[type]}</strong>
					<span>{BLOCK_DESCRIPTIONS[type]}</span>
				</button>
			</li>
		{/each}
	</ul>
</Dialog>

<style>
	.types {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--space-2);
	}
	button {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		height: 100%;
		min-height: 4rem;
		padding: var(--space-3);
		text-align: left;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	button:hover {
		border-color: var(--ui-action);
	}
	button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	strong {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}
	span {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
</style>
