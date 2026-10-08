<!--
  @component OrderConfirmation — "thank you, we received your payment" email (P2-08).
-->
<script lang="ts">
	import EmailLayout from './EmailLayout.svelte';
	import OrderSummaryTable from './OrderSummaryTable.svelte';
	import { EMAIL_COLORS as c, type OrderEmailData } from './types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { locale, data }: { locale: 'nl' | 'fr'; data: OrderEmailData } = $props();
	const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
	const a = $derived(data.shippingAddress);
</script>

<EmailLayout
	{locale}
	preheader={m.email_order_confirmation_preheader({ number: data.number }, { locale })}
	storeName={data.storeName}
	storeEmail={data.storeEmail}
	shopUrl={data.shopUrl}
>
	<h1 style="margin:0 0 12px;font-family:{serif};font-weight:400;font-size:26px;line-height:1.25;color:{c.burgundy};">
		{m.email_order_confirmation_title({}, { locale })}
	</h1>
	<p style="margin:0 0 12px;">{m.email_order_confirmation_intro({ name: data.firstName }, { locale })}</p>
	<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:{c.cognac};">
		{m.email_order_number({}, { locale })}
	</p>
	<p style="margin:0 0 16px;font-size:18px;font-weight:600;">{data.number}</p>

	<OrderSummaryTable {locale} {data} />

	<table
		role="presentation"
		width="100%"
		cellpadding="0"
		cellspacing="0"
		border="0"
		style="margin:8px 0 20px;font-size:14px;"
	>
		<tbody>
			<tr>
				<td style="vertical-align:top;padding:12px 12px 12px 0;width:50%;">
					<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:{c.cognac};">
						{data.shippingMethod === 'pickup'
							? m.email_pickup_point({}, { locale })
							: m.email_delivery_address({}, { locale })}
					</p>
					{#if data.shippingMethod === 'pickup' && data.servicePoint}
						{data.servicePoint.name}<br />{data.servicePoint.street}<br />{data.servicePoint.postalCode}
						{data.servicePoint.city}
					{:else}
						{a.name}<br />{#if a.company}{a.company}<br />{/if}{a.line1}<br />{#if a.line2}{a.line2}<br
							/>{/if}{a.postalCode}
						{a.city}
					{/if}
				</td>
				<td style="vertical-align:top;padding:12px 0;width:50%;">
					<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:{c.cognac};">
						{m.email_delivery_estimate({}, { locale })}
					</p>
					{data.deliveryEstimate}
				</td>
			</tr>
		</tbody>
	</table>

	{#if data.giftWrap || data.giftMessage}
		<p style="margin:0 0 20px;padding:12px 16px;border-left:2px solid {c.gold};background:{c.cream};font-size:14px;">
			{m.email_gift_wrapped({}, { locale })}{#if data.giftMessage}<br /><em>“{data.giftMessage}”</em>{/if}
		</p>
	{/if}

	<p style="margin:0 0 24px;text-align:center;">
		<a
			href={data.orderUrl}
			style="display:inline-block;padding:14px 28px;background:{c.burgundy};color:{c.cream};text-decoration:none;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;"
			>{m.email_view_order({}, { locale })}</a
		>
	</p>
	<p style="margin:0;font-size:13px;color:{c.cognac};">{m.email_returns_note({ days: data.returnDays }, { locale })}</p>
</EmailLayout>
