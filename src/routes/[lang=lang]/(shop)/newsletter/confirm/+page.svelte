<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
</script>

<Seo title={data.ok ? m.newsletter_confirm_title() : m.newsletter_page_title()} noindex />

<section class="msg container-lux">
	<Icon name={data.ok ? 'crown' : 'info'} size={32} stroke={1} class="orn" />
	{#if data.ok}
		<h1>{m.newsletter_confirm_title()}</h1>
		<p role="status">{m.newsletter_confirm_text()}</p>
	{:else}
		<h1>{m.newsletter_page_title()}</h1>
		<p role="alert">{m.newsletter_confirm_invalid()}</p>
	{/if}
	<Button href="/{data.lang}" variant="outline">{m.newsletter_back()}</Button>
</section>

<style>
	.msg {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		max-width: 40rem;
		padding-block: var(--section-y-sm);
		text-align: center;
	}
	.msg :global(.orn) {
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
</style>
