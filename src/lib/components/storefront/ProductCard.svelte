<!--
  @component ProductCard — editorial, image-led card (4:5).
  • Hover (pointer devices): crossfade to on-model image + reveal "Snel toevoegen".
  • Touch: second image never loads; quick-add is a compact bag icon.
  • Whole card is clickable via a stretched link; wishlist + quick-add are
    separate buttons layered above it (no nested interactive elements).
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatPrice } from '#lib/utils/format.ts';
	import type { ProductCardData } from '#lib/types.ts';


	interface Props {
		product: ProductCardData;
		eager?: boolean;              // true for first row (LCP)
		wished?: boolean;
		onQuickAdd?: (slug: string) => void;
		onToggleWish?: (slug: string) => void;
	}

	let { product, eager = false, wished = false, onQuickAdd, onToggleWish }: Props = $props();

	const badgeLabel = { new: 'Nieuw', limited: 'Limited', bestseller: 'Bestseller' } as const;
	const onSale = $derived(!!product.compareAtPrice && product.compareAtPrice > product.price);
	const [primary, secondary] = $derived(product.images);
	const sizes = '(min-width: 80rem) 22vw, (min-width: 48rem) 30vw, 46vw';
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
			decoding="async"
		/>
		{#if secondary}
			<img class="img img--secondary" src={secondary.src} srcset={secondary.srcset} {sizes} alt="" width="800" height="1000" loading="lazy" decoding="async" />
		{/if}

		{#if product.inStock === false}
			<span class="badge badge--muted">Uitverkocht</span>
		{:else if onSale}
			<span class="badge badge--sale">−{Math.round((1 - product.price / product.compareAtPrice!) * 100)}%</span>
		{:else if product.badge}
			<span class="badge"><Icon name="sparkle" size={10} />{badgeLabel[product.badge]}</span>
		{/if}

		<button
			class="wish"
			aria-pressed={wished}
			aria-label={wished ? `${product.name} verwijderen uit favorieten` : `${product.name} bewaren in favorieten`}
			onclick={() => onToggleWish?.(product.slug)}
		>
			<Icon name="heart" size={18} />
		</button>

		{#if onQuickAdd && product.inStock !== false}
			<button class="quick" onclick={() => onQuickAdd(product.slug)} aria-label="Snel toevoegen: {product.name}">
				<Icon name="bag" size={16} />
				<span class="quick-label">Snel toevoegen</span>
			</button>
		{/if}
	</div>

	<div class="body">
		<h3 class="name"><a href="/product/{product.slug}" class="stretched">{product.name}</a></h3>
		{#if product.material}<p class="material">{product.material}</p>{/if}
		<p class="price">
			{#if onSale}
				<span class="sr-only">Nu</span><span class="now">{formatPrice(product.price)}</span>
				<span class="sr-only">, was</span><s class="was">{formatPrice(product.compareAtPrice!)}</s>
			{:else}
				{formatPrice(product.price)}
			{/if}
		</p>
		{#if product.metals?.length}
			<ul class="metals" aria-label="Beschikbaar in">
				{#each product.metals as m}<li class="swatch swatch--{m}" title={m}></li>{/each}
			</ul>
		{/if}
	</div>
</article>

<style>
	.card { position: relative; display: flex; flex-direction: column; gap: var(--space-4); }
	.media {
		position: relative;
		aspect-ratio: var(--ratio-product);
		overflow: hidden;
		background: color-mix(in srgb, var(--sk-camel) 20%, var(--sk-cream)); /* board: camel @20% */
	}
	.img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: opacity var(--dur-slow) var(--motion-out), transform 1.2s var(--motion-out);
	}
	.img--secondary { opacity: 0; }

	@media (hover: hover) and (pointer: fine) {
		.card:hover .img--primary { transform: scale(1.04); }
		.card:hover .img--secondary { opacity: 1; }
		.quick-label { display: inline; }
		.quick { inset-inline: var(--space-3); bottom: var(--space-3); transform: translateY(calc(100% + var(--space-3))); opacity: 0; }
		.card:hover .quick, .quick:focus-visible { transform: none; opacity: 1; }
	}
	@media (hover: none) { .img--secondary { display: none; } }

	.badge {
		position: absolute;
		top: var(--space-3);
		left: var(--space-3);
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		padding: 0.35em 0.7em;
		background: var(--sk-cream);
		color: var(--sk-burgundy);
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	.badge--sale { background: var(--ui-sale); color: var(--sk-cream); }
	.badge--muted { background: var(--sk-espresso); color: var(--sk-cream); }

	.wish, .quick {
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
		color: var(--sk-espresso);
	}
	/* soft cream disc keeps the heart legible on dark AND light photography */
	.wish::before { content: ''; position: absolute; width: 2rem; height: 2rem; border-radius: 50%; background: rgb(246 241 236 / 0.85); z-index: -1; }
	.wish { isolation: isolate; }
	.wish[aria-pressed='true'] :global(svg) { fill: var(--sk-ruby); stroke: var(--sk-ruby); }

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
		background: color-mix(in srgb, var(--sk-cream) 92%, transparent);
		backdrop-filter: blur(6px);
		color: var(--sk-burgundy);
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	.quick-label { display: none; }
	.quick:hover { background: var(--sk-burgundy); color: var(--sk-cream); }

	.body { display: grid; gap: var(--space-1); text-align: center; }
	.name { font-family: var(--ff-display); font-size: var(--fs-lg); line-height: var(--lh-snug); margin: 0; color: var(--ui-text); letter-spacing: 0; }
	.stretched { text-decoration: none; }
	.stretched::after { content: ''; position: absolute; inset: 0; z-index: 1; }
	.stretched:focus-visible { outline: none; }
	.stretched:focus-visible::after { box-shadow: var(--elev-focus); }
	.material { margin: 0; font-size: var(--fs-xs); color: var(--ui-text-muted); letter-spacing: 0.02em; }
	.price { margin: var(--space-1) 0 0; font-size: var(--fs-sm); font-weight: var(--fw-medium); display: flex; justify-content: center; gap: var(--space-2); }
	.now { color: var(--ui-sale); }
	.was { color: var(--ui-text-muted); font-weight: var(--fw-regular); }

	.metals { display: flex; justify-content: center; gap: 6px; padding: 0; margin: var(--space-1) 0 0; list-style: none; }
	.swatch { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1px var(--sk-cream), 0 0 0 2px var(--ui-border); }
	.swatch--gold { background: linear-gradient(135deg, #e6cfa1, #b8904f); }
	.swatch--rosegold { background: linear-gradient(135deg, #ecc6b8, #b9806e); }
	.swatch--silver { background: linear-gradient(135deg, #f2f2f2, #a9a9a9); }

	.soldout .img { filter: saturate(0.6); opacity: 0.8; }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
