<!--
  @component OrderSummaryTable — order lines + totals for emails (inline styles, table layout).
-->
<script lang="ts">
	import { EMAIL_COLORS as c, type OrderEmailData } from './types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { locale, data }: { locale: 'nl' | 'fr'; data: OrderEmailData } = $props();
	const cell = `padding:10px 0;border-bottom:1px solid ${c.border};vertical-align:top;`;
	const row = 'padding:4px 0;';
</script>

<table
	role="presentation"
	width="100%"
	cellpadding="0"
	cellspacing="0"
	border="0"
	style="margin:16px 0;font-size:14px;"
>
	<tbody>
		{#each data.lines as line, i (i)}
			<tr>
				<td style={cell}>
					<strong style="font-weight:600;">{line.name}</strong><br />
					<span style="color:{c.cognac};font-size:12px;"
						>{line.variantLabel} · {m.email_qty({ qty: line.qty }, { locale })}</span
					>
				</td>
				<td align="right" style="{cell}white-space:nowrap;">{line.lineTotalFormatted}</td>
			</tr>
		{/each}
		<tr
			><td style="{row}padding-top:12px;">{m.email_subtotal({}, { locale })}</td><td
				align="right"
				style="{row}padding-top:12px;">{data.subtotalFormatted}</td
			></tr
		>
		{#if data.discountFormatted}
			<tr
				><td style={row}
					>{m.email_discount({}, { locale })}{#if data.discountCode}&nbsp;({data.discountCode}){/if}</td
				><td align="right" style={row}>−{data.discountFormatted}</td></tr
			>
		{/if}
		<tr
			><td style={row}>{m.email_shipping({}, { locale })}</td><td align="right" style={row}
				>{data.shippingFormatted ?? m.email_shipping_free({}, { locale })}</td
			></tr
		>
		<tr>
			<td style="padding:10px 0 0;border-top:1px solid {c.espresso};font-weight:600;font-size:16px;"
				>{m.email_total({}, { locale })}</td
			>
			<td align="right" style="padding:10px 0 0;border-top:1px solid {c.espresso};font-weight:600;font-size:16px;"
				>{data.totalFormatted}</td
			>
		</tr>
		<tr
			><td colspan="2" style="padding:2px 0 0;font-size:12px;color:{c.cognac};"
				>{m.email_vat_included({ amount: data.vatFormatted }, { locale })}</td
			></tr
		>
	</tbody>
</table>
