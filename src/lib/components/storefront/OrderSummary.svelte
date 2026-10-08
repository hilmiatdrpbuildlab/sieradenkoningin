<!--
  @component OrderSummary — lines + totals. Phones: a collapsible <details> (total in the toggle);
  ≥ 64rem: always expanded (the page makes it sticky). Used by checkout and the thank-you page.
-->
<script lang="ts">
	import { formatPrice } from '#lib/utils/format.ts';
	import { img } from '#lib/utils/media.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Line {
		name: string;
		variantLabel: string;
		qty: number;
		lineTotal: number;
		imageKey: string | null;
		giftWrap?: boolean;
	}
	interface Props {
		lines: Line[];
		totals: { subtotal: number; discount: number; shipping: number; total: number; vat: number };
		discountCode?: string | null;
		lang: 'nl' | 'fr';
		editHref?: string | null;
		title?: string;
	}
	let { lines, totals, discountCode = null, lang, editHref = null, title }: Props = $props();
	const fp = (c: number) => formatPrice(c, lang);
	const count = $derived(lines.reduce((n, l) => n + l.qty, 0));
	const heading = $derived(title ?? m.checkout_summary_title());
</script>

{#snippet body()}
	<ul class="lines">
		{#each lines as line, i (i)}
			<li>
				<span class="thumb">
					{#if line.imageKey}<img src={img(line.imageKey, 160)} alt="" width="56" height="70" loading="lazy" />{/if}
					<span class="qty" aria-hidden="true">{line.qty}</span>
				</span>
				<span class="info">
					<span class="name">{line.name}</span>
					<span class="meta"
						>{line.variantLabel}<span class="sr">, {m.checkout_summary_qty({ qty: line.qty })}</span>{#if line.giftWrap}
							· {m.cart_gift_wrap()}{/if}</span
					>
				</span>
				<span class="price">{fp(line.lineTotal)}</span>
			</li>
		{/each}
	</ul>
	<dl class="totals">
		<dt>{m.cart_subtotal()}</dt>
		<dd>{fp(totals.subtotal)}</dd>
		{#if totals.discount > 0}
			<dt>
				{m.cart_discount()}{#if discountCode}
					({discountCode}){/if}
			</dt>
			<dd>−{fp(totals.discount)}</dd>
		{/if}
		<dt>{m.cart_shipping()}</dt>
		<dd>{totals.shipping === 0 ? m.cart_shipping_free() : fp(totals.shipping)}</dd>
		<dt class="grand">{m.cart_total()}</dt>
		<dd class="grand">{fp(totals.total)}</dd>
	</dl>
	<p class="tax">{m.cart_vat_included({ amount: fp(totals.vat) })}</p>
	{#if editHref}<a class="edit" href={editHref}>{m.checkout_edit_cart()}</a>{/if}
{/snippet}

<details class="mobile">
	<summary>
		<span>{heading} <span class="count">({m.cart_items({ count })})</span></span>
		<strong>{fp(totals.total)}</strong>
	</summary>
	<div class="content">{@render body()}</div>
</details>

<section class="desktop" aria-labelledby="order-summary-title">
	<h2 id="order-summary-title">{heading} <span class="count">({m.cart_items({ count })})</span></h2>
	{@render body()}
</section>

<style>
	.mobile,
	.desktop {
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
	}
	.desktop {
		display: none;
		padding: var(--space-6);
	}
	@media (min-width: 64rem) {
		.mobile {
			display: none;
		}
		.desktop {
			display: block;
		}
	}
	summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-4);
		min-height: 3rem;
		padding: var(--space-3) var(--space-4);
		cursor: pointer;
		font-size: var(--fs-sm);
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::after {
		content: '';
		width: 0.5rem;
		height: 0.5rem;
		border: solid currentColor;
		border-width: 0 1px 1px 0;
		transform: rotate(45deg);
		margin-left: var(--space-2);
	}
	details[open] summary::after {
		transform: rotate(-135deg);
	}
	summary:focus-visible {
		outline: none;
		box-shadow: var(--elev-focus);
	}
	.content {
		padding: 0 var(--space-4) var(--space-4);
	}
	h2 {
		font-size: var(--fs-xl);
		margin: 0 0 var(--space-4);
	}
	.count {
		font-family: var(--ff-body);
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		font-weight: var(--fw-regular);
	}
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.lines li {
		display: grid;
		grid-template-columns: 3.5rem 1fr auto;
		gap: var(--space-3);
		align-items: center;
		padding-block: var(--space-3);
		border-bottom: 1px solid var(--ui-border);
	}
	.thumb {
		position: relative;
		display: block;
		aspect-ratio: var(--ratio-product);
		background: var(--ui-surface-sunken);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.qty {
		position: absolute;
		top: calc(-1 * var(--space-2));
		right: calc(-1 * var(--space-2));
		min-width: 1.25rem;
		height: 1.25rem;
		display: grid;
		place-items: center;
		border-radius: var(--r-full);
		background: var(--ui-action);
		color: var(--ui-action-text);
		font-size: var(--fs-2xs);
	}
	.info {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-family: var(--ff-display);
		font-size: var(--fs-sm);
	}
	.meta {
		font-size: var(--fs-2xs);
		color: var(--ui-text-muted);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.price {
		font-size: var(--fs-sm);
	}
	.totals {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
		margin: var(--space-4) 0 0;
		font-size: var(--fs-sm);
	}
	.totals dd {
		margin: 0;
		text-align: right;
	}
	.grand {
		padding-top: var(--space-3);
		border-top: 1px solid var(--ui-border);
		font-size: var(--fs-base);
		font-weight: var(--fw-semibold);
	}
	.tax {
		margin: var(--space-2) 0 0;
		font-size: var(--fs-2xs);
		color: var(--ui-text-muted);
	}
	.edit {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-size: var(--fs-xs);
		color: var(--ui-text);
		text-underline-offset: 3px;
	}
</style>
