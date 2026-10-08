<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import ProductGrid from '#lib/components/storefront/ProductGrid.svelte';
	import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { getWishlist } from '#lib/stores/wishlist.svelte.ts';
	import { getToasts } from '#lib/stores/toast.svelte.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	const wishlist = getWishlist();
	const toasts = getToasts();

	// Own list: hearts toggled on this page (or elsewhere) remove the card immediately.
	const products = $derived(
		data.shared || !wishlist.loaded ? data.products : data.products.filter((p) => wishlist.has(p.id))
	);
	let shareUrl = $derived(form?.shareUrl ?? null);
	let sharing = $state(false);
	const title = $derived(data.shared ? m.wishlist_shared_title() : m.wishlist_title());

	async function copy() {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			toasts.push({ message: m.wishlist_copied(), kind: 'info' });
		} catch {
			/* clipboard blocked: the link stays selectable in the field */
		}
	}
</script>

<Seo {title} noindex />

<section class="wl container-lux">
	<Breadcrumbs items={[{ label: m.breadcrumb_home(), href: `/${data.lang}` }, { label: title }]} />
	<header class="head">
		<p class="eyebrow">{m.wishlist_eyebrow()}</p>
		<h1>{title}</h1>
		{#if data.shared && !data.invalidShare}
			<p class="lead">{m.wishlist_shared_text()}</p>
		{:else if products.length}
			<p class="lead">
				{products.length === 1 ? m.wishlist_count_one() : m.wishlist_count_other({ count: products.length })}
			</p>
		{/if}
	</header>

	{#if data.invalidShare}
		<EmptyState title={m.wishlist_shared_invalid()}>
			{#snippet action()}<Button href="/{data.lang}" variant="outline">{m.wishlist_empty_cta()}</Button>{/snippet}
		</EmptyState>
	{:else if products.length}
		{#if !data.shared}
			<div class="share">
				<form
					method="POST"
					action="?/share"
					use:enhance={() => {
						sharing = true;
						return async ({ result }) => {
							sharing = false;
							if (result.type === 'success' && typeof result.data?.shareUrl === 'string')
								shareUrl = result.data.shareUrl;
						};
					}}
				>
					<Button type="submit" variant="outline" size="sm" icon="link" loading={sharing}>{m.wishlist_share()}</Button>
				</form>
				{#if shareUrl}
					<div class="link">
						<label for="wl-share">{m.wishlist_share_link()}</label>
						<div class="row">
							<input
								id="wl-share"
								type="url"
								readonly
								value={shareUrl}
								onfocus={(e) => e.currentTarget.select()}
								aria-describedby="wl-hint"
							/>
							<button type="button" onclick={copy}><Icon name="copy" size={16} />{m.wishlist_copy()}</button>
						</div>
						<p id="wl-hint" class="hint">{m.wishlist_share_hint()}</p>
					</div>
				{/if}
			</div>
		{/if}
		<ProductGrid {products} eager={4} />
		{#if !data.shared && !data.loggedIn}
			<p class="account">
				<Icon name="user" size={16} />{m.wishlist_account_hint()}
				<a href={localizeHref('/account/login', data.lang)}>{m.wishlist_login()}</a>
			</p>
		{/if}
	{:else}
		<EmptyState icon="heart" title={m.wishlist_empty_title()} text={m.wishlist_empty_text()}>
			{#snippet action()}<Button href="/{data.lang}">{m.wishlist_empty_cta()}</Button>{/snippet}
		</EmptyState>
	{/if}
</section>

<style>
	.wl {
		padding-top: var(--space-6);
		padding-bottom: var(--section-y);
	}
	.head {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		margin: var(--space-8) 0 var(--space-10);
		text-align: center;
	}
	.head .eyebrow,
	.lead {
		margin: 0;
	}
	h1 {
		margin: 0;
		font-size: var(--fs-4xl);
		color: var(--ui-text-strong);
	}
	.lead {
		color: var(--ui-text-muted);
		max-width: var(--container-text);
	}
	.share {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		margin-bottom: var(--space-10);
	}
	.link {
		width: min(36rem, 100%);
		display: grid;
		gap: var(--space-2);
	}
	.link label {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
	.row input {
		flex: 1;
		min-width: 0;
		height: 2.75rem;
		border: 0;
		border-bottom: 1px solid var(--ui-border-strong);
		background: transparent;
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-sm);
	}
	.row button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		padding-inline: var(--space-4);
		border: 1px solid var(--ui-text);
		background: none;
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	.row button:focus-visible,
	.row input:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.account {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		margin: var(--space-16) 0 0;
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.account a {
		color: var(--ui-text);
		text-underline-offset: 0.3em;
	}
</style>
