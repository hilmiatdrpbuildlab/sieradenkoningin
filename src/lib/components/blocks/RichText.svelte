<!--
  @component RichText — sanitised CMS markdown at a readable measure. Optional eyebrow (e.g. a chapter
  label), handwritten Allura sign-off (“Zahra”) and a link button, for editorial pages like “Ons verhaal”.
-->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { markdownToHtml } from '#lib/utils/markdown.ts';

	interface Props {
		eyebrow?: string;
		title?: string;
		body: string;
		signature?: string;
		signatureNote?: string;
		cta?: { label: string; href: string } | null;
	}
	let { eyebrow, title, body, signature, signatureNote, cta }: Props = $props();
</script>

<section class="rich container-lux">
	{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
	{#if title}<h2>{title}</h2>{/if}
	<div class="prose">{@html markdownToHtml(body)}</div>
	{#if signature}
		<p class="sign">
			<span class="script">{signature}</span>
			{#if signatureNote}<span class="note">{signatureNote}</span>{/if}
		</p>
	{/if}
	{#if cta}<div class="cta"><Button href={cta.href} variant="outline">{cta.label}</Button></div>{/if}
</section>

<style>
	.rich {
		max-width: calc(var(--container-text) + 2 * var(--gutter));
		padding-block: var(--space-8);
	}
	.eyebrow {
		margin: 0 0 var(--space-3);
	}
	h2 {
		margin: 0 0 var(--space-5);
		font-size: var(--fs-3xl);
	}
	.prose {
		line-height: var(--lh-relaxed);
	}
	.prose :global(p) {
		margin: 0 0 var(--space-4);
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
	.sign {
		display: grid;
		gap: var(--space-1);
		margin: var(--space-2) 0 0;
	}
	.note {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-muted);
	}
	.cta {
		margin-top: var(--space-8);
	}
</style>
