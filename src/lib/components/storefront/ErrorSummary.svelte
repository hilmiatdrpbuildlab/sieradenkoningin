<!--
  @component ErrorSummary — GOV.UK-style error summary: a focusable alert with links to each invalid
  field. The parent calls `focus()` after a failed submit; without JS it is rendered at the top of
  the form with `role="alert"` so it is still announced on load.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';

	interface Props {
		title: string;
		items: { id: string; label: string; message: string }[];
		text?: string | null;
	}
	let { title, items, text = null }: Props = $props();
	let box: HTMLDivElement | undefined = $state();

	export function focus() {
		box?.focus();
		box?.scrollIntoView({
			block: 'start',
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
		});
	}

	function jump(e: MouseEvent, id: string) {
		const el = document.getElementById(id) ?? document.querySelector<HTMLElement>(`[name="${id.replace(/^co-/, '')}"]`);
		if (!el) return;
		e.preventDefault();
		el.focus();
		el.scrollIntoView({ block: 'center' });
	}
</script>

{#if items.length || text}
	<div class="summary" role="alert" tabindex="-1" bind:this={box} aria-labelledby="error-summary-title">
		<p id="error-summary-title" class="title"><Icon name="alert" size={18} /> {title}</p>
		{#if text}<p class="text">{text}</p>{/if}
		{#if items.length}
			<ul>
				{#each items as item (item.id)}
					<li><a href="#{item.id}" onclick={(e) => jump(e, item.id)}>{item.label}: {item.message}</a></li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.summary {
		padding: var(--space-5);
		border: 1px solid var(--ui-danger);
		border-left-width: 4px;
		background: var(--ui-danger-bg);
		color: var(--ui-text);
	}
	.summary:focus-visible {
		outline: none;
		box-shadow: var(--elev-focus);
	}
	.title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-weight: var(--fw-semibold);
		color: var(--ui-danger);
	}
	.text {
		margin: var(--space-2) 0 0;
		font-size: var(--fs-sm);
	}
	ul {
		margin: var(--space-3) 0 0;
		padding-left: var(--space-5);
		font-size: var(--fs-sm);
	}
	li + li {
		margin-top: var(--space-1);
	}
	a {
		color: var(--ui-text);
		text-underline-offset: 3px;
	}
</style>
