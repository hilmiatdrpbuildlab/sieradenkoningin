<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatBrussels } from '#lib/utils/brussels-time.ts';

	let { data, form } = $props();
	const errs = (id: string) =>
		form && form.form === id && 'errors' in form ? (form.errors as Record<string, string[]>) : {};
	const vals = (id: string) =>
		form && form.form === id && 'values' in form ? (form.values as Record<string, string>) : null;
	const CODES = [
		{ value: '301', label: '301 — permanent' },
		{ value: '302', label: '302 — tijdelijk' }
	];
	const keep =
		() =>
		async ({ update, result }: { update: (o?: { reset?: boolean }) => Promise<void>; result: { type: string } }) =>
			update({ reset: result.type === 'success' });
</script>

<svelte:head><title>Redirects — Beheer</title></svelte:head>

<PageHeader
	title="Redirects"
	description="Stuur oude of gewijzigde URL's door naar de nieuwe pagina. Een redirect werkt alleen voor paden die niet (meer) bestaan."
/>

<div class="stack">
	<Card title="Nieuwe redirect" id="redirect-new">
		<form method="POST" action="?/create" use:enhance={keep} class="row">
			<Field label="Oud pad" hint="bv. /nl/oude-collectie" error={errs('new').fromPath}
				><Input name="fromPath" value={vals('new')?.fromPath ?? ''} required /></Field
			>
			<Field label="Nieuw doel" hint="/nl/… of https://…" error={errs('new').toPath}
				><Input name="toPath" value={vals('new')?.toPath ?? ''} required /></Field
			>
			<Field label="Type" error={errs('new').code}
				><Select name="code" value={vals('new')?.code ?? '301'} options={CODES} /></Field
			>
			<div class="btn"><Button type="submit" size="sm" icon="plus">Toevoegen</Button></div>
		</form>
		{#if form?.form === 'new' && 'saved' in form}<p class="ok" role="status">Redirect toegevoegd.</p>{/if}
	</Card>

	<Card title="Redirects ({data.total})" padded={false}>
		<form method="GET" class="search" role="search">
			<Field label="Zoeken" hideLabel><Input type="search" name="q" value={data.q} placeholder="Zoek op pad" /></Field>
			<Button type="submit" size="sm" variant="ghost" icon="search">Zoeken</Button>
		</form>
		{#if data.redirects.length}
			<ul class="list">
				{#each data.redirects as r (r.fromPath)}
					{@const e = errs(r.fromPath)}
					<li>
						<form method="POST" action="?/update" use:enhance={keep} class="row">
							<input type="hidden" name="fromPath" value={r.fromPath} />
							<div class="from">
								<code>{r.fromPath}</code>
								<span class="meta">{r.hits} {r.hits === 1 ? 'hit' : 'hits'} · sinds {formatBrussels(r.createdAt)}</span>
							</div>
							<Field label="Doel" hideLabel error={e.toPath}
								><Input
									name="toPath"
									value={vals(r.fromPath)?.toPath ?? r.toPath}
									aria-label="Doel voor {r.fromPath}"
								/></Field
							>
							<Field label="Type" hideLabel
								><Select
									name="code"
									value={String(vals(r.fromPath)?.code ?? r.code)}
									options={CODES}
									aria-label="Type voor {r.fromPath}"
								/></Field
							>
							<div class="btn">
								<Button type="submit" size="sm" variant="outline">Opslaan</Button>
								<Button
									type="submit"
									size="sm"
									variant="ghost"
									icon="trash"
									formaction="?/delete"
									aria-label="Verwijder redirect {r.fromPath}"
									onclick={(ev) => {
										if (!confirm(`Redirect ${r.fromPath} verwijderen?`)) ev.preventDefault();
									}}
								/>
							</div>
						</form>
						{#if form?.form === r.fromPath && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">{data.q ? 'Geen redirects gevonden.' : 'Nog geen redirects.'}</p>
		{/if}
	</Card>
</div>

<style>
	.stack {
		display: grid;
		gap: var(--space-6);
		max-width: 72rem;
	}
	.row {
		display: grid;
		gap: var(--space-3);
		align-items: start;
	}
	@media (min-width: 64rem) {
		.row {
			grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.5fr) 13rem auto;
		}
		.btn {
			padding-top: 1.6rem;
		}
		.list .btn {
			padding-top: 0;
		}
	}
	.btn {
		display: flex;
		gap: var(--space-2);
	}
	.search {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-4) var(--space-5);
		max-width: 32rem;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.list li {
		padding: var(--space-3) var(--space-5);
		border-top: 1px solid var(--ui-border);
	}
	.from {
		display: grid;
		gap: 2px;
		min-width: 0;
		padding-top: var(--space-2);
	}
	code {
		font-size: var(--fs-sm);
		word-break: break-all;
	}
	.meta {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.empty {
		padding: 0 var(--space-5) var(--space-5);
		color: var(--ui-text-muted);
	}
	.ok {
		margin: var(--space-2) 0 0;
		padding: var(--space-2) var(--space-3);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-xs);
		font-size: var(--fs-sm);
	}
</style>
