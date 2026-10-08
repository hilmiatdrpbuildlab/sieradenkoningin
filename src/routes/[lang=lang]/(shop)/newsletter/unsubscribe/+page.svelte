<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
</script>

<Seo title={m.newsletter_unsub_title()} noindex />

<section class="msg container-lux">
	{#if form && 'done' in form}
		<h1>{m.newsletter_unsub_title()}</h1>
		<p role="status">{m.newsletter_unsub_text()}</p>
		<Button href="/{data.lang}" variant="outline">{m.newsletter_back()}</Button>
	{:else if !data.valid || (form && 'invalid' in form)}
		<h1>{m.newsletter_page_title()}</h1>
		<p role="alert">{m.newsletter_unsub_invalid()}</p>
		<Button href="/{data.lang}" variant="outline">{m.newsletter_back()}</Button>
	{:else}
		<h1>{m.newsletter_page_title()}</h1>
		<p>{m.newsletter_unsub_question()}</p>
		<form method="POST">
			<input type="hidden" name="token" value={data.token} />
			<Button type="submit">{m.newsletter_unsub_button()}</Button>
		</form>
	{/if}
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
	h1 {
		margin: 0;
		font-size: var(--fs-3xl);
	}
	p {
		margin: 0;
		color: var(--ui-text-muted);
	}
</style>
