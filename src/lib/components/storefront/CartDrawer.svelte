<!--
  @component CartDrawer — right-side drawer, full width on phones (DESIGN_SYSTEM §2.3).
  Native <dialog> gives focus-trap, Esc-to-close and inert background for free.
  Sections: header · free-shipping progress · lines · gift-wrap · promo · sticky footer.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import QuantityStepper from '#lib/components/ui/QuantityStepper.svelte';
	import PromoCode from './PromoCode.svelte';
	import PaymentMarks from './PaymentMarks.svelte';
	import { getCart } from '#lib/stores/cart.svelte.ts';
	import { formatPrice, vatIncluded } from '#lib/utils/format.ts';
	import { img } from '#lib/utils/media.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { paymentMethods = [] }: { paymentMethods?: string[] } = $props();

	const cart = getCart();
	let dialog: HTMLDialogElement;
	const L = (p: string) => localizeHref(p, cart.lang);
	const fp = (c: number) => formatPrice(c, cart.lang);

	$effect(() => {
		if (cart.open && !dialog.open) dialog.showModal();
		if (!cart.open && dialog.open) dialog.close();
	});

	const progress = $derived(Math.min(100, ((cart.freeShippingFrom - cart.toFreeShipping) / Math.max(1, cart.freeShippingFrom)) * 100));
	const total = $derived(cart.view.subtotal - cart.view.discount);
</script>

