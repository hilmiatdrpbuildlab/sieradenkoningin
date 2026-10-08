<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import TokenConfirm from '#lib/components/storefront/TokenConfirm.svelte';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
</script>

<Seo title={m.acct_magic_page_title()} noindex />

<TokenConfirm
	title={m.acct_magic_page_title()}
	lead={m.acct_magic_page_lead()}
	button={m.acct_login_submit()}
	token={data.token}
	next={data.next}
	invalid={!data.valid || !!(form && 'expired' in form)}
	invalidText={m.acct_link_invalid()}
	againHref={localizeHref('/account/login', data.lang)}
	againLabel={m.acct_request_new_link()}
/>
