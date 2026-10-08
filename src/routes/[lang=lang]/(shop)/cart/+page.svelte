<!--
  Cart page (P2-02). Server-rendered from `data.cart`; after hydration the shared cart store (the
  same one the drawer uses) takes over. Every control is a real <form> posting to an action, so the
  page works without JavaScript; with JS the submit is intercepted and handled by the store.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import QuantityStepper from '#lib/components/ui/QuantityStepper.svelte';
	import FreeShippingBar from '#lib/components/storefront/FreeShippingBar.svelte';
	import PaymentMarks from '#lib/components/storefront/PaymentMarks.svelte';
	import ProductRail from '#lib/components/storefront/ProductRail.svelte';
	import { promoMessage } from '#lib/components/storefront/promo-messages.ts';
	import { getCart } from '#lib/stores/cart.svelte.ts';
	import { formatPrice, vatIncluded } from '#lib/utils/format.ts';
	import { img } from '#lib/utils/media.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();

	const cart = getCart();
	// Server data first (SSR + no-JS); the store is the source of truth once hydrated.
	// svelte-ignore state_referenced_locally
	cart.sync(data.cart);
	$effect.pre(() => cart.sync(data.cart));

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	const lang = $derived(data.lang);
	const L = (p: string) => localizeHref(p, data.lang);
	const fp = (c: number) => formatPrice(c, data.lang);
	const view = $derived(cart.view);
	const total = $derived(view.subtotal - view.discount + view.shippingEstimate);

	let code = $state('');
	let codeError = $state<string | null>(null);
	const shownCodeError = $derived(
		codeError ??
			(form?.codeError
				? promoMessage(form.codeError, form.minSubtotal, lang)
				: view.discountError
					? promoMessage(view.discountError, null, lang)
					: null)
	);

	async function applyCode(e: SubmitEvent) {
		e.preventDefault();
		if (!code.trim()) return;
		const r = await cart.applyCode(code);
		codeError = r.ok ? null : promoMessage(r.error, r.minSubtotal, lang);
		if (r.ok) code = '';
	}
	function removeCode(e: SubmitEvent) {
		e.preventDefault();
		codeError = null;
		cart.removeCode();
	}
	function removeLine(e: SubmitEvent, id: string) {
		e.preventDefault();
		cart.remove(id);
	}
</script>

<Seo title={m.cart_page_title()} noindex />