<dialog bind:this={dialog} class="drawer" aria-labelledby="cart-title" onclose={() => (cart.open = false)} onclick={(e) => e.target === dialog && (cart.open = false)}>
	<div class="panel">
		<header class="head">
			<h2 id="cart-title">{m.cart_title()} <span class="n">({cart.count})</span></h2>
			<button class="x" aria-label={m.cart_close()} onclick={() => (cart.open = false)}><Icon name="close" /></button>
		</header>

		{#if cart.lines.length === 0}
			<div class="empty">
				<Icon name="crown" size={40} stroke={1} class="orn" />
				<p class="h3">{m.cart_empty_title()}</p>
				<p class="muted">{m.cart_empty_text()}</p>
				<Button href={L('/collections/nieuw')} onclick={() => (cart.open = false)}>{m.cart_empty_cta()}</Button>
			</div>
		{:else}
			<div class="ship" role="status">
				{#if cart.toFreeShipping > 0}
					<p>{m.cart_to_free_shipping({ amount: fp(cart.toFreeShipping) })}</p>
				{:else}
					<p><Icon name="sparkle" size={12} /> {m.cart_free_shipping()}</p>
				{/if}
				<div class="bar" aria-hidden="true"><span style:width="{progress}%"></span></div>
			</div>

			<ul class="lines" aria-busy={cart.pending}>
				{#each cart.lines as line (line.id)}
					<li class="line">
						<a href={L(`/p/${line.slug}`)} class="thumb" tabindex="-1">
							{#if line.imageKey}<img src={img(line.imageKey, 200)} alt="" width="96" height="120" loading="lazy" />{/if}
						</a>
						<div class="info">
							<a href={L(`/p/${line.slug}`)} class="name">{line.name}</a>
							<p class="variant">{line.variantLabel}</p>
							{#if !line.available}<p class="warn"><Icon name="alert" size={12} /> {m.cart_line_unavailable()}</p>{/if}
							<div class="row">
								<QuantityStepper
									size="sm"
									value={line.quantity}
									min={0}
									max={Math.max(line.maxQuantity, 0)}
									label={m.ui_quantity_for({ name: line.name })}
									onchange={(n) => cart.setQuantity(line.id, n)}
								/>
								<span class="price">{fp(line.unitPrice * line.quantity)}</span>
							</div>
							<div class="line-actions">
								<label class="gift"><input type="checkbox" checked={line.giftWrap} onchange={(e) => cart.setGiftWrap(line.id, e.currentTarget.checked)} /> {m.cart_gift_wrap()}</label>
								<button class="remove" aria-label={m.cart_remove_item({ name: line.name })} onclick={() => cart.remove(line.id)}>{m.cart_remove()}</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>

			<footer class="foot">
				<div class="gift-note"><Icon name="gift" size={18} /> {m.cart_gift_note()}</div>
				<PromoCode />
				<dl class="totals">
					<dt>{m.cart_subtotal()}</dt>
					<dd>{fp(cart.subtotal)}</dd>
					{#if cart.view.discount > 0}<dt>{m.cart_discount()}</dt><dd>−{fp(cart.view.discount)}</dd>{/if}
				</dl>
				<p class="tax">{m.cart_vat_included({ amount: fp(vatIncluded(total)) })} · {m.cart_vat_note()}</p>
				<Button href={L('/checkout')} full size="lg">{m.cart_checkout()}</Button>
				<div class="links">
					<a href={L('/cart')} onclick={() => (cart.open = false)}>{m.cart_view_cart()}</a>
					<button class="continue" onclick={() => (cart.open = false)}>{m.cart_continue()}</button>
				</div>
				<PaymentMarks methods={paymentMethods} />
			</footer>
		{/if}
	</div>
</dialog>

<style>
	.drawer {
		margin: 0 0 0 auto;
		padding: 0;
		width: var(--drawer-w);
		max-width: 100vw;
		height: 100dvh;
		max-height: 100dvh;
		border: 0;
		background: var(--ui-bg);
		color: var(--ui-text);
		box-shadow: var(--elev-xl);
	}
	.drawer::backdrop {
		background: var(--ui-overlay);
		backdrop-filter: blur(2px);
	}
	.drawer[open] {
		animation: slide-in var(--dur-slow) var(--motion-out);
	}
	.drawer[open]::backdrop {
		animation: fade var(--dur-slow) var(--motion-out);
	}
	@keyframes slide-in {
		from {
			transform: translateX(100%);
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-5) var(--space-6);
		border-bottom: 1px solid var(--ui-border);
	}
	.head h2 {
		font-size: var(--fs-xl);
		margin: 0;
	}
	.n {
		font-family: var(--ff-body);
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.x {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		background: none;
		border: 0;
		color: inherit;
		cursor: pointer;
		margin-right: -0.75rem;
	}
	.empty {
		flex: 1;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: var(--space-4);
		padding: var(--space-8);
		text-align: center;
	}
	.empty :global(.orn) {
		color: var(--ui-ornament);
	}
	.empty .h3 {
		font-family: var(--ff-display);
		font-size: var(--fs-2xl);
		margin: 0;
	}
	.muted {
		color: var(--ui-text-muted);
		margin: 0 0 var(--space-4);
	}

	.ship {
		padding: var(--space-4) var(--space-6);
		background: var(--ui-surface-sunken);
		font-size: var(--fs-xs);
	}
	.ship p {
		margin: 0 0 var(--space-2);
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.bar {
		height: 2px;
		background: var(--ui-border);
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--ui-gold-gradient);
		transition: width var(--dur-slow) var(--motion-out);
	}

	.lines {
		flex: 1;
		overflow-y: auto;
		list-style: none;
		margin: 0;
		padding: 0 var(--space-6);
		overscroll-behavior: contain;
	}
	.lines[aria-busy='true'] {
		opacity: 0.7;
	}
	.line {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: var(--space-4);
		padding-block: var(--space-5);
		border-bottom: 1px solid var(--ui-border);
	}
	.thumb {
		display: block;
		width: 6rem;
		aspect-ratio: var(--ratio-product);
		background: var(--ui-surface-sunken);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.name {
		font-family: var(--ff-display);
		font-size: var(--fs-base);
		text-decoration: none;
	}
	.variant {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.warn {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-danger);
		display: flex;
		gap: 4px;
		align-items: center;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: auto;
		padding-top: var(--space-2);
	}
	.price {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	.line-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
	}
	.gift {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.gift input {
		accent-color: var(--ui-action);
		width: 1rem;
		height: 1rem;
	}
	.remove {
		background: none;
		border: 0;
		min-height: 2.75rem;
		padding: 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.foot {
		padding: var(--space-5) var(--space-6) calc(var(--space-5) + env(safe-area-inset-bottom));
		border-top: 1px solid var(--ui-border);
		background: var(--ui-surface);
		display: grid;
		gap: var(--space-3);
		max-height: 60dvh;
		overflow-y: auto;
	}
	.gift-note {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.gift-note :global(svg) {
		color: var(--ui-accent);
	}
	.totals {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-1);
		margin: 0;
		font-size: var(--fs-base);
		font-weight: var(--fw-medium);
	}
	.totals dd {
		margin: 0;
		text-align: right;
	}
	.tax {
		margin: 0;
		font-size: var(--fs-2xs);
		color: var(--ui-text-muted);
	}
	.links {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.links a,
	.continue {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		background: none;
		border: 0;
		color: var(--ui-text);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		cursor: pointer;
		padding: 0;
	}
</style>
