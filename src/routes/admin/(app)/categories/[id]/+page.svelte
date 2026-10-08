<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import EntityI18nFields from '#lib/components/admin/EntityI18nFields.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';

	let { data, form } = $props();
	// svelte-ignore state_referenced_locally (form copy; reset on navigation by {#key})
	let model = $state(structuredClone(form?.values ?? data.model));
	let dirty = $state(false);
	let saving = $state(false);
	const errors = $derived((form?.errors ?? {}) as Record<string, string[]>);
	const saved = $derived(!form && page.url.searchParams.get('saved') === '1');
</script>

<svelte:head><title>{data.model.name.nl} — Categorieën — Beheer</title></svelte:head>

<PageHeader title={data.model.name.nl} description="Sleutel: {data.category.key}">
	{#snippet actions()}
		<a class="icon" href="/nl/{data.model.slugs.nl}" target="_blank" rel="noopener"><Icon name={data.category.icon as IconName} size={32} stroke={1} /><span>Bekijk in winkel</span></a>
	{/snippet}
</PageHeader>

{#if saved}<p class="notice" role="status"><Icon name="check" size={16} />Wijzigingen opgeslagen.</p>{/if}
{#if Object.keys(errors).length}<p class="alert" role="alert"><Icon name="alert" size={16} />Niet opgeslagen — controleer de gemarkeerde velden.</p>{/if}

<form
	method="POST"
	action="?/save"
	novalidate
	oninput={() => (dirty = true)}
	use:enhance={() => {
		saving = true;
		return async ({ update, result }) => {
			if (result.type !== 'failure') dirty = false;
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<fieldset class="wrap" disabled={!data.canWrite}>
		<div class="layout">
			<Card title="Inhoud en SEO">
				<EntityI18nFields bind:model {errors} prefix={{ nl: '/nl/', fr: '/fr/' }} />
			</Card>
			<Card title="Weergave">
				<Field label="Positie in menu's" hint="Lager = eerder. Je kan ook de pijlen in het overzicht gebruiken." error={errors.position?.[0]}>
					<Input name="position" type="number" min="0" value={data.category.position} />
				</Field>
			</Card>
		</div>
		{#if data.canWrite}<SaveBar {dirty} {saving} cancelHref="/admin/categories" />{/if}
	</fieldset>
</form>

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
	.wrap {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--ui-text);
	}
	.icon :global(svg) {
		color: var(--ui-accent);
	}
	.notice,
	.alert {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-6);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--r-md);
		font-size: var(--fs-sm);
		border: 1px solid var(--ui-success);
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	.alert {
		border-color: var(--ui-danger);
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
</style>
