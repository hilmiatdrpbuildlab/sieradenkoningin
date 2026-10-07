<!-- @component RichText — sanitised CMS markdown at a readable measure. -->
<script lang="ts">
	import { markdownToHtml } from '#lib/utils/markdown.ts';
	let { title, body }: { title?: string; body: string } = $props();
</script>

<section class="rich container-lux">
	{#if title}<h2>{title}</h2>{/if}
	<div class="prose">{@html markdownToHtml(body)}</div>
</section>

<style>
	.rich {
		max-width: calc(var(--container-text) + 2 * var(--gutter));
		padding-block: var(--space-8);
	}
	h2 {
		font-size: var(--fs-2xl);
	}
	.prose {
		line-height: var(--lh-relaxed);
	}
	.prose :global(h2) {
		font-size: var(--fs-2xl);
		margin: var(--space-10) 0 var(--space-4);
	}
	.prose :global(h3) {
		font-size: var(--fs-xl);
		margin: var(--space-8) 0 var(--space-3);
	}
	.prose :global(a) {
		color: var(--ui-accent);
	}
	.prose :global(ul),
	.prose :global(ol) {
		padding-left: var(--space-6);
	}
</style>
