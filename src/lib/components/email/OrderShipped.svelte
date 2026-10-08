<!--
  @component OrderShipped — "your order is on its way" email with track & trace (P3-05).
-->
<script lang="ts">
	import EmailLayout from './EmailLayout.svelte';
	import { EMAIL_COLORS as c, type OrderEmailData } from './types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { locale, data }: { locale: 'nl' | 'fr'; data: OrderEmailData } = $props();
	const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
	const a = $derived(data.shippingAddress);
	const t = $derived(data.tracking ?? null);
	const label = `margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.cognac};`;
</script>

<EmailLayout
	{locale}
	preheader={m.email_shipped_preheader({ number: data.number }, { locale })}
	storeName={data.storeName}
	storeEmail={data.storeEmail}
	shopUrl={data.shopUrl}
>
	<h1 style="margin:0 0 12px;font-family:{serif};font-weight:400;font-size:26px;line-height:1.25;color:{c.burgundy};">
		{m.email_shipped_title({}, { locale })}
	</h1>
	<p style="margin:0 0 16px;">{m.email_shipped_intro({ name: data.firstName }, { locale })}</p>

	<table
		role="presentation"
		width="100%"
		cellpadding="0"
		cellspacing="0"
		border="0"
		style="margin:0 0 20px;font-size:14px;"
	>
		<tbody>
			<tr>
				<td style="vertical-align:top;padding:12px 12px 12px 0;width:50%;">
					<p style={label}>{m.email_order_number({}, { locale })}</p>
					<strong>{data.number}</strong>
					{#if t?.number}
						<p style="{label}margin-top:12px;">{m.email_tracking_number({}, { locale })}</p>
						<span style="font-family:'Courier New',monospace;">{t.number}</span>
					{/if}
				</td>
				<td style="vertical-align:top;padding:12px 0;width:50%;">
					<p style={label}>
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
			</tr>
		</tbody>
	</table>

	{#if data.shippingMethod === 'pickup'}
		<p style="margin:0 0 16px;">{m.email_shipped_pickup({}, { locale })}</p>
	{/if}

	{#if t?.url}
		<p style="margin:8px 0 24px;text-align:center;">
			<a
				href={t.url}
				style="display:inline-block;padding:14px 28px;background:{c.burgundy};color:{c.cream};text-decoration:none;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;"
				>{m.email_track_parcel({}, { locale })}</a
			>
		</p>
		<p style="margin:0 0 16px;font-size:13px;color:{c.cognac};">{m.email_shipped_note({}, { locale })}</p>
	{/if}

	<p style="margin:0;font-size:13px;">
		<a href={data.orderUrl} style="color:{c.burgundy};">{m.email_view_order({}, { locale })}</a>
	</p>
</EmailLayout>
