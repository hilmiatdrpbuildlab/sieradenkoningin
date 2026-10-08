<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import ImageUploader from '#lib/components/admin/ImageUploader.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatDate } from '#lib/utils/format.ts';
	import type { ImageModel } from '#lib/schemas/product.ts';

	let { data, form } = $props();
	/** Keeps the current filters in the action URL so a no-JS post returns to the same view. */
	const act = (name: string) => {
		const p = new URLSearchParams(page.url.search);
		p.set(`/${name}`, '');
		return `?${p.toString().replace(/=(&|$)/, '$1')}`;
	};

	let uploads = $state<ImageModel[]>([]);
	let uploadForm = $state<HTMLFormElement>();
	let deleteId = $state<string | null>(null);
	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});

	const kb = (b: number | null) => (b ? (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} kB`) : '—');
	const pageHref = (n: number) => {
		const p = new URLSearchParams();
		if (data.filters.q) p.set('q', data.filters.q);
		if (data.filters.unused) p.set('unused', '1');
		if (data.filters.sort !== 'new') p.set('sort', data.filters.sort);
		if (n > 1) p.set('page', String(n));
		const s = p.toString();
		return `/admin/media${s ? `?${s}` : ''}`;
	};
	const failed = $derived(!!form?.message && !(form && 'ok' in form));
	let confirmOpen = $state(false);
</script>

<svelte:head><title>Media — Beheer</title></svelte:head>

<PageHeader title="Mediabibliotheek" description="{data.total} afbeelding{data.total === 1 ? '' : 'en'}. Afbeeldingen die nog gebruikt worden kunnen niet verwijderd worden." />

{#if form?.message}
	<p class="notice" class:alert={failed} role={failed ? 'alert' : 'status'}>
		<Icon name={failed ? 'alert' : 'check'} size={16} />{form.message}
	</p>
{/if}

{#if data.canWrite}
	<Card title="Uploaden" description="JPG, PNG, WebP of AVIF, minstens 1600px aan de kortste zijde.">
		<form
			bind:this={uploadForm}
			method="POST"
			action={act('upload')}
			enctype="multipart/form-data"
			use:enhance={() =>
				async ({ update }) => {
					uploads = [];
					await update();
				}}
		>
			<ImageUploader bind:value={uploads} withAlt={false} folder="media" max={24} onchange={async () => {
					await tick();
					if (uploads.length) uploadForm?.requestSubmit();
				}} />
			{#if !mounted}<div class="up"><Button type="submit" size="sm">Uploaden</Button></div>{/if}
		</form>
	</Card>
{/if}

<form method="GET" class="filters" role="search">
	<label class="search"><span class="sr-only">Zoek op bestandsnaam of alt-tekst</span><input type="search" name="q" value={data.filters.q} placeholder="Zoek op bestandsnaam of alt-tekst" /></label>
	<label class="chk"><input type="checkbox" name="unused" value="1" checked={data.filters.unused} /> Alleen ongebruikt</label>
	<label>
		<span class="sr-only">Sorteren</span>
		<select name="sort" value={data.filters.sort}>
			<option value="new">Nieuwste eerst</option>
			<option value="old">Oudste eerst</option>
			<option value="usage">Meest gebruikt</option>
		</select>
	</label>
	<Button type="submit" size="sm" variant="outline" icon="filter">Filteren</Button>
</form>

{#if data.items.length}
	<ul class="grid">
		{#each data.items as m (m.id)}
			<li class="item" class:missing={!m.alt.nl}>
				<div class="thumb"><img src={m.url} alt={m.alt.nl} loading="lazy" /></div>
				<div class="info">
					<p class="name" title={m.key}>{m.name}</p>
					<p class="meta">{m.width && m.height ? `${m.width}×${m.height}` : '—'} · {kb(m.bytes)} · {formatDate(m.createdAt)}</p>
					<p class="usage" class:unused={m.usage === 0}>
						{#if m.usage}<Icon name="link" size={12} />{m.usage}× gebruikt{:else}<Icon name="info" size={12} />Ongebruikt{/if}
					</p>
					{#if data.canWrite}
						<details open={!m.alt.nl || (form?.action === 'alt' && form?.id === m.id)}>
							<summary>{m.alt.nl ? 'Alt-tekst bewerken' : 'Alt-tekst ontbreekt'}</summary>
							<form method="POST" action={act('alt')} use:enhance={() => async ({ update }) => update({ reset: false })}>
								<input type="hidden" name="id" value={m.id} />
								<label><span>NL *</span><input name="nl" value={m.alt.nl} maxlength="250" required /></label>
								<label><span>FR</span><input name="fr" value={m.alt.fr ?? ''} maxlength="250" /></label>
								<Button type="submit" size="sm" variant="outline">Opslaan</Button>
							</form>
						</details>
						<form method="POST" action={act('delete')} id="del-{m.id}" use:enhance>
							<input type="hidden" name="id" value={m.id} />
							{#if m.usage === 0}
								<button
									class="del"
									type="submit"
									onclick={(e) => {
										if (mounted) {
											e.preventDefault();
											deleteId = m.id;
											confirmOpen = true;
										}
									}}><Icon name="trash" size={14} />Verwijderen</button
								>
							{:else}
								<span class="locked"><Icon name="lock" size={12} />In gebruik — niet verwijderbaar</span>
							{/if}
						</form>
					{:else}
						<p class="meta">{m.alt.nl || 'Geen alt-tekst'}</p>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
	{#if data.pages > 1}<div class="pager"><Pagination page={data.page} pages={data.pages} href={pageHref} /></div>{/if}
{:else}
	<EmptyState icon="image" title="Geen afbeeldingen gevonden" text={data.filters.q || data.filters.unused ? 'Pas je zoekopdracht aan.' : 'Upload je eerste foto.'} />
{/if}

<ConfirmDialog
	bind:open={confirmOpen}
	title="Afbeelding verwijderen?"
	message="De afbeelding wordt uit de bibliotheek gehaald en het bestand wordt daarna verwijderd. Dit kan niet ongedaan gemaakt worden."
	confirmLabel="Verwijderen"
	danger
	form={deleteId ? `del-${deleteId}` : undefined}
/>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		margin: var(--space-6) 0 var(--space-4);
		font-size: var(--fs-sm);
	}
	.search {
		flex: 1 1 14rem;
	}
	.search input {
		width: 100%;
	}
	.filters input[type='search'],
	.filters select {
		height: 2.5rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
	}
	.up {
		margin-top: var(--space-3);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
		gap: var(--space-4);
	}
	.item {
		display: grid;
		grid-template-rows: auto 1fr;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		overflow: hidden;
		min-width: 0;
	}
	.item.missing {
		border-color: var(--ui-warning);
	}
	.thumb {
		aspect-ratio: 4 / 5;
		background: var(--ui-surface-sunken);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3);
		font-size: var(--fs-xs);
		align-content: start;
	}
	.info p {
		margin: 0;
	}
	.name {
		font-weight: var(--fw-medium);
		font-size: var(--fs-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		color: var(--ui-text-muted);
	}
	.usage {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--ui-text);
	}
	.usage.unused {
		color: var(--ui-text-muted);
	}
	details {
		margin-top: var(--space-1);
	}
	summary {
		cursor: pointer;
		min-height: 2rem;
		display: flex;
		align-items: center;
		color: var(--ui-text);
	}
	.missing summary {
		color: var(--ui-warning);
		font-weight: var(--fw-medium);
	}
	details form {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-2);
	}
	details label {
		display: grid;
		gap: 2px;
	}
	details input {
		height: 2.25rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		font: inherit;
		background: var(--ui-surface);
		color: var(--ui-text);
	}
	.del {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 2.25rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ui-danger);
		font: inherit;
		cursor: pointer;
	}
	.del:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.locked {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 2.25rem;
		color: var(--ui-text-muted);
	}
	.pager {
		margin-top: var(--space-6);
	}
	.notice {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-6);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--ui-success);
		border-radius: var(--r-md);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		font-size: var(--fs-sm);
	}
	.notice.alert {
		border-color: var(--ui-danger);
		background: var(--ui-danger-bg);
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
