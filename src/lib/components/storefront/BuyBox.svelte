<!--
  @component BuyBox — PDP purchase column (DESIGN_SYSTEM §2.3): name, price incl. btw (+ sale and
  the Omnibus 30-day lowest price), metal + size picker, quantity, add to cart, stock messaging and
  the delivery promise. The form posts to `?/add` without JS; with JS it calls getCart().add().
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import QuantityStepper from '#lib/components/ui/QuantityStepper.svelte';
	import VariantPicker from './VariantPicker.svelte';
	import { getCart } from '#lib/stores/cart.svelte.ts';
	import { getWishlist } from '#lib/stores/wishlist.svelte.ts';
	import { getToasts } from '#lib/stores/toast.svelte.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import type { Lang } from '#lib/i18n/paths.ts';
	import type { PdpVariant } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		lang: Lang;
		product: { id: string; name: string; material: string; badge: string | null; lowest30: number | null };
		variants: PdpVariant[];
		variantId: string | null;
		sizeKind?: 'ring' | 'bracelet' | null;
		shipping: { cutoffHour: number; deliveryDays: number; freeFrom: number };
		returnDays: number;
		image?: string;
		/** server error from the no-JS action */
		error?: string | null;
		onvariant: (id: string) => void;
	}
	let {
		lang,
		product,
		variants,
		variantId,
		sizeKind = null,
		shipping,
		returnDays,
		image,
		error = null,
		onvariant
	}: Props = $props();

	const cart = getCart();
	const wishlist = getWishlist();
	const toasts = getToasts();
	let qty = $state(1);

	const v = $derived(variants.find((x) => x.id === variantId) ?? null);
	const price = $derived(v?.price ?? 0);
	const compareAt = $derived(v?.compareAtPrice ?? null);
	const soldOut = $derived(!v || v.stock <= 0);
	const maxQty = $derived(Math.max(1, Math.min(10, v?.stock ?? 1)));
	const wished = $derived(wishlist?.has(product.id) ?? false);

	$effect(() => {
		if (qty > maxQty) qty = maxQty;
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!v || soldOut || cart.pending) return;
		const r = await cart.add(v.id, qty, { openDrawer: false });
		if (r.ok) {
			toasts.push({
				message: r.capped ? m.cart_added_capped() : m.cart_added(),
				image,
				action: { label: m.cart_view_cart(), onclick: () => (cart.open = true) }
			});
		} else toasts.push({ kind: 'error', message: r.error === 'unavailable' ? m.cart_unavailable() : m.cart_error() });
	}
</script>

