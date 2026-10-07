<!--
  @component ContactForm — posts to the contact action (Turnstile + rate limit, P4-02). Works without JS.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Turnstile from '#lib/components/storefront/Turnstile.svelte';
	import { localizeHref, type Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { title, lang }: { title?: string; lang: Lang } = $props();
	let status = $state<'idle' | 'sending' | 'sent' | 'error' | 'rate'>('idle');
	let errors = $state<Record<string, string[]>>({});
</script>

<section class="contact container-lux">
	{#if title}<h2>{title}</h2>{/if}
	{#if status === 'sent'}
		<p class="ok" role="status">{m.contact_sent()}</p>
	{:else}
		<form
			method="POST"
			action="{localizeHref('/contact', lang)}?/send"
			use:enhance={() => {
				status = 'sending';
				return async ({ result }) => {
					if (result.type === 'success') status = 'sent';
					else if (result.type === 'failure') {
						errors = (result.data?.errors as Record<string, string[]>) ?? {};
						status = result.status === 429 ? 'rate' : 'error';
					} else status = 'error';
				};
			}}
		>
			<div class="grid">
				<Field label={m.contact_name()} required error={errors.name}><Input name="name" autocomplete="name" maxlength={120} /></Field>
				<Field label={m.contact_email()} required error={errors.email}><Input name="email" type="email" autocomplete="email" /></Field>
			</div>
			<Field label={m.contact_order()} optional error={errors.orderNumber}><Input name="orderNumber" placeholder="SK-2026-000123" maxlength={20} /></Field>
			<Field label={m.contact_message()} required error={errors.message}><Textarea name="message" rows={6} maxlength={3000} counter /></Field>
			<Turnstile />
			{#if status === 'error' || status === 'rate'}<p class="err" role="alert">{status === 'rate' ? m.contact_rate() : m.contact_error()}</p>{/if}
			<div><Button type="submit" loading={status === 'sending'}>{m.contact_send()}</Button></div>
		</form>
	{/if}
</section>

<style>
	.contact {
		max-width: calc(var(--container-text) + 2 * var(--gutter));
		padding-block: var(--space-8) var(--section-y-sm);
	}
	form {
		display: grid;
		gap: var(--space-6);
	}
	.grid {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 48rem) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.ok {
		padding: var(--space-6);
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.err {
		margin: 0;
		color: var(--ui-danger);
		font-size: var(--fs-sm);
	}
</style>
