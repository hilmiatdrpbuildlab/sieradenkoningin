<!-- @component Banner — image + text + CTA band (campaigns, gift guide). -->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import type { ImageData } from '#lib/types.ts';
	interface Props {
		image: ImageData;
		eyebrow?: string;
		title: string;
		text?: string;
		cta?: { label: string; href: string } | null;
		surface?: 'inverse' | 'espresso' | 'light';
	}
	let { image, eyebrow, title, text, cta, surface = 'inverse' }: Props = $props();
	const uid = $props.id();
</script>

<section class="banner" data-surface={surface === 'light' ? undefined : surface} aria-labelledby="bn{uid}">
	<div class="media"><img src={image.src} srcset={image.srcset} sizes="100vw" alt={image.alt} loading="lazy" width={image.width ?? 2400} height={image.height ?? 1200} /></div>
	<div class="copy container-lux">
		{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
		<h2 id="bn{uid}">{title}</h2>
		{#if text}<p class="text">{text}</p>{/if}
		{#if cta}<Button href={cta.href} variant="outline">{cta.label}</Button>{/if}
	</div>
</section>

<style>
	.banner {
		position: relative;
		isolation: isolate;
		margin-block: var(--section-y-sm);
		min-height: 24rem;
		display: grid;
		align-items: center;
	}
	.media {
		position: absolute;
		inset: 0;
		z-index: -1;
	}
	.media::after {
		content: '';
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--ui-bg) 55%, transparent);
	}
	.media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.copy {
		display: grid;
		justify-items: start;
		gap: var(--space-4);
		padding-block: var(--space-16);
		max-width: 40rem;
		margin-inline: auto;
		text-align: left;
	}
	h2,
	.text {
		margin: 0;
	}
</style>
