<!-- @component FaqList — accordion of FAQ entries (FAQPage JSON-LD is emitted by the FAQ route). -->
<script lang="ts">
	import Accordion from '#lib/components/ui/Accordion.svelte';
	import { markdownToHtml } from '#lib/utils/markdown.ts';
	import { m } from '#lib/paraglide/messages.js';
	let { title, items }: { title?: string; items: { id: string; question: string; answer: string }[] } = $props();
</script>

<section class="faq container-lux">
	{#if title}<h2>{title}</h2>{/if}
	{#if items.length}
		<Accordion items={items.map((i) => ({ id: i.id, title: i.question }))}>
			{#snippet content(id)}
				{@html markdownToHtml(items.find((i) => i.id === id)?.answer)}
			{/snippet}
		</Accordion>
	{:else}
		<p>{m.faq_empty()}</p>
	{/if}
</section>

<style>
	.faq {
		max-width: calc(var(--container-text) + 2 * var(--gutter));
		padding-block: var(--section-y-sm);
	}
	h2 {
		font-size: var(--fs-2xl);
		margin: 0 0 var(--space-6);
	}
</style>
