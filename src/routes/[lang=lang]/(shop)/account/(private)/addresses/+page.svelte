<script lang="ts">
	import Seo from '#lib/components/storefront/Seo.svelte';
	import Notice from '#lib/components/storefront/Notice.svelte';
	import AddressForm from '#lib/components/storefront/AddressForm.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	const base = $derived(localizeHref('/account/addresses', data.lang));
	const formErrors = $derived(form && 'errors' in form ? (form.errors as Record<string, string[]>) : null);
	const formValues = $derived(form && 'values' in form ? (form.values as Record<string, string | boolean>) : null);
	const showForm = $derived(data.mode !== null || !!formErrors || (form && 'error' in form && form.error === 'limit'));
	const formValue = $derived(formValues ? (formValues as never) : data.editing);
</script>

<Seo title={m.acct_addresses_title()} noindex />

<div class="head">
	<h1>{m.acct_addresses_title()}</h1>
	{#if !showForm}<Button href="{base}?new" variant="outline" icon="plus">{m.acct_addr_add()}</Button>{/if}
</div>

{#if data.saved}
	<Notice kind="success">
		<p>{data.saved === 'deleted' ? m.acct_addr_deleted() : data.saved === 'default' ? m.acct_addr_default_set() : m.acct_addr_saved()}</p>
	</Notice>
{/if}
{#if form && 'error' in form}
	<Notice kind="error"><p>{form.error === 'limit' ? m.acct_addr_limit() : m.acct_err_generic()}</p></Notice>
{/if}

{#if showForm}
	<section class="editor" aria-labelledby="addr-form-title">
		<h2 id="addr-form-title">{data.mode === 'edit' ? m.acct_addr_edit() : m.acct_addr_add()}</h2>
		<AddressForm value={formValue} errors={formErrors} cancelHref={base} />
	</section>
{/if}

{#if data.addresses.length}
	<ul class="book">
		{#each data.addresses as a (a.id)}
			<li class:default={a.isDefault}>
				{#if a.isDefault}<p class="badge"><Icon name="check" size={14} />{m.acct_addr_default()}</p>{/if}
				<address>
					{a.name}<br />{#if a.company}{a.company}<br />{/if}{a.line1}<br />{#if a.line2}{a.line2}<br />{/if}{a.postalCode}
					{a.city}<br />{a.country}{#if a.phone}<br />{a.phone}{/if}
				</address>
				<div class="actions">
					<a href="{base}?edit={a.id}">{m.acct_edit()}<span class="sr-only"> — {a.name}, {a.line1}</span></a>
					{#if !a.isDefault}
						<form method="POST" action="?/makeDefault">
							<input type="hidden" name="id" value={a.id} />
							<button type="submit">{m.acct_addr_make_default_short()}<span class="sr-only"> — {a.name}, {a.line1}</span></button>
						</form>
					{/if}
					<form method="POST" action="?/delete">
						<input type="hidden" name="id" value={a.id} />
						<button type="submit" class="danger">{m.acct_delete()}<span class="sr-only"> — {a.name}, {a.line1}</span></button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-3xl);
	}
	h2 {
		margin: 0 0 var(--space-5);
		font-size: var(--fs-xl);
	}
	.editor {
		margin-block: var(--space-6) var(--space-10);
		padding: var(--space-6);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
	}
	.book {
		display: grid;
		gap: var(--space-4);
		margin: var(--space-6) 0 0;
		padding: 0;
		list-style: none;
	}
	@media (min-width: 48rem) {
		.book {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.book li {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding: var(--space-5);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
	}
	.book li.default {
		border-color: var(--ui-ornament);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-strong);
	}
	address {
		font-style: normal;
		line-height: 1.6;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
	}
	.actions a,
	.actions button {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0;
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--ui-accent);
		background: none;
		border: 0;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.actions .danger {
		color: var(--ui-danger);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