<div class="page container-lux">
	<h1>
		{m.cart_page_title()}
		{#if view.count}<span class="n">({m.cart_items({ count: view.count })})</span>{/if}
	</h1>

	{#if view.lines.length === 0}
		<div class="empty">
			<Icon name="crown" size={40} stroke={1} class="orn" />
			<p class="h3">{m.cart_empty_title()}</p>
			<p class="muted">{m.cart_empty_text()}</p>
			<Button href={L('/collections/nieuw')}>{m.cart_empty_cta()}</Button>
		</div>
	{:else}
		<div class="grid">
			<section aria-label={m.cart_title()}>
				<FreeShippingBar remaining={view.toFreeShipping} threshold={view.freeShippingFrom} {lang} />
				<ul class="lines" aria-busy={cart.pending}>
					{#each view.lines as line (line.id)}
						<li class="line">
							<a href={L(`/p/${line.slug}`)} class="thumb" tabindex="-1" aria-hidden="true">
								{#if line.imageKey}<img
										src={img(line.imageKey, 300)}
										alt=""
										width="120"
										height="150"
										loading="lazy"
									/>{/if}
							</a>
							<div class="info">
								<a href={L(`/p/${line.slug}`)} class="name">{line.name}</a>
								<p class="meta">{line.variantLabel}</p>
								<p class="meta">{m.cart_item_price({ price: fp(line.unitPrice) })}</p>
								{#if !line.available}<p class="warn">
										<Icon name="alert" size={12} />
										{m.cart_line_unavailable()}
									</p>{/if}
								<div class="row">
									<form method="POST" action="?/qty" class="qty" onsubmit={(e) => e.preventDefault()}>
										<input type="hidden" name="lineId" value={line.id} />
										<QuantityStepper
											size="sm"
											name="qty"
											value={line.quantity}
											min={0}
											max={Math.max(line.maxQuantity, line.quantity, 0)}
											label={m.ui_quantity_for({ name: line.name })}
											onchange={(n) => cart.setQuantity(line.id, n)}
										/>
										{#if !hydrated}<button class="textbtn">{m.cart_update()}</button>{/if}
									</form>
									<span class="price">{fp(line.unitPrice * line.quantity)}</span>
								</div>
								<div class="actions">
									<form method="POST" action="?/gift" class="gift">
										<input type="hidden" name="lineId" value={line.id} />
										<label>
											<input
												type="checkbox"
												name="giftWrap"
												checked={line.giftWrap}
												onchange={(e) => cart.setGiftWrap(line.id, e.currentTarget.checked)}
											/>
											{m.cart_gift_wrap()}
										</label>
										{#if !hydrated}<button class="textbtn">{m.cart_update()}</button>{/if}
									</form>
									<form method="POST" action="?/remove" onsubmit={(e) => removeLine(e, line.id)}>
										<input type="hidden" name="lineId" value={line.id} />
										<button class="textbtn" aria-label={m.cart_remove_item({ name: line.name })}
											>{m.cart_remove()}</button
										>
									</form>
								</div>
							</div>
						</li>
					{/each}
				</ul>
				<p class="gift-note"><Icon name="gift" size={18} /> {m.cart_gift_note()}</p>
			</section>

			<aside class="summary" aria-labelledby="cart-summary">
				<h2 id="cart-summary">{m.cart_summary()}</h2>
				{#if view.discountCode && !view.discountError}
					<form method="POST" action="?/removeCode" class="applied" onsubmit={removeCode}>
						<span role="status"><Icon name="tag" size={14} /> {m.cart_promo_applied({ code: view.discountCode })}</span>
						<button class="x" aria-label={m.cart_promo_remove({ code: view.discountCode })}
							><Icon name="close" size={14} /></button
						>
					</form>
				{:else}
					<form method="POST" action="?/code" class="promo" onsubmit={applyCode}>
						<label for="cart-promo" class="lbl">{m.cart_promo_label()}</label>
						<div class="promo-row">
							<input
								id="cart-promo"
								name="code"
								bind:value={code}
								autocomplete="off"
								autocapitalize="characters"
								aria-invalid={!!shownCodeError || undefined}
								aria-describedby={shownCodeError ? 'cart-promo-e' : undefined}
							/>
							<button type="submit" disabled={cart.pending}>{m.cart_promo_apply()}</button>
						</div>
						{#if shownCodeError}<p id="cart-promo-e" class="err" role="alert">{shownCodeError}</p>{/if}
					</form>
				{/if}
				<dl class="totals">
					<dt>{m.cart_subtotal()}</dt>
					<dd>{fp(view.subtotal)}</dd>
					{#if view.discount > 0}<dt>{m.cart_discount()}</dt>
						<dd>−{fp(view.discount)}</dd>{/if}
					<dt>{m.cart_shipping_estimate()}</dt>
					<dd>{view.shippingEstimate === 0 ? m.cart_shipping_free() : fp(view.shippingEstimate)}</dd>
					<dt class="grand">{m.cart_total()}</dt>
					<dd class="grand">{fp(total)}</dd>
				</dl>
				<p class="tax">{m.cart_vat_included({ amount: fp(vatIncluded(total)) })}</p>
				<Button href={L('/checkout')} full size="lg">{m.cart_checkout()}</Button>
				<a class="continue" href={L('/collections/nieuw')}>{m.cart_continue()}</a>
				<p class="secure"><Icon name="lock" size={14} /> {m.cart_secure()}</p>
				<PaymentMarks methods={data.paymentMethods} />
			</aside>
		</div>
	{/if}
</div>

{#if data.upsell.length}
	<ProductRail title={m.cart_upsell()} products={data.upsell} />
{/if}

<style>
	.page {
		padding-block: var(--space-10) var(--space-16);
	}
	h1 {
		font-size: var(--fs-3xl);
		margin: 0 0 var(--space-8);
	}
	.n {
		font-family: var(--ff-body);
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
		font-weight: var(--fw-regular);
	}
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		padding: var(--space-16) var(--space-4);
		text-align: center;
	}
	.empty :global(.orn) {
		color: var(--ui-ornament);
	}
	.h3 {
		font-family: var(--ff-display);
		font-size: var(--fs-2xl);
		margin: 0;
	}
	.muted {
		color: var(--ui-text-muted);
		margin: 0 0 var(--space-4);
	}
	.grid {
		display: grid;
		gap: var(--space-10);
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: minmax(0, 1fr) 24rem;
			align-items: start;
		}
		.summary {
			position: sticky;
			top: calc(var(--header-h, 5rem) + var(--space-6));
		}
	}
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.lines[aria-busy='true'] {
		opacity: 0.7;
	}
	.line {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: var(--space-4);
		padding-block: var(--space-6);
		border-bottom: 1px solid var(--ui-border);
	}
	@media (min-width: 48rem) {
		.line {
			grid-template-columns: 7.5rem 1fr;
			gap: var(--space-6);
		}
	}
	.thumb {
		display: block;
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
		font-size: var(--fs-lg);
		text-decoration: none;
	}
	.meta {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.warn {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-danger);
		display: flex;
		gap: var(--space-1);
		align-items: center;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-top: var(--space-3);
	}
	.qty {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.price {
		font-weight: var(--fw-medium);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
	}
	.gift label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.gift {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.gift input {
		accent-color: var(--ui-action);
		width: 1rem;
		height: 1rem;
	}
	.textbtn {
		background: none;
		border: 0;
		min-height: 2.75rem;
		padding: 0;
		color: var(--ui-text-muted);
		font: inherit;
		font-size: var(--fs-xs);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
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
	.summary {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-6);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
	}
	.summary h2 {
		font-size: var(--fs-xl);
		margin: 0;
	}
	.lbl {
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-muted);
	}
	.promo {
		display: grid;
		gap: var(--space-1);
	}
	.promo-row {
		display: flex;
		border: 1px solid var(--ui-border-strong);
	}
	.promo-row input {
		flex: 1;
		min-width: 0;
		height: 2.75rem;
		padding: 0 var(--space-3);
		border: 0;
		background: transparent;
		font: inherit;
		font-size: var(--fs-sm);
		text-transform: uppercase;
		color: var(--ui-text);
	}
	.promo-row input:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: -2px;
	}
	.promo-row button {
		padding: 0 var(--space-4);
		border: 0;
		border-left: 1px solid var(--ui-border-strong);
		background: none;
		color: var(--ui-text);
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	.err {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-danger);
	}
	.applied {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--fs-xs);
		color: var(--ui-success);
	}
	.applied span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.x {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		border: 0;
		background: none;
		color: var(--ui-text-muted);
		cursor: pointer;
	}
	.totals {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--fs-sm);
	}
	.totals dd {
		margin: 0;
		text-align: right;
	}
	.totals .grand {
		padding-top: var(--space-3);
		border-top: 1px solid var(--ui-border);
		font-size: var(--fs-base);
		font-weight: var(--fw-semibold);
	}
	.tax,
	.secure {
		margin: 0;
		font-size: var(--fs-2xs);
		color: var(--ui-text-muted);
	}
	.secure {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.continue {
		justify-self: center;
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--ui-text);
	}
</style>
