<!--
  @component SeoFields — slug (auto-slugified from the Dutch name until edited by hand), SEO title and
  description per language with counters, and a search-result preview.
-->
<script lang="ts">
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import I18nTabs from './I18nTabs.svelte';
	import { slugify } from '#lib/utils/slug.ts';
	import type { I18nModel } from '#lib/schemas/product.ts';

	interface Props {
		slug: string;
		seo: { title: I18nModel; description: I18nModel };
		/** Source for the automatic slug and the title fallback. */
		name: I18nModel;
		/** Generate the slug from the name (new items, until the slug is edited by hand). */
		autoSlug?: boolean;
		errors?: Record<string, string[] | undefined>;
		urlPrefix?: string;
		slugName?: string;
		onchange?: () => void;
	}
	let { slug = $bindable(), seo = $bindable(), name, autoSlug = false, errors = {}, urlPrefix = '/nl/p/', slugName = 'slug', onchange }: Props = $props();

	// svelte-ignore state_referenced_locally (initial value only; the user owns the toggle afterwards)
	let auto = $state(autoSlug && !slug);
	$effect(() => {
		if (auto) slug = slugify(name.nl);
	});

	const previewTitle = $derived(seo.title.nl || name.nl || 'Titel');
	const previewDesc = $derived(seo.description.nl || 'Voeg een meta-omschrijving toe zodat zoekmachines een goede samenvatting tonen.');
	const e = (k: string) => errors[k]?.[0];
</script>

<div class="seo">
	<Field label="Slug (URL)" hint="{urlPrefix}… · kleine letters, cijfers en koppeltekens. Wijzigen breekt bestaande links." error={e(slugName)} required>
		<Input
			name={slugName}
			bind:value={slug}
			autocomplete="off"
			spellcheck="false"
			oninput={() => {
				auto = false;
				onchange?.();
			}}
		/>
	</Field>
	{#if auto}<p class="auto">Wordt automatisch ingevuld op basis van de Nederlandse naam.</p>{/if}

	<I18nTabs label="SEO-taal" {errors} frMissing={!seo.title.fr && !seo.description.fr}>
		{#snippet panel(lang)}
			<Field label="SEO-titel ({lang.toUpperCase()})" hint="Leeg = naam. Ideaal ≤ 60 tekens." error={e(`seo.title.${lang}`)} optional>
				<Input name="seo.title.{lang}" bind:value={seo.title[lang]} maxlength={70} oninput={onchange} />
			</Field>
			<Field label="Meta-omschrijving ({lang.toUpperCase()})" hint="Ideaal 120–160 tekens." error={e(`seo.description.${lang}`)} optional>
				<Textarea name="seo.description.{lang}" bind:value={seo.description[lang]} rows={3} maxlength={170} counter oninput={onchange} />
			</Field>
		{/snippet}
	</I18nTabs>

	<div class="preview" role="group" aria-label="Voorbeeld in zoekresultaten">
		<span class="url">{urlPrefix}{slug || '…'}</span>
		<span class="title">{previewTitle} | Sieradenkoningin</span>
		<span class="desc">{previewDesc}</span>
	</div>
</div>

<style>
	.seo {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}
	.auto {
		margin: calc(var(--space-2) * -1) 0 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.preview {
		display: grid;
		gap: 2px;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		background: var(--ui-surface-sunken);
		font-size: var(--fs-sm);
		min-width: 0;
	}
	.url {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		overflow-wrap: anywhere;
	}
	.title {
		color: var(--ui-info);
		font-size: var(--fs-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.desc {
		color: var(--ui-text-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
