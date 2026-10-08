<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import BlockEditor from '#lib/components/admin/BlockEditor.svelte';
	import BlockPicker from '#lib/components/admin/BlockPicker.svelte';
	import BlockPreview from '#lib/components/admin/BlockPreview.svelte';
	import I18nInput from '#lib/components/admin/I18nInput.svelte';
	import { newBlock, type EditorBlock } from '#lib/components/admin/block-defaults.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Radio from '#lib/components/ui/Radio.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import { toBrusselsInput } from '#lib/utils/brussels-time.ts';
	import type { BlockType } from '#lib/schemas/page-block.ts';

	let { data, form } = $props();

	type Values = Record<string, string> | null | undefined;
	const values = $derived((form && 'values' in form ? form.values : null) as Values);
	const errors = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string[]>);
	const blockErrors = $derived((form && 'blockErrors' in form ? form.blockErrors : {}) as Record<number, string>);
	const v = (k: string, fallback: string | null | undefined) => values?.[k] ?? fallback ?? '';
	const i18n = (k: string, fallback: { nl: string; fr?: string } | undefined | null) =>
		values ? { nl: values[`${k}_nl`] ?? '', fr: values[`${k}_fr`] ?? '' } : (fallback ?? undefined);

	const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
	const initialBlocks = () => clone(data.blocks) as EditorBlock[];
	const fromForm = (): EditorBlock[] | null => {
		try {
			return values?.blocks ? JSON.parse(values.blocks) : null;
		} catch {
			return null;
		}
	};
	// No-JS round trip after a validation error: keep the submitted draft.
	let blocks = $state<EditorBlock[]>(fromForm() ?? initialBlocks());
	// svelte-ignore state_referenced_locally (baseline for dirty detection; reset after each save below)
	let savedJson = $state(JSON.stringify(data.blocks));
	let metaDirty = $state(false);
	let saving = $state(false);
	let open = $state<Record<string, boolean>>({});
	let focus = $state<string | null>(null);
	let announce = $state('');
	let confirmDelete = $state(false);
	let grabbed = $state<number | null>(null);
	let dragFrom = $state<number | null>(null);
	let dragOver = $state<number | null>(null);

	// After a successful save the server data is the new baseline.
	// svelte-ignore state_referenced_locally (initial value; the effect tracks later changes)
	let lastUpdated = $state(data.page?.updatedAt);
	$effect.pre(() => {
		if (data.page?.updatedAt !== lastUpdated) {
			lastUpdated = data.page?.updatedAt;
			blocks = initialBlocks();
			savedJson = JSON.stringify(data.blocks);
			metaDirty = false;
		}
	});

	const blocksJson = $derived(JSON.stringify(blocks));
	const dirty = $derived(metaDirty || blocksJson !== savedJson);
	const isHome = $derived(data.page?.type === 'home');
	const title = $derived(data.page ? data.page.title.nl : 'Nieuwe pagina');
	const viewHref = $derived(data.page ? (isHome ? '/nl' : `/nl/${data.page.slugs.nl}`) : null);
	const scheduled = $derived(
		data.page?.status === 'published' && data.page.publishAt && new Date(data.page.publishAt) > new Date()
	);

	beforeNavigate((nav) => {
		// Full unloads are covered by onbeforeunload below (confirm() is not allowed there).
		if (nav.type === 'leave') return;
		if (dirty && !saving && !confirm('Je hebt niet-opgeslagen wijzigingen. Toch verlaten?')) nav.cancel();
	});

	function move(from: number, to: number) {
		if (to < 0 || to >= blocks.length || from === to) return;
		const next = [...blocks];
		const [b] = next.splice(from, 1);
		next.splice(to, 0, b);
		blocks = next;
		announce = `Blok verplaatst naar positie ${to + 1} van ${blocks.length}`;
	}
	function add(type: BlockType) {
		const b = newBlock(type);
		blocks = [...blocks, b];
		open[b.id] = true;
		focus = b.id;
		announce = `Blok toegevoegd op positie ${blocks.length}`;
	}
	function duplicate(i: number) {
		const b = { ...clone(blocks[i]), id: crypto.randomUUID() };
		blocks = [...blocks.slice(0, i + 1), b, ...blocks.slice(i + 1)];
		announce = `Blok gedupliceerd naar positie ${i + 2}`;
	}
	function remove(i: number) {
		if (!confirm('Dit blok verwijderen?')) return;
		blocks = blocks.filter((_, j) => j !== i);
		announce = 'Blok verwijderd';
	}
</script>

