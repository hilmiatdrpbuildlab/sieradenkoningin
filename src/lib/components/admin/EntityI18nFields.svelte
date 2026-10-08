<!--
  @component EntityI18nFields — name, slug, description and SEO per language for categories and
  collections (each language has its own slug). Fields post as `name.nl`, `slugs.fr`, `seo.title.nl` …
-->
<script lang="ts">
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import I18nTabs from './I18nTabs.svelte';
	import { slugify } from '#lib/utils/slug.ts';
	import type { I18nModel } from '#lib/schemas/product.ts';
	import type { EntityModel } from '#lib/schemas/collection.ts';

	interface Props {
		model: EntityModel;
		errors?: Record<string, string[] | undefined>;
		/** Public path per language, e.g. { nl: '/nl/', fr: '/fr/' } */
		prefix: I18nModel;
		autoSlug?: boolean;
	}
	let { model = $bindable(), errors = {}, prefix, autoSlug = false }: Props = $props();

	// svelte-ignore state_referenced_locally (initial value; the user owns it afterwards)
	let auto = $state({ nl: autoSlug && !model.slugs.nl, fr: autoSlug && !model.slugs.fr });
	$effect(() => {
		if (auto.nl) model.slugs.nl = slugify(model.name.nl);
		if (auto.fr) model.slugs.fr = slugify(model.name.fr);
	});
	const e = (k: string) => errors[k]?.[0];
</script>

<I18nTabs label="Taal" {errors} frMissing={!model.name.fr}>
	{#snippet panel(lang)}
		<Field label="Naam ({lang.toUpperCase()})" error={e(`name.${lang}`)} required>
			<Input name="name.{lang}" bind:value={model.name[lang]} maxlength={120} />
		</Field>
		<Field label="Slug ({lang.toUpperCase()})" hint="{prefix[lang]}{model.slugs[lang] || '…'}" error={e(`slugs.${lang}`)} required>
			<Input name="slugs.{lang}" bind:value={model.slugs[lang]} autocomplete="off" spellcheck="false" oninput={() => (auto[lang] = false)} />
		</Field>
		<Field label="Omschrijving ({lang.toUpperCase()})" hint="Introtekst bovenaan de pagina." error={e(`description.${lang}`)} optional>
			<Textarea name="description.{lang}" bind:value={model.description[lang]} rows={4} />
		</Field>
		<Field label="SEO-titel ({lang.toUpperCase()})" hint="Leeg = naam. Ideaal ≤ 60 tekens." error={e(`seo.title.${lang}`)} optional>
			<Input name="seo.title.{lang}" bind:value={model.seo.title[lang]} maxlength={70} />
		</Field>
		<Field label="Meta-omschrijving ({lang.toUpperCase()})" error={e(`seo.description.${lang}`)} optional>
			<Textarea name="seo.description.{lang}" bind:value={model.seo.description[lang]} rows={2} maxlength={170} counter />
		</Field>
	{/snippet}
</I18nTabs>
