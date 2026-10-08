<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import MenuEditor from '#lib/components/admin/MenuEditor.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	let { data, form } = $props();
	const errorsFor = (key: string) =>
		form && form.key === key && 'errors' in form ? (form.errors as Record<string, string[]>) : {};
</script>

<svelte:head><title>Menu's — Beheer</title></svelte:head>

<PageHeader
	title="Menu's"
	description="Hoofdmenu en de vier footerkolommen. Labels en links per taal; de volgorde wijzig je met de pijltjes."
/>

<div class="stack">
	{#each data.menus as menu (menu.key)}
		<Card title={menu.label} id="menu-{menu.key}">
			<form
				method="POST"
				action="?/save"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<!-- default button for Enter: saves instead of triggering the first row action -->
				<button type="submit" class="default-submit" tabindex="-1" aria-hidden="true">Opslaan</button>
				<input type="hidden" name="key" value={menu.key} />
				{#if form?.key === menu.key && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
				{#if errorsFor(menu.key)._}<p class="bad" role="alert">{errorsFor(menu.key)._[0]}</p>{/if}
				{#if Object.keys(errorsFor(menu.key)).length && !errorsFor(menu.key)._}<p class="bad" role="alert">
						Niet opgeslagen: controleer de gemarkeerde velden.
					</p>{/if}
				<fieldset disabled={!data.canWrite}>
					<legend class="sr-only">{menu.label}</legend>
					{#key JSON.stringify(menu.items)}
						<MenuEditor items={menu.items} errors={errorsFor(menu.key)} />
					{/key}
					<div><Button type="submit" size="sm">Opslaan</Button></div>
				</fieldset>
			</form>
		</Card>
	{/each}
</div>

<style>
	.stack {
		display: grid;
		gap: var(--space-6);
	}
	form,
	fieldset {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.default-submit {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		border: 0;
		padding: 0;
	}
	.ok,
	.bad {
		margin: 0;
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
