<!--
  @component Tabs — WAI-ARIA tabs (arrow keys, Home/End, roving tabindex). All panels stay in the DOM
  (hidden) so form inputs in inactive tabs still submit — used for the NL/FR content tabs.
  <Tabs tabs={[{ id: 'nl', label: 'Nederlands' }, { id: 'fr', label: 'Français', badge: '!' }]}>
    {#snippet panel(id)}…{/snippet}
  </Tabs>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Tab {
		id: string;
		label: string;
		badge?: string;
	}
	let { tabs, active = $bindable(tabs[0]?.id), label, panel }: { tabs: Tab[]; active?: string; label?: string; panel: Snippet<[string]> } = $props();
	const uid = $props.id();
	let buttons: HTMLButtonElement[] = $state([]);

	function onKey(e: KeyboardEvent, i: number) {
		const n = tabs.length;
		const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
		if (to < 0) return;
		e.preventDefault();
		active = tabs[to].id;
		buttons[to]?.focus();
	}
</script>

<div class="tabs">
	<div role="tablist" aria-label={label} class="list">
		{#each tabs as t, i (t.id)}
			<button
				bind:this={buttons[i]}
				type="button"
				role="tab"
				id="tab{uid}-{t.id}"
				aria-selected={active === t.id}
				aria-controls="panel{uid}-{t.id}"
				tabindex={active === t.id ? 0 : -1}
				onclick={() => (active = t.id)}
				onkeydown={(e) => onKey(e, i)}
			>
				{t.label}
				{#if t.badge}<span class="badge">{t.badge}</span>{/if}
			</button>
		{/each}
	</div>
	{#each tabs as t (t.id)}
		<div role="tabpanel" id="panel{uid}-{t.id}" aria-labelledby="tab{uid}-{t.id}" hidden={active !== t.id} tabindex="0" class="panel">
			{@render panel(t.id)}
		</div>
	{/each}
</div>

<style>
	.list {
		display: flex;
		gap: var(--space-1);
		border-bottom: 1px solid var(--ui-border);
		overflow-x: auto;
	}
	[role='tab'] {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		padding: 0 var(--space-4);
		background: none;
		border: 0;
		color: var(--ui-text-muted);
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		cursor: pointer;
		white-space: nowrap;
	}
	[role='tab'][aria-selected='true'] {
		color: var(--ui-text);
	}
	[role='tab'][aria-selected='true']::after {
		content: '';
		position: absolute;
		inset-inline: var(--space-2);
		bottom: -1px;
		height: 2px;
		background: var(--ui-action);
	}
	[role='tab']:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: -2px;
	}
	.badge {
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 4px;
		border-radius: var(--r-full);
		background: var(--ui-warning-bg);
		color: var(--ui-warning);
		font-size: var(--fs-2xs);
		display: grid;
		place-items: center;
	}
	.panel {
		padding-top: var(--space-4);
	}
	.panel:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
</style>
