<!--
  @component BackInStock — "your jewel is back" alert (P3-09). Sent once per stock_alerts row.
-->
<script lang="ts">
	import EmailLayout from './EmailLayout.svelte';
	import { EMAIL_COLORS as c } from './types.ts';
	import type { BackInStockEmailData } from './account-types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { locale, data }: { locale: 'nl' | 'fr'; data: BackInStockEmailData } = $props();
	const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
	const o = $derived({ locale });
</script>

<EmailLayout
	{locale}
	preheader={m.email_bis_preheader({ name: data.productName }, o)}
	storeName={data.storeName}
	storeEmail={data.storeEmail}
	shopUrl={data.shopUrl}
>
	<h1 style="margin:0 0 12px;font-family:{serif};font-weight:400;font-size:26px;line-height:1.25;color:{c.burgundy};">
		{m.email_bis_title({}, o)}
	</h1>
	<p style="margin:0 0 16px;">{m.email_bis_text({}, o)}</p>
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid {c.border};border-bottom:1px solid {c.border};">
		<tbody>
			<tr>
				<td style="padding:16px 0;">
					<div style="font-family:{serif};font-size:20px;color:{c.espresso};">{data.productName}</div>
					{#if data.variantLabel}<div style="margin-top:4px;font-size:13px;color:{c.cognac};">{data.variantLabel}</div>{/if}
				</td>
			</tr>
		</tbody>
	</table>
	<p style="margin:0 0 24px;text-align:center;">
		<a
			href={data.productUrl}
			style="display:inline-block;padding:14px 28px;background:{c.burgundy};color:{c.cream};text-decoration:none;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;"
			>{m.email_bis_button({}, o)}</a
		>
	</p>
	<p style="margin:0;font-size:13px;color:{c.cognac};">{m.email_bis_note({}, o)}</p>
</EmailLayout>
