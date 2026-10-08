<!--
  @component PdpGallery — one scroll-snap track for every viewport (DESIGN_SYSTEM §2.3):
  • < lg: swipeable carousel with dot indicators.
  • ≥ lg: vertical thumbnails beside a large 4:5 image; click (or Enter) zooms in place and the zoom
    follows the pointer; click again / Esc zooms out.
  The first image is eager + fetchpriority=high (LCP); the rest lazy.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	interface GalleryImage {
		src: string;
		srcset?: string;
		alt: string;
		zoom: string;
		width: number;
		height: number;
	}
	let { images }: { images: GalleryImage[] } = $props();

	let track: HTMLDivElement | undefined = $state();
	let active = $state(0);
	let zoomed = $state<number | null>(null);
	let origin = $state('50% 50%');
	const sizes = '(min-width: 64rem) 50vw, 100vw';

	function onScroll() {
		if (!track) return;
		const i = Math.round(track.scrollLeft / track.clientWidth);
		if (i !== active) {
			active = i;
			zoomed = null;
		}
	}

	function go(i: number) {
		if (!track) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
		active = i;
		zoomed = null;
	}

	const canZoom = () => matchMedia('(min-width: 64rem) and (hover: hover)').matches;

	function toggleZoom(i: number, e?: MouseEvent) {
		if (!canZoom()) return;
		if (zoomed === i) return void (zoomed = null);
		if (e) move(e);
		else origin = '50% 50%';
		zoomed = i;
	}

	function move(e: MouseEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		origin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
	}
</script>

<div class="gallery" role="region" aria-roledescription="carousel" aria-label={m.pdp_gallery_label()}>
	{#if images.length > 1}
		<ul class="thumbs" aria-label={m.pdp_gallery_thumbs()}>
			{#each images as im, i (i)}
				<li>
					<button
						type="button"
						class:on={i === active}
						aria-current={i === active ? 'true' : undefined}
						aria-label={m.pdp_gallery_image({ n: i + 1, total: images.length })}
						onclick={() => go(i)}
					>
						<img src={im.src} alt="" width="120" height="150" loading="lazy" decoding="async" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="stage">
		<div class="track" bind:this={track} onscroll={onScroll}>
			{#each images as im, i (i)}
				<div
					class="slide"
					role="group"
					aria-roledescription="slide"
					aria-label={m.pdp_gallery_image({ n: i + 1, total: images.length })}
				>
					<button
						type="button"
						class="zoom"
						class:zoomed={zoomed === i}
						aria-label={zoomed === i ? m.pdp_zoom_out() : m.pdp_zoom_in()}
						aria-pressed={zoomed === i}
						onclick={(e) => toggleZoom(i, e.detail ? e : undefined)}
						onmousemove={(e) => zoomed === i && move(e)}
						onmouseleave={() => zoomed === i && (zoomed = null)}
						onkeydown={(e) => e.key === 'Escape' && zoomed === i && (zoomed = null)}
					>
						<img
							src={zoomed === i ? im.zoom : im.src}
							srcset={zoomed === i ? undefined : im.srcset}
							{sizes}
							alt={im.alt}
							width={im.width}
							height={im.height}
							loading={i === 0 ? 'eager' : 'lazy'}
							fetchpriority={i === 0 ? 'high' : undefined}
							decoding={i === 0 ? 'sync' : 'async'}
							style:transform-origin={origin}
						/>
					</button>
				</div>
			{/each}
		</div>
		{#if images.length > 1}
			<div class="dots">
				{#each images as _, i (i)}
					<button
						type="button"
						class:on={i === active}
						aria-label={m.pdp_gallery_image({ n: i + 1, total: images.length })}
						aria-current={i === active ? 'true' : undefined}
						onclick={() => go(i)}><span></span></button
					>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.gallery {
		display: grid;
		gap: var(--space-3);
	}
	.stage {
		position: relative;
		min-width: 0;
	}
	.track {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 100%;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.slide {
		scroll-snap-align: start;
		aspect-ratio: var(--ratio-product);
		overflow: hidden;
		background: color-mix(in srgb, var(--ui-text-subtle) 20%, var(--ui-bg));
	}
	.zoom {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: default;
		overflow: hidden;
	}
	.zoom:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: -2px;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform var(--dur-slow) var(--motion-out);
	}
	.zoomed img {
		transform: scale(2.2);
	}
	.dots {
		display: flex;
		justify-content: center;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
	.dots button {
		width: 1.75rem;
		height: 1.75rem;
		display: grid;
		place-items: center;
		border: 0;
		background: none;
		cursor: pointer;
		padding: 0;
	}
	.dots span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ui-border-strong);
		transition: all var(--dur-base) var(--motion-out);
	}
	.dots .on span {
		width: 18px;
		border-radius: var(--r-full);
		background: var(--ui-text);
	}
	.dots button:focus-visible,
	.thumbs button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.thumbs {
		display: none;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.thumbs button {
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid transparent;
		background: none;
		cursor: pointer;
		aspect-ratio: var(--ratio-product);
		overflow: hidden;
		opacity: 0.65;
		transition: opacity var(--dur-base);
	}
	.thumbs button:hover,
	.thumbs .on {
		opacity: 1;
	}
	.thumbs .on {
		border-color: var(--ui-text);
	}

	@media (min-width: 64rem) {
		.gallery {
			grid-template-columns: 5.5rem minmax(0, 1fr);
			gap: var(--space-4);
			align-items: start;
		}
		.gallery:not(:has(.thumbs)) {
			grid-template-columns: minmax(0, 1fr);
		}
		.thumbs {
			display: grid;
			gap: var(--space-3);
		}
		.dots {
			display: none;
		}
		.track {
			overflow-x: hidden;
		}
	}
	@media (min-width: 64rem) and (hover: hover) {
		.zoom {
			cursor: zoom-in;
		}
		.zoom.zoomed {
			cursor: zoom-out;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		img {
			transition: none;
		}
	}
</style>
