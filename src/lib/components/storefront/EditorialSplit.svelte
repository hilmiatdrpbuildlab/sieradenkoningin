<!--
  @component EditorialSplit — large image + "Met betekenis" story block. `reverse` swaps sides so
  consecutive splits alternate left/right.
-->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { reveal } from '#lib/actions/reveal.ts';
	import { markdownToHtml } from '#lib/utils/markdown.ts';
	import type { ImageData } from '#lib/types.ts';

	interface Props {
		eyebrow?: string;
		title: string;
		script?: string;
		body: string;
		image: ImageData;
		cta?: { label: string; href: string } | null;
		reverse?: boolean;
	}
	let { eyebrow, title, script, body, image, cta, reverse = false }: Props = $props();
	const uid = $props.id();
</script>

<section class="split" class:reverse aria-labelledby="es{uid}">
	<div class="container-lux grid">
		<div class="media">
			<img src={image.src} srcset={image.srcset} sizes="(min-width: 64rem) 50vw, 100vw" alt={image.alt} width={image.width ?? 1600} height={image.height ?? 2000} loading="lazy" decoding="async" />
		</div>
		<div class="copy" use:reveal={{ stagger: true }}>
			{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
			<h2 id="es{uid}">{title}{#if script}<span class="script">{script}</span>{/if}</h2>
			<div class="body">{@html markdownToHtml(body)}</div>
			{#if cta}<div><Button href={cta.href} variant="outline">{cta.label}</Button></div>{/if}
		</div>
	</div>
</section>

<style>
	.split {
		padding-block: var(--section-y);
	}
	.grid {
		display: grid;
		gap: var(--space-10);
		align-items: center;
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: 1fr 1fr;
			gap: var(--space-20);
		}
		.reverse .media {
			order: 2;
		}
	}
	.media {
		aspect-ratio: var(--ratio-editorial);
		overflow: hidden;
		background: var(--ui-surface-sunken);
	}
	.media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.copy {
		display: grid;
		gap: var(--space-5);
		max-width: var(--container-text);
	}
	h2 {
		margin: 0;
		display: grid;
	}
	.body {
		color: var(--ui-text);
		line-height: var(--lh-relaxed);
	}
	.body :global(p) {
		margin: 0 0 var(--space-4);
	}
</style>
