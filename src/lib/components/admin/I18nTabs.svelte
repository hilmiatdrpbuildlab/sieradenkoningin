<!--
  @component I18nTabs — NL/FR content tabs for translatable admin fields. Panels stay in the DOM so
  every language submits. A tab shows "!" when one of its fields has an error and "leeg" when the
  French translation is still missing.
  <I18nTabs errors={errors} frMissing={!model.name.fr}>{#snippet panel(lang)}…{/snippet}</I18nTabs>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Tabs from '#lib/components/ui/Tabs.svelte';

	interface Props {
		label?: string;
		/** Field errors keyed by dotted path; keys ending in `.nl` / `.fr` mark that tab. */
		errors?: Record<string, string[] | undefined>;
		frMissing?: boolean;
		panel: Snippet<['nl' | 'fr']>;
	}
	let { label = 'Taal', errors = {}, frMissing = false, panel }: Props = $props();

	const hasError = (lang: string) => Object.entries(errors).some(([k, v]) => v?.length && k.endsWith(`.${lang}`));
	const tabs = $derived([
		{ id: 'nl', label: 'Nederlands', badge: hasError('nl') ? '!' : undefined },
		{ id: 'fr', label: 'Français', badge: hasError('fr') ? '!' : frMissing ? 'leeg' : undefined }
	]);
	let active = $state('nl');
	$effect(() => {
		// jump to the tab holding the first error after a failed save
		if (hasError('nl')) active = 'nl';
		else if (hasError('fr')) active = 'fr';
	});
	const asLang = (id: string): 'nl' | 'fr' => (id === 'fr' ? 'fr' : 'nl');
</script>

<Tabs {tabs} bind:active {label}>
	{#snippet panel(id)}
		<div class="panel">{@render panelOf(asLang(id))}</div>
	{/snippet}
</Tabs>

{#snippet panelOf(lang: 'nl' | 'fr')}{@render panel(lang)}{/snippet}

<style>
	.panel {
		display: grid;
		gap: var(--space-4);
		padding-top: var(--space-4);
	}
</style>