<div class="buybox">
	<h1>{product.name}</h1>
	{#if product.material}<p class="material">{product.material}</p>{/if}

	<div class="price" aria-live="polite">
		{#if compareAt}
			<span class="sr-only">{m.price_now()}</span><span class="now">{formatPrice(price, lang)}</span>
			<span class="sr-only">{m.price_was()}</span><s class="was">{formatPrice(compareAt, lang)}</s>
			<span class="off">−{Math.round((1 - price / compareAt) * 100)}%</span>
		{:else}
			<span>{formatPrice(price, lang)}</span>
		{/if}
		<small>{m.price_incl_vat()}</small>
	</div>
	{#if compareAt && product.lowest30 != null}
		<p class="omnibus">{m.pdp_lowest_30({ price: formatPrice(product.lowest30, lang) })}</p>
	{/if}

	<form method="POST" action="?/add" onsubmit={submit}>
		<input type="hidden" name="productId" value={product.id} />
		<VariantPicker {variants} value={variantId} {sizeKind} onchange={onvariant} />

		<p class="stock" class:low={v?.lowStock} class:out={soldOut} aria-live="polite">
			<span class="dot" aria-hidden="true"></span>
			{#if soldOut}{m.pdp_stock_out()}{:else if v?.lowStock}{m.pdp_stock_low({
					count: v.stock
				})}{:else}{m.pdp_stock_in()}{/if}
		</p>

		{#if soldOut}
			<!-- P3-09 slot: back-in-stock "Mail me" form for sold-out variants (stock_alerts). Not built in P1. -->
			<button type="button" class="cta" disabled>{m.badge_soldout()}</button>
		{:else}
			<div class="row">
				<QuantityStepper
					bind:value={qty}
					name="qty"
					min={1}
					max={maxQty}
					label={m.ui_quantity_for({ name: product.name })}
				/>
				<button type="submit" class="cta" disabled={cart?.pending}>
					<Icon name="bag" size={18} />{m.pdp_add_to_cart()}
				</button>
			</div>
		{/if}
		{#if error}<p class="err" role="alert">{error === 'unavailable' ? m.cart_unavailable() : m.cart_error()}</p>{/if}
	</form>

	<button
		type="button"
		class="wish"
		aria-pressed={wished}
		onclick={() => wishlist.toggle(product.id)}
		aria-label={wished ? m.wishlist_remove({ name: product.name }) : m.wishlist_add({ name: product.name })}
	>
		<Icon name="heart" size={18} />
		<span>{m.nav_wishlist()}</span>
	</button>

	<ul class="promise">
		<li>
			<Icon name="truck" size={18} />{shipping.deliveryDays <= 1
				? m.pdp_delivery_tomorrow({ hour: shipping.cutoffHour })
				: m.pdp_delivery_days({ hour: shipping.cutoffHour, days: shipping.deliveryDays })}
		</li>
		<li><Icon name="gift" size={18} />{m.pdp_free_shipping({ amount: formatPrice(shipping.freeFrom, lang) })}</li>
		<li><Icon name="return" size={18} />{m.pdp_returns({ days: returnDays })}</li>
	</ul>
</div>

<style>
	.buybox {
		display: grid;
		gap: var(--space-4);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-4xl);
		line-height: var(--lh-tight, 1.1);
		color: var(--ui-text-strong);
	}
	.material {
		margin: 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.price {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-3);
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
	}
	.price small {
		font-size: var(--fs-xs);
		font-weight: var(--fw-regular);
		color: var(--ui-text-muted);
	}
	.now {
		color: var(--ui-sale);
	}
	.was {
		font-size: var(--fs-base);
		font-weight: var(--fw-regular);
		color: var(--ui-text-muted);
	}
	.off {
		padding: 0.2em 0.6em;
		background: var(--ui-sale);
		color: var(--ui-text-inverse);
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
	}
	.omnibus {
		margin: calc(-1 * var(--space-2)) 0 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	form {
		display: grid;
		gap: var(--space-5);
		margin-top: var(--space-4);
		padding-top: var(--space-6);
		border-top: 1px solid var(--ui-border);
	}
	.stock {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--fs-sm);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ui-success);
	}
	.stock.low .dot {
		background: var(--ui-warning);
	}
	.stock.low {
		font-weight: var(--fw-medium);
	}
	.stock.out .dot {
		background: var(--ui-danger);
	}
	.row {
		display: flex;
		gap: var(--space-3);
		align-items: stretch;
	}
	.cta {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: 3.25rem;
		padding-inline: var(--space-6);
		border: 0;
		background: var(--ui-action);
		color: var(--ui-action-text);
		font: inherit;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
		transition: background var(--dur-base) var(--motion-out);
	}
	.cta:hover:not(:disabled) {
		background: var(--ui-action-hover);
	}
	.cta:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
	.cta:focus-visible,
	.wish:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.err {
		margin: 0;
		color: var(--ui-danger);
		font-size: var(--fs-sm);
	}
	.wish {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	.wish[aria-pressed='true'] :global(svg) {
		fill: var(--ui-sale);
		stroke: var(--ui-sale);
	}
	.promise {
		display: grid;
		gap: var(--space-3);
		margin: var(--space-2) 0 0;
		padding: var(--space-5) 0 0;
		list-style: none;
		border-top: 1px solid var(--ui-border);
		font-size: var(--fs-sm);
	}
	.promise li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.promise :global(svg) {
		color: var(--ui-accent);
		flex: none;
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
