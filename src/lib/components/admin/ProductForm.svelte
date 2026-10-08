<!--
  @component ProductForm — admin product editor (DESIGN_SYSTEM §3). Two columns on desktop: content,
  images, variants and relations on the left; status, price, category, organisation, SEO and GPSR on
  the right. Plain POST to `?/save` (multipart for the no-JS photo fallback), enhanced with JS.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import Card from './Card.svelte';
	import I18nTabs from './I18nTabs.svelte';
	import ImageUploader from './ImageUploader.svelte';
	import VariantTable from './VariantTable.svelte';
	import RelationPicker from './RelationPicker.svelte';
	import SeoFields from './SeoFields.svelte';
	import SaveBar from './SaveBar.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { BADGES, BADGE_LABELS, PRODUCT_STATUSES, STATUS_LABELS, type ProductFormModel } from '#lib/schemas/product.ts';

	interface Option {
		value: string;
		label: string;
	}
	interface ProductOption {
		id: string;
		name: string;
		image?: string | null;
		status?: string;
	}
	interface Props {
		model: ProductFormModel;
		errors?: Record<string, string[]>;
		isNew: boolean;
		categories: Option[];
		products: ProductOption[];
		stoneColors?: string[];
		/** Start dirty (re-render after a failed save). */
		startDirty?: boolean;
		formId?: string;
		cancelHref?: string;
	}
	let { model, errors = {}, isNew, categories, products, stoneColors = [], startDirty = false, formId = 'product-form', cancelHref = '/admin/products' }: Props = $props();

	// svelte-ignore state_referenced_locally (the form owns its copy; the page remounts it via {#key})
	let m = $state(structuredClone(model));
	let formEl = $state<HTMLFormElement>();
	let baseline = '';
	// svelte-ignore state_referenced_locally
	let forced = startDirty; // values came back from a failed save → differ from the database
	let dirty = $state(forced);
	let saving = $state(false);

	const serialize = () =>
		formEl ? new URLSearchParams([...new FormData(formEl)].filter((e): e is [string, string] => typeof e[1] === 'string')).toString() : '';

	$effect(() => {
		baseline = serialize();
	});

	async function check() {
		await tick();
		dirty = forced || serialize() !== baseline;
	}

	const e = (k: string) => errors[k]?.[0];
	const errorCount = $derived(Object.keys(errors).length);
	const generalErrors = $derived(errors._ ?? []);
	const has = (prefix: string) => Object.keys(errors).some((k) => k === prefix || k.startsWith(`${prefix}.`));
	const contentErrors = $derived(
		Object.fromEntries(Object.entries(errors).filter(([k]) => /^(name|description|meaning|care|material)\./.test(k)))
	);
	const priceLabel = $derived(m.compareAtPrice ? 'Prijs (solden)' : 'Prijs');
</script>

