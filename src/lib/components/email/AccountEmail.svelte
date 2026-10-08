<!--
  @component AccountEmail — customer-account emails (P3-01): verify email, magic login link, password
  reset, and "you already have an account" (sent instead of a second registration, so the register
  form never reveals whether an email is known).
-->
<script lang="ts">
	import EmailLayout from './EmailLayout.svelte';
	import { EMAIL_COLORS as c } from './types.ts';
	import type { AccountEmailData } from './account-types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { locale, data }: { locale: 'nl' | 'fr'; data: AccountEmailData } = $props();
	const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
	const o = $derived({ locale });

	const copy = $derived(
		{
			verify: {
				preheader: m.email_acct_verify_preheader({}, o),
				title: m.email_acct_verify_title({}, o),
				text: m.email_acct_verify_text({}, o),
				button: m.email_acct_verify_button({}, o)
			},
			login: {
				preheader: m.email_acct_login_preheader({}, o),
				title: m.email_acct_login_title({}, o),
				text: m.email_acct_login_text({}, o),
				button: m.email_acct_login_button({}, o)
			},
			reset: {
				preheader: m.email_acct_reset_preheader({}, o),
				title: m.email_acct_reset_title({}, o),
				text: m.email_acct_reset_text({}, o),
				button: m.email_acct_reset_button({}, o)
			},
			exists: {
				preheader: m.email_acct_exists_preheader({}, o),
				title: m.email_acct_exists_title({}, o),
				text: m.email_acct_exists_text({}, o),
				button: m.email_acct_exists_button({}, o)
			}
		}[data.kind]
	);
</script>

<EmailLayout {locale} preheader={copy.preheader} storeName={data.storeName} storeEmail={data.storeEmail} shopUrl={data.shopUrl}>
	<h1 style="margin:0 0 12px;font-family:{serif};font-weight:400;font-size:26px;line-height:1.25;color:{c.burgundy};">
		{copy.title}
	</h1>
	<p style="margin:0 0 12px;">
		{data.firstName ? m.email_acct_greeting_name({ name: data.firstName }, o) : m.email_acct_greeting({}, o)}
	</p>
	<p style="margin:0 0 24px;">{copy.text}</p>
	<p style="margin:0 0 24px;text-align:center;">
		<a
			href={data.url}
			style="display:inline-block;padding:14px 28px;background:{c.burgundy};color:{c.cream};text-decoration:none;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;"
			>{copy.button}</a
		>
	</p>
	{#if data.kind === 'exists' && data.secondaryUrl}
		<p style="margin:0 0 16px;text-align:center;">
			<a href={data.secondaryUrl} style="color:{c.cognac};">{m.email_acct_exists_forgot({}, o)}</a>
		</p>
	{/if}
	{#if data.kind !== 'exists'}
		<p style="margin:0 0 8px;font-size:13px;color:{c.cognac};">{m.email_acct_link_note({}, o)}</p>
		<p style="margin:0;font-size:12px;line-height:1.5;color:{c.cognac};word-break:break-all;">
			{m.email_acct_link_fallback({}, o)}<br /><a href={data.url} style="color:{c.cognac};">{data.url}</a>
		</p>
	{/if}
	<p style="margin:16px 0 0;font-size:13px;color:{c.cognac};">{m.email_acct_ignore({}, o)}</p>
</EmailLayout>
