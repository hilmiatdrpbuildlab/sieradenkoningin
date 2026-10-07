<!--
  @component ProductCard — editorial, image-led card (4:5) (DESIGN_SYSTEM §2.3).
  • Hover (pointer devices): crossfade to the second image + reveal "Snel toevoegen".
  • Touch: the second image is never shown; quick-add is a compact bag icon.
  • Whole card is clickable via a stretched link; wishlist + quick-add are separate buttons
    layered above it (no nested interactive elements).
  • Quick-add adds directly when the product has one variant; otherwise it opens the PDP.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatPrice } from '#lib/utils/format.ts';
	import { getWishlist } from '#lib/stores/wishlist.svelte.ts';
	import { getCart } from '#lib/stores/cart.svelte.ts';
	import { getToasts } from '#lib/stores/toast.svelte.ts';
	import { goto } from '$app/navigation';
	import type { ProductCardData } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		product: ProductCardData;
		eager?: boolean; // true for the first row (LCP)
		headingLevel?: 2 | 3 | 4;
	}

	let { product, eager = false, headingLevel = 3 }: Props = $props();

	const wishlist = getWishlist();
	const cart = getCart();
	const toasts = getToasts();
	const lang = $derived(cart?.lang ?? 'nl');

	const badgeLabel = $derived({ new: m.badge_new(), limited: m.badge_limited(), bestseller: m.badge_bestseller() });
	const onSale = $derived(!!product.compareAtPrice && product.compareAtPrice > product.price);
	const primary = $derived(product.images[0]);
	const secondary = $derived(product.images[1]);
	const wished = $derived(wishlist?.has(product.id) ?? false);
	const sizes = '(min-width: 80rem) 22vw, (min-width: 48rem) 30vw, 46vw';
	const metalName = $derived({ gold: m.metal_gold(), rosegold: m.metal_rosegold(), silver: m.metal_silver() });

	async function quickAdd() {
		if (!product.quickAddVariantId) return goto(product.href);
		const r = await cart.add(product.quickAddVariantId, 1);
		if (r.ok) toasts.push({ message: r.capped ? m.cart_added_capped() : m.cart_added(), image: primary?.src });
		else toasts.push({ kind: 'error', message: r.error === 'unavailable' ? m.cart_unavailable() : m.cart_error() });
	}
</script>

