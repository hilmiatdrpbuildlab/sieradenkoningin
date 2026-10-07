<!--
  @component LegalSlot — renders human-provided legal text from settings.legal[slot]. Until the owner
  supplies reviewed text (P4-08) it shows a clearly marked placeholder; we never invent legal content.
  The "legal-notice" slot is auto-filled from the store settings (company, address, KBO, VAT …).
-->
<script lang="ts">
	import { markdownToHtml } from '#lib/utils/markdown.ts';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Store {
		name: string;
		legalName: string;
		street: string;
		postalCode: string;
		city: string;
		country: string;
		kbo: string;
		vat: string;
		email: string;
		phone: string;
	}
	let { slot, body, store, returnDays, lang }: { slot: string; body: string; store: Store; returnDays: number; lang: 'nl' | 'fr' } = $props();
	const missing = m.legal_not_filled();
	const address = $derived([store.street, [store.postalCode, store.city].filter(Boolean).join(' '), store.country].filter(Boolean).join(', '));
</script>

<div class="legal container-lux">
	{#if slot === 'legal-notice'}
		<h2>{m.legal_company()}</h2>
		<dl>
			<dt>{m.legal_company_name()}</dt><dd>{store.legalName || store.name || missing}</dd>
			<dt>{m.legal_address()}</dt><dd>{address || missing}</dd>
			<dt>{m.legal_kbo()}</dt><dd>{store.kbo || missing}</dd>
			<dt>{m.legal_vat()}</dt><dd>{store.vat || missing}</dd>
			<dt>{m.legal_email()}</dt><dd>{#if store.email}<a href="mailto:{store.email}">{store.email}</a>{:else}{missing}{/if}</dd>
			<dt>{m.legal_phone()}</dt><dd>{store.phone || missing}</dd>
		</dl>
	{/if}

	{#if body}
		<div class="prose">{@html markdownToHtml(body)}</div>
	{:else}
		<div class="placeholder" role="note">
			<Icon name="info" size={20} />
			<div>
				<p class="t">{m.legal_placeholder_title()}</p>
				<p>{m.legal_placeholder_text()}</p>
			</div>
		</div>
	{/if}

	{#if slot === 'withdrawal'}
		<p>{m.legal_return_days({ days: returnDays })}</p>
		<p><a href="/api/legal/withdrawal-form.pdf?lang={lang}" download>{m.legal_withdrawal_download()} — {m.legal_withdrawal_form()}</a></p>
	{/if}
</div>

<style>
	.legal {
		max-width: calc(var(--container-text) + 2 * var(--gutter));
		padding-bottom: var(--section-y-sm);
	}
	h2 {
		font-size: var(--fs-2xl);
	}
	dl {
		display: grid;
		grid-template-columns: minmax(10rem, auto) 1fr;
		gap: var(--space-2) var(--space-6);
		margin: 0 0 var(--space-10);
		font-size: var(--fs-sm);
	}
	dt {
		color: var(--ui-text-muted);
	}
	dd {
		margin: 0;
	}
	.placeholder {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-6);
		border: 1px dashed var(--ui-border-strong);
		background: var(--ui-surface);
	}
	.placeholder :global(svg) {
		color: var(--ui-accent);
		flex-shrink: 0;
	}
	.placeholder p {
		margin: 0 0 var(--space-2);
	}
	.placeholder .t {
		font-weight: var(--fw-medium);
	}
	.prose :global(h2) {
		font-size: var(--fs-2xl);
		margin: var(--space-10) 0 var(--space-4);
	}
	.prose :global(p),
	.prose :global(li) {
		line-height: var(--lh-relaxed);
	}
	a {
		color: var(--ui-accent);
	}
</style>
