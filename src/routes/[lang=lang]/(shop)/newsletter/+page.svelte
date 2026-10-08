<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import NewsletterForm from '#lib/components/storefront/NewsletterForm.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
</script>

<Seo title={m.newsletter_page_title()} description={m.newsletter_page_text()} noindex />

<section class="nlp container-lux">
	<Icon name="sparkle" size={22} class="orn" />
	{#if form && 'ok' in form}
		<h1>{m.newsletter_check_title()}</h1>
		<p role="status">{m.newsletter_check_text()}</p>
	{:else}
		<h1>{m.newsletter_title()}</h1>
		<p>{m.newsletter_page_text()}</p>
		{#if form && 'reason' in form}
			<p class="err" role="alert">{form.reason === 'invalid' ? m.newsletter_invalid() : m.newsletter_error()}</p>
		{/if}
		<NewsletterForm lang={data.lang} source="page" />
	{/if}
</section>

<style>
	.nlp {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		max-width: 40rem;
		padding-block: var(--section-y-sm);
		text-align: center;
	}
	.nlp :global(.orn) {
		color: var(--ui-ornament);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-3xl);
	}
	p {
		margin: 0;
		color: var(--ui-text-muted);
	}
	.err {
		color: var(--ui-danger);
	}
</style>
