<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import EntityI18nFields from '#lib/components/admin/EntityI18nFields.svelte';
	import RelationPicker from '#lib/components/admin/RelationPicker.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatPrice } from '#lib/utils/format.ts';

	let { data, form } = $props();
	// svelte-ignore state_referenced_locally (form copy; re-created by {#key} after navigation)
	let model = $state(structuredClone(form?.values ?? data.model));
	let dirty = $state(false);
	let saving = $state(false);
	let confirmDelete = $state(false);
	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});
	const errors = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string[]>);
	const preview = $derived(form && 'preview' in form ? form.preview : data.preview);
	const notice = $derived(form ? null : ({ '1': 'Wijzigingen opgeslagen.', new: 'Collectie aangemaakt.' } as Record<string, string>)[page.url.searchParams.get('saved') ?? '']);
	const hero = $derived(data.media.find((m) => m.id === model.heroMediaId));
	const e = (k: string) => errors[k]?.[0];
</script>

<svelte:head><title>{data.isNew ? 'Nieuwe collectie' : data.collection?.name} — Beheer</title></svelte:head>

<PageHeader title={data.isNew ? 'Nieuwe collectie' : (data.collection?.name ?? '')}>
	{#snippet actions()}
		{#if data.collection}
			<Button href="/nl/collectie/{data.collection.slug}" variant="ghost" size="sm" icon="external" target="_blank" rel="noopener">Bekijk in winkel</Button>
			{#if data.canWrite}
				<form method="POST" action="?/delete" id="delete-form">
					<Button
						type="submit"
						variant="outline"
						size="sm"
						icon="trash"
						onclick={(ev) => {
							if (mounted) {
								ev.preventDefault();
								confirmDelete = true;
							}
						}}>Verwijderen</Button
					>
				</form>
			{/if}
		{/if}
	{/snippet}
</PageHeader>

{#if notice}<p class="notice" role="status"><Icon name="check" size={16} />{notice}</p>{/if}
{#if Object.keys(errors).length}<p class="notice alert" role="alert"><Icon name="alert" size={16} />Niet opgeslagen — controleer de gemarkeerde velden.</p>{/if}

<form
	method="POST"
	action="?/save"
	novalidate
	oninput={() => (dirty = true)}
	onchange={() => (dirty = true)}
	use:enhance={({ action }) => {
		const isPreview = action.search.includes('preview');
		if (!isPreview) saving = true;
		return async ({ update, result }) => {
			if (!isPreview && result.type !== 'failure') dirty = false;
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<fieldset class="wrap" disabled={!data.canWrite}>
		<div class="layout">
			<div class="main">
				<Card title="Inhoud en SEO">
					<EntityI18nFields bind:model {errors} prefix={{ nl: '/nl/collectie/', fr: '/fr/collection/' }} autoSlug={data.isNew} />
				</Card>

				<Card title="Producten">
					<fieldset class="type">
						<legend>Type</legend>
						<label><input type="radio" name="type" value="manual" bind:group={model.type} /> <span><strong>Handmatig</strong><small>Je kiest zelf de producten en hun volgorde.</small></span></label>
						<label><input type="radio" name="type" value="rule" bind:group={model.type} /> <span><strong>Regel</strong><small>Producten worden automatisch geselecteerd.</small></span></label>
					</fieldset>

					{#if model.type === 'manual' || !mounted}
						<div class="section" class:muted-nojs={!mounted}>
							{#if !mounted}<p class="hint">Handmatig: producten en volgorde</p>{/if}
							<RelationPicker name="products" label="Producten in deze collectie" bind:ids={model.products} options={data.products} max={200} onchange={() => (dirty = true)} />
						</div>
					{/if}
					{#if model.type === 'rule' || !mounted}
						<div class="section rules">
							{#if !mounted}<p class="hint">Regel: alle voorwaarden moeten kloppen</p>{/if}
							{#if e('rule')}<p class="err" role="alert"><Icon name="alert" size={14} />{e('rule')}</p>{/if}
							<div class="grid2">
								<Field label="Categorie" error={e('rule.category')} optional>
									<Select name="rule.category" bind:value={model.rule.category} options={data.categories} placeholder="Alle categorieën" />
								</Field>
								<Field label="Tag" hint="bv. klaver" error={e('rule.tag')} optional>
									<Input name="rule.tag" bind:value={model.rule.tag} maxlength={40} />
								</Field>
								<Field label="Nieuw: toegevoegd in de laatste … dagen" error={e('rule.newWithinDays')} optional>
									<Input name="rule.newWithinDays" type="number" min="1" max="3650" bind:value={model.rule.newWithinDays} />
								</Field>
								<Field label="Prijs lager dan" error={e('rule.priceLt')} optional>
									<Input name="rule.priceLt" prefix="€" inputmode="decimal" bind:value={model.rule.priceLt} />
								</Field>
							</div>
							<Checkbox name="rule.onSale" checked={!!model.rule.onSale} onchange={(ev) => (model.rule.onSale = ev.currentTarget.checked ? 'on' : undefined)}>Alleen producten in solden</Checkbox>
							<div>
								<Button type="submit" formaction="?/preview" variant="outline" size="sm" icon="eye">Voorbeeld bijwerken</Button>
							</div>
							{#if preview}
								<div class="preview" aria-live="polite">
									<p><strong>{preview.total}</strong> actieve product{preview.total === 1 ? '' : 'en'} voldoen aan deze regel{preview.total > preview.rows.length ? ` (eerste ${preview.rows.length} getoond)` : ''}.</p>
									<ul>
										{#each preview.rows as p (p.id)}
											<li><a href="/admin/products/{p.id}">{p.name}</a> <small>{formatPrice(p.price)}</small></li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/if}
				</Card>
			</div>

			<aside class="side">
				<Card title="Zichtbaarheid">
					<Checkbox name="active" checked={!!model.active} onchange={(ev) => (model.active = ev.currentTarget.checked ? 'on' : undefined)}>Zichtbaar in de winkel</Checkbox>
				</Card>
				<Card title="Sfeerbeeld" description="Uit de mediabibliotheek.">
					<Field label="Afbeelding" optional>
						<Select name="heroMediaId" bind:value={model.heroMediaId} options={data.media.map((m) => ({ value: m.id, label: m.label }))} placeholder="Geen" />
					</Field>
					{#if hero}<img class="hero" src={hero.url} alt="" />{/if}
				</Card>
			</aside>
		</div>
		{#if data.canWrite}<SaveBar {dirty} {saving} label={data.isNew ? 'Collectie aanmaken' : 'Opslaan'} cancelHref="/admin/collections" />{/if}
	</fieldset>
</form>

<ConfirmDialog
	bind:open={confirmDelete}
	title="Collectie verwijderen?"
	message="De collectie verdwijnt uit de winkel. De producten zelf blijven bestaan."
	confirmLabel="Verwijderen"
	danger
	form="delete-form"
/>

<style>
	.layout {
		display: grid;
		gap: var(--space-6);
		align-items: start;
	}
	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 20rem;
		}
	}
	.main,
	.side {
		display: grid;
		gap: var(--space-6);
		min-width: 0;
	}
	.wrap {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	.type {
		display: grid;
		gap: var(--space-2);
		margin: 0 0 var(--space-4);
		padding: 0;
		border: 0;
	}
	@media (min-width: 48rem) {
		.type {
			grid-template-columns: 1fr 1fr;
		}
	}
	.type legend {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		margin-bottom: var(--space-2);
	}
	.type label {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		padding: var(--space-3);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		cursor: pointer;
	}
	.type label:has(input:checked) {
		border-color: var(--ui-action);
		background: var(--ui-surface-sunken);
	}
	.type input {
		margin-top: 3px;
		accent-color: var(--ui-action);
	}
	.type span {
		display: grid;
	}
	.type small,
	.hint {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.hint {
		margin: 0;
	}
	.section {
		display: grid;
		gap: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--ui-border);
	}
	.section + .section {
		margin-top: var(--space-4);
	}
	.grid2 {
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}
	.preview {
		padding: var(--space-3) var(--space-4);
		background: var(--ui-surface-sunken);
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
	}
	.preview p {
		margin: 0 0 var(--space-2);
	}
	.preview ul {
		margin: 0;
		padding-left: var(--space-5);
		columns: 2 14rem;
	}
	.preview small {
		color: var(--ui-text-muted);
	}
	.hero {
		width: 100%;
		margin-top: var(--space-3);
		border-radius: var(--r-sm);
		aspect-ratio: 3 / 2;
		object-fit: cover;
	}
	.err {
		display: flex;
		gap: 4px;
		align-items: center;
		margin: 0;
		color: var(--ui-danger);
		font-size: var(--fs-sm);
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
</style>
