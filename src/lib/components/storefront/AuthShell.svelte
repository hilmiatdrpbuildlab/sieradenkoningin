<!--
  @component AuthShell — centred column for the customer auth screens (login, register, forgot,
  reset, verify, magic link): crown ornament, title, lead text, content and an optional footer.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/components/ui/Icon.svelte';

	let { title, lead, children, footer }: { title: string; lead?: string; children: Snippet; footer?: Snippet } = $props();
</script>

<section class="auth container-lux">
	<header>
		<Icon name="crown" size={28} stroke={1} class="orn" />
		<h1>{title}</h1>
		{#if lead}<p class="lead">{lead}</p>{/if}
	</header>
	<div class="content">{@render children()}</div>
	{#if footer}<footer>{@render footer()}</footer>{/if}
</section>

<style>
	.auth {
		max-width: calc(30rem + 2 * var(--gutter));
		padding-block: var(--space-12) var(--section-y-sm);
	}
	header {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		text-align: center;
		margin-bottom: var(--space-8);
	}
	header :global(.orn) {
		color: var(--ui-ornament);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-3xl);
	}
	.lead {
		margin: 0;
		color: var(--ui-text-muted);
	}
	.content {
		display: grid;
		gap: var(--space-6);
	}
	footer {
		margin-top: var(--space-8);
		padding-top: var(--space-6);
		border-top: 1px solid var(--ui-border);
		text-align: center;
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	footer :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--ui-accent);
	}
</style>
