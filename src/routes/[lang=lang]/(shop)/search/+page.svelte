<script lang="ts">
	import type { Snapshot } from './$types';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import ProductListing from '#lib/components/storefront/ProductListing.svelte';
	import CategoryStrip from '#lib/components/storefront/CategoryStrip.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data } = $props();
	let listingRef: ReturnType<typeof ProductListing> | undefined = $state();

	export const snapshot: Snapshot<ReturnType<ReturnType<typeof ProductListing>['capture']> | undefined> = {
		capture: () => listingRef?.capture(),
		restore: (s) => listingRef?.restore(s)
	};

	const action = $derived(localizeHref('/search', data.lang));
	const searchHref = (q: string) => `${action}?q=${encodeURIComponent(q)}`;
</script>

<Seo title={data.q ? m.search_results_title({ query: data.q }) : m.search_title()} noindex canonical={action} />

{#snippet searchForm()}
	<form class="search" role="search" method="GET" {action}>
		<label for="sq" class="sr-only">{m.search_label()}</label>
		<input
			id="sq"
			type="search"
			name="q"
			value={data.q}
			placeholder={m.search_placeholder()}
			autocomplete="off"
			enterkeyhint="search"
			maxlength="80"
		/>
		<button type="submit" aria-label={m.search_submit()}><Icon name="search" size={20} /></button>
	</form>
{/snippet}

{#snippet suggestions()}
	{#if data.suggestions.popular.length}
		<div class="popular">
			<h2 class="eyebrow">{m.search_popular()}</h2>
			<ul>
				{#each data.suggestions.popular as p (p)}<li><a href={searchHref(p)}>{p}</a></li>{/each}
			</ul>
		</div>
	{/if}
	<CategoryStrip title={m.search_categories()} categories={data.suggestions.categories} />
{/snippet}

{#if data.listing}
	<ProductListing
		bind:this={listingRef}
		listing={data.listing}
		lang={data.lang}
		title={m.search_results_title({ query: data.q })}
		eyebrow={m.search_title()}
		crumbs={[{ label: m.breadcrumb_home(), href: `/${data.lang}` }, { label: m.search_title() }]}
		sortOptions={['relevance', 'featured', 'new', 'price_asc', 'price_desc']}
		defaultSort="relevance"
		extra={{ q: data.q }}
	>
		{#snippet header()}<div class="form-wrap">{@render searchForm()}</div>{/snippet}
		{#snippet empty()}
			<EmptyState
				icon="search"
				title={m.search_no_results_title({ query: data.q })}
				text={m.search_no_results_text()}
			/>
			{@render suggestions()}
		{/snippet}
	</ProductListing>
{:else}
	<section class="start container-lux">
		<p class="eyebrow">{m.search_title()}</p>
		<h1>{m.search_label()}</h1>
		<p class="lead">{m.search_prompt_text()}</p>
		<div class="form-wrap">{@render searchForm()}</div>
	</section>
	{@render suggestions()}
{/if}

<style>
	.start {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		padding-top: var(--section-y-sm);
		text-align: center;
	}
	.start h1 {
		margin: 0;
		font-size: var(--fs-4xl);
		color: var(--ui-text-strong);
	}
	.lead {
		margin: 0;
		color: var(--ui-text-muted);
	}
	.form-wrap {
		width: 100%;
		max-width: 40rem;
		margin: var(--space-6) auto 0;
	}
	.search {
		display: flex;
		align-items: center;
		border-bottom: 1px solid var(--ui-border-strong);
	}
	.search:focus-within {
		border-bottom-color: var(--ui-border-focus);
	}
	.search input {
		flex: 1;
		min-width: 0;
		height: 3.5rem;
		border: 0;
		background: transparent;
		color: var(--ui-text);
		font-family: var(--ff-display);
		font-size: var(--fs-2xl);
	}
	.search input:focus-visible {
		outline: none;
	}
	.search button {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 0;
		background: none;
		color: var(--ui-text);
		cursor: pointer;
	}
	.search button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.popular {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		padding-top: var(--space-10);
		text-align: center;
	}
	.popular h2 {
		margin: 0;
	}
	.popular ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		margin: 0;
		padding: 0 var(--gutter);
		list-style: none;
	}
	.popular a {
		display: inline-flex;
		align-items: center;
		min-height: 2.5rem;
		padding: 0 var(--space-4);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-full);
		font-size: var(--fs-sm);
		text-decoration: none;
	}
	.popular a:hover {
		border-color: var(--ui-text);
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
