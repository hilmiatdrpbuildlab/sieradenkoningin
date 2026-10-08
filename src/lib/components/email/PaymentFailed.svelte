<!--
  @component PaymentFailed — payment failed / cancelled / expired email with a retry link (P2-08).
-->
<script lang="ts">
	import EmailLayout from './EmailLayout.svelte';
	import OrderSummaryTable from './OrderSummaryTable.svelte';
	import { EMAIL_COLORS as c, type OrderEmailData } from './types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { locale, data }: { locale: 'nl' | 'fr'; data: OrderEmailData } = $props();
	const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
</script>

<EmailLayout
	{locale}
	preheader={m.email_payment_failed_preheader({ number: data.number }, { locale })}
	storeName={data.storeName}
	storeEmail={data.storeEmail}
	shopUrl={data.shopUrl}
>
	<h1 style="margin:0 0 12px;font-family:{serif};font-weight:400;font-size:26px;line-height:1.25;color:{c.burgundy};">
		{m.email_payment_failed_title({}, { locale })}
	</h1>
	<p style="margin:0 0 12px;">{m.email_payment_failed_intro({ name: data.firstName }, { locale })}</p>
	<p style="margin:0 0 16px;">{m.email_payment_failed_text({}, { locale })}</p>
	<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:{c.cognac};">
		{m.email_order_number({}, { locale })}
	</p>
	<p style="margin:0 0 8px;font-size:18px;font-weight:600;">{data.number}</p>

	<OrderSummaryTable {locale} {data} />

	<p style="margin:8px 0 24px;text-align:center;">
		<a
			href={data.orderUrl}
			style="display:inline-block;padding:14px 28px;background:{c.burgundy};color:{c.cream};text-decoration:none;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;"
			>{m.email_retry_payment({}, { locale })}</a
		>
	</p>
	<p style="margin:0;font-size:13px;color:{c.cognac};">{m.email_payment_failed_note({}, { locale })}</p>
</EmailLayout>
