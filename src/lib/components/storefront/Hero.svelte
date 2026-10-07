<!--
  @component Hero — full-bleed editorial hero on burgundy (DESIGN_SYSTEM §2.2).
  Variants:
   • "overlay" : full-bleed image, copy centred on a burgundy gradient (brand board style)
   • "split"   : copy left / image right (desktop), image-first stack on mobile
  The image is the LCP element: eager + fetchpriority=high, never lazy.
-->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { ImageData } from '#lib/types.ts';

	interface Props {
		variant?: 'overlay' | 'split';
		overline?: string;
		title: string;
		script?: string; // one Allura word, e.g. "You" / "Koningin"
		lead?: string;
		image: ImageData;
		cta?: { label: string; href: string } | null;
		secondaryCta?: { label: string; href: string } | null;
		headingLevel?: 1 | 2;
	}

	let { variant = 'overlay', overline, title, script, lead, image, cta, secondaryCta, headingLevel = 1 }: Props = $props();
	const uid = $props.id();
</script>

<section class="hero hero--{variant}" data-surface="inverse" aria-labelledby="hero{uid}">
	<div class="media">
		<img
			src={image.src}
			srcset={image.srcset}
			sizes={variant === 'split' ? '(min-width: 64rem) 55vw, 100vw' : '100vw'}
			alt={image.alt}
			width={image.width ?? 1600}
			height={image.height ?? 2000}
			fetchpriority="high"
			loading="eager"
			decoding="async"
		/>
	</div>

	<div class="copy">
		<Icon name="crown" size={34} stroke={1} class="orn" />
		{#if overline}<p class="eyebrow">{overline}</p>{/if}
		<svelte:element this={`h${headingLevel}`} id="hero{uid}" class="display title">
			{title}
			{#if script}<span class="script accent">{script}</span>{/if}
		</svelte:element>
		<div class="hairline-divider" aria-hidden="true"><Icon name="sparkle" size={10} /></div>
		{#if lead}<p class="lead">{lead}</p>{/if}
		{#if cta || secondaryCta}
			<div class="ctas">
				{#if cta}<Button href={cta.href} variant="outline" size="lg">{cta.label}</Button>{/if}
				{#if secondaryCta}<Button href={secondaryCta.href} variant="link" iconRight="arrow-right">{secondaryCta.label}</Button>{/if}
			</div>
		{/if}
	</div>
</section>

<style>
	.hero {
		position: relative;
		isolation: isolate;
		overflow: hidden;
	}
	.hero :global(.orn) {
		color: var(--ui-ornament);
	}
	.copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-5);
		max-width: 40rem;
	}
	.title {
		color: var(--ui-text);
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		font-weight: var(--fw-regular);
	}
	.accent {
		margin-top: -0.15em;
	}
	.lead {
		font-size: var(--fs-lg);
		color: var(--ui-text-muted);
		font-weight: var(--fw-light);
		max-width: 32rem;
		margin: 0;
	}
	.ctas {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-6);
		margin-top: var(--space-2);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* ── overlay ─────────────────────────────────────────── */
	.hero--overlay {
		min-height: min(100svh, 56rem);
		display: grid;
		place-items: end center;
	}
	.hero--overlay .media {
		position: absolute;
		inset: 0;
		z-index: -1;
	}
	.hero--overlay .media::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(36 13 14 / 0.92) 0%, rgb(57 22 23 / 0.45) 45%, rgb(57 22 23 / 0.15) 100%);
	}
	.hero--overlay .copy {
		padding: calc(var(--header-h) + var(--announce-h) + var(--space-16)) var(--gutter) var(--section-y-sm);
	}

	/* ── split ───────────────────────────────────────────── */
	.hero--split {
		display: grid;
	}
	.hero--split .media {
		aspect-ratio: var(--ratio-editorial);
		max-height: 70svh;
	}
	.hero--split .copy {
		padding: var(--section-y-sm) var(--gutter);
		margin-inline: auto;
	}
	@media (min-width: 64rem) {
		.hero--split {
			grid-template-columns: 45fr 55fr;
			min-height: min(100svh, 56rem);
		}
		.hero--split .media {
			order: 2;
			aspect-ratio: auto;
			max-height: none;
		}
		.hero--split .copy {
			align-self: center;
		}
		.hero--overlay {
			place-items: center;
		}
	}
</style>