<svelte:head><title>{title} — Pagina's — Beheer</title></svelte:head>
<svelte:window onbeforeunload={(e) => dirty && !saving && e.preventDefault()} />

<PageHeader {title} description={isHome ? 'De homepagina van de winkel. Bouw ze volledig op met blokken.' : undefined}>
	{#snippet meta()}
		{#if data.page}
			{#if data.page.status === 'draft'}<Badge>Concept</Badge>{:else if scheduled}<Badge tone="warning">Gepland</Badge
				>{:else}<Badge tone="success">Gepubliceerd</Badge>{/if}
		{/if}
		{#if dirty}<Badge tone="warning">Niet-opgeslagen wijzigingen</Badge>{/if}
	{/snippet}
	{#snippet actions()}
		{#if viewHref && data.page?.status === 'published'}<Button
				href={viewHref}
				variant="ghost"
				size="sm"
				iconRight="external"
				target="_blank"
				rel="noopener">Bekijk</Button
			>{/if}
		{#if data.canWrite}<Button type="submit" form="page-form" size="sm" loading={saving}>Opslaan</Button>{/if}
	{/snippet}
</PageHeader>

{#if page.url.searchParams.get('created') && !form}<p class="ok" role="status">Pagina aangemaakt.</p>{/if}
{#if form && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
{#if errors._}<p class="bad" role="alert">{errors._[0]}</p>{/if}
{#if errors.blocks}
	<div class="bad" role="alert">
		<p>De pagina is niet opgeslagen. Controleer deze blokken:</p>
		<ul>
			{#each errors.blocks as e (e)}<li>{e}</li>{/each}
		</ul>
	</div>
{/if}
<p class="sr-only" aria-live="polite">{announce}</p>

<div class="layout">
	<form
		id="page-form"
		novalidate
		method="POST"
		action="?/save"
		class="main"
		oninput={() => (metaDirty = true)}
		use:enhance={() => {
			saving = true;
			return async ({ update, result }) => {
				await update({ reset: false });
				saving = false;
				if (result.type === 'success') metaDirty = false;
			};
		}}
	>
		<fieldset class="plain" disabled={!data.canWrite}>
			<Card title="Pagina" id="meta">
				<I18nInput
					label="Titel"
					name="title"
					value={i18n('title', data.page?.title)}
					required
					error={errors.title_nl}
				/>
				{#if !isHome}
					<div class="two">
						<Field label="URL (NL)" required error={errors.slug_nl}>
							<Input
								name="slug_nl"
								value={v('slug_nl', data.page?.slugs.nl)}
								prefix="/nl/"
								pattern="[a-z0-9]+(-[a-z0-9]+)*"
							/>
						</Field>
						<Field label="URL (FR)" hint="Leeg = zelfde als NL" error={errors.slug_fr}>
							<Input
								name="slug_fr"
								value={v('slug_fr', data.page?.slugs.fr)}
								prefix="/fr/"
								pattern="[a-z0-9]+(-[a-z0-9]+)*"
							/>
						</Field>
					</div>
					<Field label="Type">
						<Select
							name="type"
							value={v('type', data.page?.type ?? 'page')}
							options={[
								{ value: 'page', label: 'Pagina (info / help)' },
								{ value: 'landing', label: 'Landingspagina (campagne)' },
								{ value: 'legal', label: 'Juridische pagina' }
							]}
						/>
					</Field>
				{:else}
					<input type="hidden" name="type" value="home" />
				{/if}
			</Card>

			<Card title="Publicatie" id="publish">
				<Radio
					name="status"
					legend="Status"
					value={v('status', data.page?.status ?? 'draft')}
					options={[
						{ value: 'draft', label: 'Concept', description: 'Niet zichtbaar in de winkel' },
						{ value: 'published', label: 'Gepubliceerd', description: 'Zichtbaar vanaf de publicatiedatum' }
					]}
				/>
				<Field label="Publiceren vanaf" hint="Brusselse tijd. Leeg = meteen bij publiceren." error={errors.publishAt}>
					<Input type="datetime-local" name="publishAt" value={v('publishAt', toBrusselsInput(data.page?.publishAt))} />
				</Field>
			</Card>

			<Card
				title="SEO"
				description="Titel en beschrijving in Google. Leeg = paginatitel en standaardbeschrijving."
				id="seo"
			>
				<I18nInput
					label="SEO-titel"
					name="seo_title"
					value={i18n('seo_title', data.page?.seo?.title)}
					maxlength={70}
					hint="Max. 60–70 tekens."
					error={errors.seo_title_nl}
					errorFr={errors.seo_title_fr}
				/>
				<I18nInput
					label="Metabeschrijving"
					name="seo_description"
					value={i18n('seo_description', data.page?.seo?.description)}
					multiline
					rows={2}
					maxlength={170}
					hint="Max. 155–170 tekens."
					error={errors.seo_description_nl}
					errorFr={errors.seo_description_fr}
				/>
			</Card>
		</fieldset>

		<Card
			title="Blokken ({blocks.length})"
			id="blocks"
			description="Sleep aan het handvat of gebruik de pijltjes om de volgorde te wijzigen."
		>
			{#snippet actions()}
				{#if data.canWrite}<BlockPicker onpick={add} />{/if}
			{/snippet}
			<input type="hidden" name="blocks" value={blocksJson} />
			{#if blocks.length}
				<ol class="blocks">
					{#each blocks as block, i (block.id)}
						<li
							draggable={grabbed === i}
							class:over={dragOver === i && dragFrom !== i}
							ondragstart={(e) => {
								dragFrom = i;
								e.dataTransfer?.setData('text/plain', String(i));
								if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
							}}
							ondragover={(e) => {
								if (dragFrom === null) return;
								e.preventDefault();
								dragOver = i;
							}}
							ondrop={(e) => {
								e.preventDefault();
								if (dragFrom !== null) move(dragFrom, i);
								dragFrom = dragOver = grabbed = null;
							}}
							ondragend={() => (dragFrom = dragOver = grabbed = null)}
							onfocusin={() => (focus = block.id)}
						>
							<BlockEditor
								bind:block={blocks[i]}
								bind:open={() => !!open[block.id], (o) => (open[block.id] = o)}
								index={i}
								total={blocks.length}
								collections={data.collections}
								faqGroups={data.faqGroups}
								legalSlots={data.legalSlots}
								error={blockErrors[i]}
								onmove={(d) => move(i, i + d)}
								onremove={() => remove(i)}
								onduplicate={() => duplicate(i)}
								ongrab={() => (grabbed = i)}
							/>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="empty">Nog geen blokken. Voeg een eerste blok toe.</p>
			{/if}
			{#if data.canWrite && blocks.length}<div><BlockPicker onpick={add} label="Blok onderaan toevoegen" /></div>{/if}
		</Card>

		{#if data.canWrite}
			<div class="savebar">
				<span>{dirty ? 'Niet-opgeslagen wijzigingen' : 'Alles opgeslagen'}</span>
				<Button type="submit" size="sm" loading={saving}>Opslaan</Button>
			</div>
		{/if}
	</form>

	<aside class="side" aria-label="Preview">
		<Card title="Live preview" description="Toont de huidige, nog niet opgeslagen versie.">
			<BlockPreview {blocks} {focus} {title} />
		</Card>
		{#if data.canWrite && data.page && !data.page.key}
			<form method="POST" action="?/delete" id="delete-form">
				<Button variant="ghost" size="sm" icon="trash" onclick={() => (confirmDelete = true)}>Pagina verwijderen</Button
				>
				<ConfirmDialog
					bind:open={confirmDelete}
					title="Pagina verwijderen?"
					message="De pagina en al haar blokken worden definitief verwijderd."
					confirmLabel="Verwijderen"
					danger
					formAction="?/delete"
					form="delete-form"
				/>
			</form>
		{/if}
	</aside>
</div>

<style>
	.layout {
		display: grid;
		gap: var(--space-6);
		align-items: start;
	}
	@media (min-width: 80rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) minmax(24rem, 34rem);
		}
		.side {
			position: sticky;
			top: var(--space-4);
		}
	}
	.main,
	.plain {
		display: grid;
		gap: var(--space-6);
		min-width: 0;
	}
	.plain {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.side {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}
	.two {
		display: grid;
		gap: var(--space-4);
	}
	@media (min-width: 48rem) {
		.two {
			grid-template-columns: 1fr 1fr;
		}
	}
	.blocks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.blocks,
	.blocks li {
		min-width: 0;
	}
	.blocks li.over {
		box-shadow: 0 -3px 0 0 var(--ui-action);
		border-radius: var(--r-md);
	}
	.empty {
		margin: 0;
		color: var(--ui-text-muted);
	}
	.savebar {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		box-shadow: var(--elev-md);
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
		z-index: 5;
	}
	.ok,
	.bad {
		margin: 0 0 var(--space-4);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--r-xs);
		font-size: var(--fs-sm);
	}
	.ok {
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.bad {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
	.bad p {
		margin: 0;
	}
	.bad ul {
		margin: var(--space-1) 0 0;
		padding-left: var(--space-5);
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
