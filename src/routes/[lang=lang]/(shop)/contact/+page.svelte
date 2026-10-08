<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import ContactForm from '#lib/components/blocks/ContactForm.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	// Without JS the action result arrives here (with JS, ContactForm handles it inline).
	const errors = $derived(
		form && 'errors' in form ? Object.values(form.errors as Record<string, string[]>).flat() : []
	);
</script>

<Seo title={m.contact_title()} description={m.contact_meta_description()} />

<header class="head container-lux">
	<h1>{m.contact_title()}</h1>
	<p>{m.contact_intro()}</p>
</header>

{#if form && 'sent' in form}
	<p class="ok container-lux" role="status">{m.contact_sent()}</p>
{:else}
	{#if form}
		<div class="bad container-lux" role="alert">
			<p>{form && 'rate' in form ? m.contact_rate() : m.contact_error()}</p>
			{#if errors.length}<ul>
					{#each errors as e (e)}<li>{e}</li>{/each}
				</ul>{/if}
		</div>
	{/if}
	<ContactForm lang={data.lang} />
{/if}

<aside class="other container-lux" aria-labelledby="contact-other">
	<h2 id="contact-other">{m.contact_details()}</h2>
	<ul>
		{#if data.store.email}<li>
				<Icon name="mail" size={18} /><a href="mailto:{data.store.email}">{data.store.email}</a>
			</li>{/if}
		{#if data.store.phone}<li>
				<Icon name="phone" size={18} /><a href="tel:{data.store.phone.replace(/\s/g, '')}">{data.store.phone}</a>
			</li>{/if}
		<li><Icon name="question" size={18} /><a href={localizeHref('/faq', data.lang)}>{m.contact_faq_hint()}</a></li>
	</ul>
</aside>

<style>
	.head,
	.ok,
	.bad,
	.other {
		max-width: calc(var(--container-text) + 2 * var(--gutter));
	}
	.head {
		padding-top: var(--space-12);
	}
	h1 {
		margin: 0 0 var(--space-3);
		font-size: var(--fs-4xl);
	}
	.head p {
		margin: 0;
		color: var(--ui-text-muted);
	}
	.ok,
	.bad {
		margin-block: var(--space-8);
		padding: var(--space-6);
	}
	.ok {
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.bad {
		margin-bottom: 0;
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
		font-size: var(--fs-sm);
	}
	.bad p {
		margin: 0;
	}
	.bad ul {
		margin: var(--space-2) 0 0;
	}
	.other h2 {
		font-size: var(--fs-xl);
		margin: 0 0 var(--space-4);
	}
	.other ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.other li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 2.75rem;
	}
	.other :global(svg) {
		color: var(--ui-accent);
	}
	.other a {
		color: var(--ui-text);
	}
</style>
