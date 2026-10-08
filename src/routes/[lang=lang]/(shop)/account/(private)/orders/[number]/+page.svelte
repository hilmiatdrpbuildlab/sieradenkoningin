<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import OrderTimeline from '#lib/components/storefront/OrderTimeline.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { statusLabel } from '#lib/components/storefront/account-labels.ts';
	import { formatDate, formatPrice } from '#lib/utils/format.ts';
	import { img } from '#lib/utils/media.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
	const o = $derived(data.order);
	const fp = (c: number) => formatPrice(c, data.lang);
</script>

<Seo title={m.acct_order_title({ number: o.number })} noindex />

<a class="back" href={localizeHref('/account/orders', data.lang)}><Icon name="chevron-left" size={16} />{m.acct_back_to_orders()}</a>

<header class="head">
	<h1>{m.acct_order_title({ number: o.number })}</h1>
	<p class="meta">
		{m.acct_placed_on({ date: formatDate(o.placedAt, data.lang, { day: 'numeric', month: 'long', year: 'numeric' }) })} ·
		<strong>{statusLabel(o.status)}</strong>
	</p>
	{#if o.invoiceNumber}
		<a class="invoice" href="/api/invoices/{encodeURIComponent(o.number)}" download>
			<Icon name="download" size={18} />{m.acct_download_invoice()}
		</a>
	{/if}
</header>

<div class="layout">
	<section aria-labelledby="status-title">
		<h2 id="status-title">{m.acct_order_status()}</h2>
		<OrderTimeline steps={o.timeline} shipments={o.shipments} lang={data.lang} />
	</section>

	<section aria-labelledby="items-title">
		<h2 id="items-title">{m.acct_order_items()}</h2>
		<ul class="lines">
			{#each o.lines as l, i (i)}
				<li>
					{#if l.imageKey}<img src={img(l.imageKey, 160)} alt="" width="64" height="80" loading="lazy" />{:else}<span class="ph"></span>{/if}
					<div class="info">
						<p class="name">{l.name}</p>
						{#if l.variantLabel}<p class="sub">{l.variantLabel}</p>{/if}
						{#if l.engraving}<p class="sub">{m.acct_engraving({ text: l.engraving })}</p>{/if}
						<p class="sub">{m.acct_qty({ qty: l.qty })}</p>
					</div>
					<p class="price">{fp(l.lineTotal)}</p>
				</li>
			{/each}
		</ul>
		<dl class="totals">
			<div><dt>{m.acct_subtotal()}</dt><dd>{fp(o.totals.subtotal)}</dd></div>
			{#if o.totals.discount > 0}<div>
					<dt>{m.acct_discount()}{#if o.discountCode}&nbsp;({o.discountCode}){/if}</dt>
					<dd>−{fp(o.totals.discount)}</dd>
				</div>{/if}
			<div><dt>{m.acct_shipping()}</dt><dd>{o.totals.shipping > 0 ? fp(o.totals.shipping) : m.acct_free()}</dd></div>
			<div class="grand"><dt>{m.acct_total()}</dt><dd>{fp(o.totals.total)}</dd></div>
			<div class="vat"><dt>{m.acct_vat_included({ amount: fp(o.totals.vat) })}</dt><dd></dd></div>
			{#if o.totals.refunded > 0}<div><dt>{m.acct_refunded()}</dt><dd>−{fp(o.totals.refunded)}</dd></div>{/if}
		</dl>
	</section>

	<section aria-labelledby="addr-title" class="addr">
		<h2 id="addr-title" class="sr-only">{m.acct_addresses_title()}</h2>
		<div>
			<h3>{o.shippingMethod === 'pickup' && o.servicePoint ? m.acct_pickup_point() : m.acct_shipping_address()}</h3>
			{#if o.shippingMethod === 'pickup' && o.servicePoint}
				<address>{o.servicePoint.name}<br />{o.servicePoint.street}<br />{o.servicePoint.postalCode} {o.servicePoint.city}</address>
			{:else}
				{@const a = o.shippingAddress}
				<address>
					{a.name}<br />{#if a.company}{a.company}<br />{/if}{a.line1}<br />{#if a.line2}{a.line2}<br />{/if}{a.postalCode}
					{a.city}<br />{a.country}
				</address>
			{/if}
		</div>
		<div>
			<h3>{m.acct_billing_address()}</h3>
			{#if o.billingAddress}
				{@const b = o.billingAddress}
				<address>
					{b.name}<br />{#if b.company}{b.company}<br />{/if}{b.line1}<br />{#if b.line2}{b.line2}<br />{/if}{b.postalCode}
					{b.city}<br />{b.country}
				</address>
			{/if}
		</div>
		{#if o.giftMessage}
			<div>
				<h3>{m.acct_gift_message()}</h3>
				<p>{o.giftMessage}</p>
			</div>
		{/if}
	</section>
</div>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2.75rem;
		color: var(--ui-accent);
		font-size: var(--fs-sm);
	}
	.head {
		display: grid;
		gap: var(--space-2);
		margin: var(--space-2) 0 var(--space-8);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-3xl);
		overflow-wrap: anywhere;
	}
	.meta {
		margin: 0;
		color: var(--ui-text-muted);
	}
	.meta strong {
		color: var(--ui-text);
		font-weight: var(--fw-medium);
	}
	.invoice {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		justify-self: start;
		min-height: 2.75rem;
		color: var(--ui-accent);
	}
	.layout {
		display: grid;
		gap: var(--space-10);
	}
	@media (min-width: 80rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
		}
		.addr {
			grid-column: 1 / -1;
		}
	}
	h2 {
		margin: 0 0 var(--space-5);
		font-size: var(--fs-xl);
	}
	h3 {
		margin: 0 0 var(--space-2);
		font-size: var(--fs-xs);
		font-family: var(--ff-body);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-muted);
	}
	.lines {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--ui-border);
	}
	.lines li {
		display: grid;
		grid-template-columns: 4rem 1fr auto;
		gap: var(--space-4);
		align-items: start;
		padding-block: var(--space-4);
		border-bottom: 1px solid var(--ui-border);
	}
	.lines img,
	.ph {
		display: block;
		width: 4rem;
		height: 5rem;
		object-fit: cover;
		background: var(--ui-surface-sunken);
	}
	.info p {
		margin: 0;
	}
	.name {
		font-family: var(--ff-serif);
		font-size: var(--fs-lg);
	}
	.sub {
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.price {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.totals {
		display: grid;
		gap: var(--space-2);
		margin: var(--space-4) 0 0;
	}
	.totals div {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.totals dt,
	.totals dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.grand {
		padding-top: var(--space-2);
		border-top: 1px solid var(--ui-border);
		font-weight: var(--fw-semibold);
	}
	.vat {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.addr {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 48rem) {
		.addr {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	address,
	.addr p {
		margin: 0;
		font-style: normal;
		line-height: 1.6;
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