<article class="card" class:soldout={product.inStock === false}>
	<div class="media">
		<img
			class="img img--primary"
			src={primary.src}
			srcset={primary.srcset}
			{sizes}
			alt={primary.alt}
			width="800"
			height="1000"
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : undefined}
			decoding="async"
		/>
		{#if secondary}
			<img class="img img--secondary" src={secondary.src} srcset={secondary.srcset} {sizes} alt="" width="800" height="1000" loading="lazy" decoding="async" />
		{/if}

		{#if product.inStock === false}
			<span class="badge badge--muted">{m.badge_soldout()}</span>
		{:else if onSale}
			<span class="badge badge--sale">−{Math.round((1 - product.price / product.compareAtPrice!) * 100)}%</span>
		{:else if product.badge}
			<span class="badge"><Icon name="sparkle" size={10} />{badgeLabel[product.badge]}</span>
		{/if}

		<button
			class="wish"
			aria-pressed={wished}
			aria-label={wished ? m.wishlist_remove({ name: product.name }) : m.wishlist_add({ name: product.name })}
			onclick={() => wishlist.toggle(product.id)}
		>
			<Icon name="heart" size={18} />
		</button>

		{#if product.inStock !== false}
			<button class="quick" onclick={quickAdd} aria-label={m.quick_add_label({ name: product.name })} disabled={cart.pending}>
				<Icon name="bag" size={16} />
				<span class="quick-label">{product.quickAddVariantId ? m.quick_add() : m.quick_choose()}</span>
			</button>
		{/if}
	</div>

	<div class="body">
		<svelte:element this={`h${headingLevel}`} class="name"><a href={product.href} class="stretched">{product.name}</a></svelte:element>
		{#if product.material}<p class="material">{product.material}</p>{/if}
		<p class="price">
			{#if onSale}
				<span class="sr-only">{m.price_now()}</span><span class="now">{formatPrice(product.price, lang)}</span>
				<span class="sr-only">{m.price_was()}</span><s class="was">{formatPrice(product.compareAtPrice!, lang)}</s>
			{:else}
				{formatPrice(product.price, lang)}
			{/if}
		</p>
		{#if product.metals?.length}
			<ul class="metals" aria-label={m.available_in()}>
				{#each product.metals as metal (metal)}<li class="swatch swatch--{metal}"><span class="sr-only">{metalName[metal]}</span></li>{/each}
			</ul>
		{/if}
	</div>
</article>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.media {
		position: relative;
		aspect-ratio: var(--ratio-product);
		overflow: hidden;
		background: color-mix(in srgb, var(--ui-text-subtle) 20%, var(--ui-bg)); /* board: camel @20% */
	}
	.img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition:
			opacity var(--dur-slow) var(--motion-out),
			transform 1.2s var(--motion-out);
	}
	.img--secondary {
		opacity: 0;
	}

	@media (hover: hover) and (pointer: fine) {
		.card:hover .img--primary {
			transform: scale(1.04);
		}
		.card:hover .img--secondary {
			opacity: 1;
		}
		.quick-label {
			display: inline;
		}
		.quick {
			inset-inline: var(--space-3);
			bottom: var(--space-3);
			transform: translateY(calc(100% + var(--space-3)));
			opacity: 0;
		}
		.card:hover .quick,
		.quick:focus-visible {
			transform: none;
			opacity: 1;
		}
	}
	@media (hover: none) {
		.img--secondary {
			display: none;
		}
	}

	.badge {
		position: absolute;
		top: var(--space-3);
		left: var(--space-3);
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		padding: 0.35em 0.7em;
		background: var(--ui-glass);
		color: var(--ui-text-strong);
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	.badge--sale {
		background: var(--ui-sale);
		color: var(--ui-text-inverse);
	}
	.badge--muted {
		background: var(--ui-text);
		color: var(--ui-bg);
	}

	.wish,
	.quick {
		position: absolute;
		z-index: 2;
		border: 0;
		cursor: pointer;
		transition: all var(--dur-base) var(--motion-out);
	}
	.wish {
		top: var(--space-2);
		right: var(--space-2);
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--ui-text);
		isolation: isolate;
	}
	/* soft cream disc keeps the heart legible on dark AND light photography */
	.wish::before {
		content: '';
		position: absolute;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--ui-glass);
		z-index: -1;
	}
	.wish[aria-pressed='true'] :global(svg) {
		fill: var(--ui-sale);
		stroke: var(--ui-sale);
	}
	.wish:focus-visible,
	.quick:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}

	/* Touch default: compact icon button bottom-right */
	.quick {
		right: var(--space-2);
		bottom: var(--space-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-width: 2.75rem;
		height: 2.75rem;
		padding-inline: var(--space-3);
		background: var(--ui-glass);
		backdrop-filter: blur(6px);
		color: var(--ui-text-strong);
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	.quick-label {
		display: none;
	}
	.quick:hover {
		background: var(--ui-action);
		color: var(--ui-action-text);
	}

	.body {
		display: grid;
		gap: var(--space-1);
		text-align: center;
	}
	.name {
		font-family: var(--ff-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-regular);
		line-height: var(--lh-snug);
		margin: 0;
		color: var(--ui-text);
		letter-spacing: 0;
	}
	.stretched {
		text-decoration: none;
	}
	.stretched::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
	}
	.stretched:focus-visible {
		outline: none;
	}
	.stretched:focus-visible::after {
		box-shadow: var(--elev-focus);
	}
	.material {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		letter-spacing: 0.02em;
	}
	.price {
		margin: var(--space-1) 0 0;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		display: flex;
		justify-content: center;
		gap: var(--space-2);
	}
	.now {
		color: var(--ui-sale);
	}
	.was {
		color: var(--ui-text-muted);
		font-weight: var(--fw-regular);
	}

	.metals {
		display: flex;
		justify-content: center;
		gap: 6px;
		padding: 0;
		margin: var(--space-1) 0 0;
		list-style: none;
	}
	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		box-shadow:
			0 0 0 1px var(--ui-bg),
			0 0 0 2px var(--ui-border);
	}
	.swatch--gold {
		background: var(--ui-swatch-gold);
	}
	.swatch--rosegold {
		background: var(--ui-swatch-rosegold);
	}
	.swatch--silver {
		background: var(--ui-swatch-silver);
	}

	.soldout .img {
		filter: saturate(0.6);
		opacity: 0.8;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
