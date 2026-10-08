<!--
  @component SearchOverlay — full-width cream sheet (native modal <dialog>: focus trap, Esc, inert
  page) with a large Playfair input, popular searches as chips and instant results (6 products +
  matching categories) from /api/search, debounced 200 ms. Enter submits to the results page
  (a real GET form). Opened from SiteHeader's `onsearch`.
-->
<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatPrice } from '#lib/utils/format.ts';
	import { localizeHref, type Lang } from '#lib/i18n/paths.ts';
	import type { CategoryNav, ProductCardData } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { open = $bindable(false), lang }: { open?: boolean; lang: Lang } = $props();

	let dialog: HTMLDialogElement;
	let input: HTMLInputElement | undefined = $state();
	let q = $state('');
	let loading = $state(false);
	let popular = $state<string[]>([]);
	let allCategories = $state<CategoryNav[]>([]);
	let results = $state<{ query: string; products: ProductCardData[]; categories: CategoryNav[] } | null>(null);
	const action = $derived(localizeHref('/search', lang));
	const searchHref = (term: string) => `${action}?q=${encodeURIComponent(term)}`;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let ctrl: AbortController | undefined;

	$effect(() => {
		if (open && !dialog.open) {
			dialog.showModal();
			input?.focus();
			if (!popular.length) loadDefaults();
		}
		if (!open && dialog.open) dialog.close();
	});

	afterNavigate(() => (open = false));

	async function loadDefaults() {
		try {
			const r = await fetch(`/api/search?lang=${lang}`);
			if (!r.ok) return;
			const d = await r.json();
			popular = d.popular ?? [];
			allCategories = d.categories ?? [];
		} catch {
			/* offline: the form still submits to the results page */
		}
	}

	function oninput() {
		clearTimeout(timer);
		const term = q.trim();
		if (!term) {
			ctrl?.abort();
			results = null;
			loading = false;
			return;
		}
		timer = setTimeout(() => run(term), 200);
	}

	async function run(term: string) {
		ctrl?.abort();
		ctrl = new AbortController();
		loading = true;
		try {
			const r = await fetch(`/api/search?lang=${lang}&q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
			if (r.ok) results = await r.json();
		} catch {
			/* aborted or offline */
		} finally {
			if (term === q.trim()) loading = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="overlay"
	aria-label={m.search_label()}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
>
	<div class="sheet">
		<div class="container-lux">
			<div class="top">
				<form role="search" method="GET" {action} class="form">
					<Icon name="search" size={24} />
					<label for="so-q" class="sr-only">{m.search_label()}</label>
					<input
						id="so-q"
						bind:this={input}
						bind:value={q}
						{oninput}
						type="search"
						name="q"
						placeholder={m.search_placeholder()}
						autocomplete="off"
						spellcheck="false"
						enterkeyhint="search"
						maxlength="80"
						aria-describedby="so-status"
					/>
				</form>
				<button type="button" class="x" aria-label={m.ui_close()} onclick={() => (open = false)}
					><Icon name="close" /></button
				>
			</div>

			<p id="so-status" class="sr-only" aria-live="polite">
				{#if results}{m.search_results_live({ count: results.products.length })}{/if}
			</p>

			<div class="body" aria-busy={loading}>
				{#if results && q.trim()}
					{#if results.categories.length}
						<div class="block">
							<h2 class="eyebrow">{m.search_categories()}</h2>
							<ul class="chips">
								{#each results.categories as c (c.key)}<li><a href={c.href}>{c.label}</a></li>{/each}
							</ul>
						</div>
					{/if}
					<div class="block">
						<h2 class="eyebrow">{m.search_products()}</h2>
						{#if results.products.length}
							<ul class="hits">
								{#each results.products as p (p.id)}
									<li>
										<a href={p.href}>
											<img src={p.images[0]?.src} alt="" width="160" height="200" loading="lazy" />
											<span class="name">{p.name}</span>
											<span class="price">{formatPrice(p.price, lang)}</span>
										</a>
									</li>
								{/each}
							</ul>
							<a class="all" href={searchHref(results.query)}
								>{m.search_view_all()} <Icon name="arrow-right" size={16} /></a
							>
						{:else}
							<p class="none">{m.search_no_results_title({ query: results.query })}</p>
						{/if}
					</div>
				{:else}
					{#if popular.length}
						<div class="block">
							<h2 class="eyebrow">{m.search_popular()}</h2>
							<ul class="chips">
								{#each popular as p (p)}<li><a href={searchHref(p)}>{p}</a></li>{/each}
							</ul>
						</div>
					{/if}
					{#if allCategories.length}
						<div class="block">
							<h2 class="eyebrow">{m.search_categories()}</h2>
							<ul class="chips">
								{#each allCategories as c (c.key)}<li><a href={c.href}>{c.label}</a></li>{/each}
							</ul>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</dialog>

<style>
	.overlay {
		margin: 0 0 auto;
		padding: 0;
		border: 0;
		width: 100vw;
		max-width: 100vw;
		max-height: 100dvh;
		background: transparent;
		color: var(--ui-text);
	}
	.overlay::backdrop {
		background: var(--ui-overlay);
	}
	.overlay[open] .sheet {
		animation: drop var(--dur-slow) var(--motion-out);
	}
	@keyframes drop {
		from {
			transform: translateY(-100%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.overlay[open] .sheet {
			animation: none;
		}
	}
	.sheet {
		background: var(--ui-bg);
		box-shadow: var(--elev-xl);
		max-height: 100dvh;
		overflow-y: auto;
		padding-block: var(--space-6) var(--space-12);
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.form {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		border-bottom: 1px solid var(--ui-border-strong);
		color: var(--ui-text-muted);
	}
	.form:focus-within {
		border-bottom-color: var(--ui-text);
	}
	input {
		flex: 1;
		min-width: 0;
		height: 4.5rem;
		border: 0;
		background: transparent;
		color: var(--ui-text-strong);
		font-family: var(--ff-display);
		font-size: var(--fs-3xl);
	}
	input:focus-visible {
		outline: none;
	}
	input::placeholder {
		color: var(--ui-text-muted);
		opacity: 0.7;
	}
	.x {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 0;
		background: none;
		color: var(--ui-text);
		cursor: pointer;
	}
	.x:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.body {
		display: grid;
		gap: var(--space-8);
		padding-top: var(--space-8);
	}
	.block {
		display: grid;
		gap: var(--space-4);
	}
	.block h2 {
		margin: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chips a {
		display: inline-flex;
		align-items: center;
		min-height: 2.5rem;
		padding: 0 var(--space-4);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-full);
		font-size: var(--fs-sm);
		text-decoration: none;
	}
	.chips a:hover {
		border-color: var(--ui-text);
	}
	.hits {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--grid-gap);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	@media (min-width: 48rem) {
		.hits {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (min-width: 80rem) {
		.hits {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
	.hits a {
		display: grid;
		gap: var(--space-1);
		text-decoration: none;
		text-align: center;
	}
	.hits img {
		width: 100%;
		height: auto;
		aspect-ratio: var(--ratio-product);
		object-fit: cover;
		background: color-mix(in srgb, var(--ui-text-subtle) 20%, var(--ui-bg));
		margin-bottom: var(--space-2);
	}
	.name {
		font-family: var(--ff-display);
		font-size: var(--fs-base);
	}
	.price {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.all {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-underline-offset: 0.3em;
	}
	.none {
		margin: 0;
		font-family: var(--ff-display);
		font-size: var(--fs-xl);
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