{#if errorCount}
	<div class="alert" role="alert">
		<Icon name="alert" size={18} />
		<div>
			<strong>Niet opgeslagen — controleer {errorCount === 1 ? 'het gemarkeerde veld' : `de ${errorCount} gemarkeerde velden`}.</strong>
			{#each generalErrors as msg (msg)}<p>{msg}</p>{/each}
			{#if errors.status}<p>{errors.status[0]}</p>{/if}
		</div>
	</div>
{/if}

<form
	bind:this={formEl}
	id={formId}
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	novalidate
	oninput={check}
	onchange={check}
	use:enhance={() => {
		saving = true;
		return async ({ update, result }) => {
			await update({ reset: false });
			saving = false;
			if (result.type === 'success') {
				baseline = serialize();
				forced = false;
				dirty = false;
			}
		};
	}}
>
	<div class="layout">
		<div class="main">
			<Card title="Inhoud" description="Naam en teksten in het Nederlands (verplicht) en Frans.">
				<I18nTabs label="Taal van de inhoud" errors={contentErrors} frMissing={!m.name.fr}>
					{#snippet panel(lang)}
						<Field label="Naam ({lang.toUpperCase()})" error={e(`name.${lang}`)} required={lang === 'nl'} optional={lang === 'fr'}>
							<Input name="name.{lang}" bind:value={m.name[lang]} maxlength={160} />
						</Field>
						<Field label="Materiaal ({lang.toUpperCase()})" hint="bv. 18k verguld edelstaal · granaat" error={e(`material.${lang}`)} optional>
							<Input name="material.{lang}" bind:value={m.material[lang]} maxlength={200} />
						</Field>
						<Field label="Beschrijving ({lang.toUpperCase()})" error={e(`description.${lang}`)} optional>
							<Textarea name="description.{lang}" bind:value={m.description[lang]} rows={6} />
						</Field>
						<Field label="Met betekenis ({lang.toUpperCase()})" hint="Het verhaal achter het juweel." error={e(`meaning.${lang}`)} optional>
							<Textarea name="meaning.{lang}" bind:value={m.meaning[lang]} rows={4} />
						</Field>
						<Field label="Onderhoud ({lang.toUpperCase()})" error={e(`care.${lang}`)} optional>
							<Textarea name="care.{lang}" bind:value={m.care[lang]} rows={3} />
						</Field>
					{/snippet}
				</I18nTabs>
			</Card>

			<Card title="Foto's" description="Eerste foto = hoofdfoto. Alt-tekst in het Nederlands is verplicht, Frans optioneel." id="images">
				<ImageUploader bind:value={m.images} {errors} onchange={check} />
			</Card>

			<Card title="Varianten" description="Metaal × maat → SKU, voorraad en eventueel een afwijkende prijs." id="variants">
				<VariantTable bind:variants={m.variants} slug={m.slug} {errors} onchange={check} />
			</Card>

			<Card title="Gerelateerde producten" description="Getoond op de productpagina.">
				<div class="relations">
					<RelationPicker name="related" label="Misschien vind je dit ook mooi" bind:ids={m.related} options={products} onchange={check} />
					<RelationPicker name="completeSet" label="Maak de set compleet" bind:ids={m.completeSet} options={products} onchange={check} />
				</div>
			</Card>
		</div>

		<aside class="side">
			<Card title="Status">
				<Field label="Status" error={e('status')} hint="Actief = zichtbaar in de winkel. Vereist een foto met alt-tekst en een variant.">
					<Select name="status" bind:value={m.status} options={PRODUCT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
				</Field>
			</Card>

			<Card title="Prijs">
				<div class="grid2">
					<Field label={priceLabel} hint="Incl. 21% btw" error={e('price')} required>
						<Input name="price" bind:value={m.price} prefix="€" inputmode="decimal" placeholder="0,00" />
					</Field>
					<Field label="Van-prijs" hint="Doorstreepte prijs" error={e('compareAtPrice')} optional>
						<Input name="compareAtPrice" bind:value={m.compareAtPrice} prefix="€" inputmode="decimal" placeholder="—" />
					</Field>
				</div>
				{#if !isNew}<p class="note">Een nieuwe prijs wordt bewaard in de prijshistoriek (laagste prijs van 30 dagen).</p>{/if}
			</Card>

			<Card title="Organisatie">
				<div class="stack">
					<Field label="Categorie" error={e('categoryId')} required>
						<Select name="categoryId" bind:value={m.categoryId} options={categories} placeholder="Kies een categorie" />
					</Field>
					<Field label="Badge" error={e('badge')} optional>
						<Select name="badge" bind:value={m.badge} options={BADGES.map((b) => ({ value: b, label: BADGE_LABELS[b] }))} placeholder="Geen (Nieuw wordt automatisch berekend)" />
					</Field>
					<Field label="Steenkleur" hint="Filter in de winkel, bv. rood, groen, wit, geen" error={e('stoneColor')} optional>
						<Input name="stoneColor" bind:value={m.stoneColor} list="stone-colors" maxlength={40} />
					</Field>
					<datalist id="stone-colors">{#each stoneColors as c (c)}<option value={c}></option>{/each}</datalist>
					<Field label="Tags" hint="Komma-gescheiden, bv. klaver, valentijn" error={e('tags')} optional>
						<Input name="tags" bind:value={m.tags} />
					</Field>
					<Checkbox name="featured" checked={!!m.featured} onchange={(ev) => (m.featured = ev.currentTarget.checked ? 'on' : undefined)}>Uitgelicht op de homepage</Checkbox>
					<Checkbox name="engravable" checked={!!m.engravable} onchange={(ev) => (m.engravable = ev.currentTarget.checked ? 'on' : undefined)}>Graveerbaar</Checkbox>
				</div>
			</Card>

			<Card title="Zoekmachines (SEO)">
				<SeoFields bind:slug={m.slug} bind:seo={m.seo} name={m.name} autoSlug={isNew} {errors} onchange={check} />
			</Card>

			<Card title="Productveiligheid (GPSR)" description="Gegevens van de fabrikant of verantwoordelijke in de EU.">
				<div class="stack">
					<Field label="Fabrikant" error={e('gpsr.manufacturer')} optional>
						<Input name="gpsr.manufacturer" bind:value={m.gpsr.manufacturer} maxlength={200} />
					</Field>
					<Field label="Adres" error={e('gpsr.address')} optional>
						<Textarea name="gpsr.address" bind:value={m.gpsr.address} rows={2} maxlength={400} />
					</Field>
					<Field label="Contact (e-mail of website)" error={e('gpsr.contact')} optional>
						<Input name="gpsr.contact" bind:value={m.gpsr.contact} maxlength={200} />
					</Field>
					<I18nTabs label="Taal veiligheidsinformatie" errors={has('gpsr') ? errors : {}} frMissing={!!m.gpsr.safetyInfo.nl && !m.gpsr.safetyInfo.fr}>
						{#snippet panel(lang)}
							<Field label="Veiligheidsinformatie ({lang.toUpperCase()})" error={e(`gpsr.safetyInfo.${lang}`)} optional>
								<Textarea name="gpsr.safetyInfo.{lang}" bind:value={m.gpsr.safetyInfo[lang]} rows={3} />
							</Field>
						{/snippet}
					</I18nTabs>
				</div>
			</Card>
		</aside>
	</div>

	<SaveBar {dirty} {saving} label={isNew ? 'Product aanmaken' : 'Opslaan'} {cancelHref} />
</form>

<style>
	.layout {
		display: grid;
		gap: var(--space-6);
		align-items: start;
	}
	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
		}
	}
	.main,
	.side {
		display: grid;
		gap: var(--space-6);
		min-width: 0;
	}
	.stack {
		display: grid;
		gap: var(--space-4);
	}
	.grid2 {
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
	}
	.relations {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 48rem) {
		.relations {
			grid-template-columns: 1fr 1fr;
		}
	}
	.note {
		margin: var(--space-3) 0 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.alert {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin-bottom: var(--space-6);
		padding: var(--space-4);
		border: 1px solid var(--ui-danger);
		border-radius: var(--r-md);
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
		font-size: var(--fs-sm);
	}
	.alert p {
		margin: var(--space-1) 0 0;
	}
</style>
