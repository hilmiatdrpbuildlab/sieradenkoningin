<!--
  @component RefundIssued — refund confirmation email (P3-06), full or partial.
-->
<script lang="ts">
	import EmailLayout from './EmailLayout.svelte';
	import { EMAIL_COLORS as c, type OrderEmailData } from './types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { locale, data }: { locale: 'nl' | 'fr'; data: OrderEmailData } = $props();
	const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
	const amount = $derived(data.refund?.amountFormatted ?? '');
	const label = `margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.cognac};`;
</script>

<EmailLayout
	{locale}
	preheader={m.email_refund_preheader({ number: data.number, amount }, { locale })}
	storeName={data.storeName}
	storeEmail={data.storeEmail}
	shopUrl={data.shopUrl}
>
	<h1 style="margin:0 0 12px;font-family:{serif};font-weight:400;font-size:26px;line-height:1.25;color:{c.burgundy};">
		{m.email_refund_title({}, { locale })}
	</h1>
	<p style="margin:0 0 12px;">{m.email_refund_intro({ name: data.firstName, amount }, { locale })}</p>
	<p style="margin:0 0 16px;">
		{data.refund?.full ? m.email_refund_full({}, { locale }) : m.email_refund_partial({}, { locale })}
	</p>

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
				</td>
				<td style="vertical-align:top;padding:12px 0;width:50%;">
					<p style={label}>{m.email_refund_amount({}, { locale })}</p>
					<strong style="font-size:18px;">{amount}</strong>
				</td>
			</tr>
		</tbody>
	</table>

	<p style="margin:0 0 16px;font-size:13px;color:{c.cognac};">{m.email_refund_timing({}, { locale })}</p>
	<p style="margin:0;font-size:13px;">
		<a href={data.orderUrl} style="color:{c.burgundy};">{m.email_view_order({}, { locale })}</a>
	</p>
</EmailLayout>
