<!--
  @component I18nInput — one translatable field with NL/FR tabs (P4-01). The FR tab carries a "!" badge
  while Dutch text exists without a French translation.
  - bound: `<I18nInput label="Titel" bind:value={block.data.title} />` (value: { nl, fr? } | undefined)
  - form:  `<I18nInput label="Titel" name="title" value={page.title} />` submits `title_nl` + `title_fr`
-->
<script lang="ts">
	import Tabs from '#lib/components/ui/Tabs.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';

	type I18n = { nl: string; fr?: string; en?: string };
	interface Props {
		label: string;
		value?: I18n | null;
		name?: string;
		multiline?: boolean;
		rows?: number;
		required?: boolean;
		hint?: string;
		maxlength?: number;
		error?: string | string[] | null;
		errorFr?: string | string[] | null;
		onchange?: () => void;
	}
	let {
		label,
		value = $bindable(),
		name,
		multiline = false,
		rows = 4,
		required = false,
		hint,
		maxlength,
		error,
		errorFr,
		onchange
	}: Props = $props();

	let active = $state('nl');
	const missing = $derived(!!value?.nl?.trim() && !value?.fr?.trim());

	function set(lang: 'nl' | 'fr', v: string) {
		if (!value) value = { nl: '' };
		value[lang] = v;
		onchange?.();
	}
</script>

<div class="i18n">
	<Tabs
		bind:active
		{label}
		tabs={[
			{ id: 'nl', label: `${label} · NL` },
			{ id: 'fr', label: 'FR', badge: missing ? '!' : undefined }
		]}
	>
		{#snippet panel(lang)}
			{@const l = lang as 'nl' | 'fr'}
			<Field
				label="{label} ({l === 'nl' ? 'Nederlands' : 'Frans'})"
				hideLabel
				required={required && l === 'nl'}
				hint={l === 'fr' && missing ? 'Franse vertaling ontbreekt — de Nederlandse tekst wordt getoond.' : hint}
				error={l === 'nl' ? error : errorFr}
			>
				{#if multiline}
					<Textarea
						name={name ? `${name}_${l}` : undefined}
						{rows}
						{maxlength}
						lang={l}
						value={value?.[l] ?? ''}
						oninput={(e) => set(l, e.currentTarget.value)}
					/>
				{:else}
					<Input
						name={name ? `${name}_${l}` : undefined}
						{maxlength}
						lang={l}
						value={value?.[l] ?? ''}
						oninput={(e) => set(l, e.currentTarget.value)}
					/>
				{/if}
			</Field>
		{/snippet}
	</Tabs>
</div>

<style>
	.i18n :global([role='tablist'] button) {
		min-height: 2.25rem;
		font-size: var(--fs-xs);
	}
	.i18n :global([role='tabpanel']) {
		padding-top: var(--space-2);
	}
</style>
