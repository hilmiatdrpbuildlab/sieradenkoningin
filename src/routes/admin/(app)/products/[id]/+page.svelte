<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import ProductForm from '#lib/components/admin/ProductForm.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatDateTime } from '#lib/utils/format.ts';

	let { data, form } = $props();

	const NOTICES: Record<string, string> = {
		'1': 'Wijzigingen opgeslagen.',
		new: 'Product aangemaakt.',
		duplicate: 'Kopie aangemaakt als concept. Pas naam en slug aan en controleer de voorraad.',
		archived: 'Product gearchiveerd. Het is niet meer zichtbaar in de winkel.',
		restored: 'Product teruggezet als concept.'
	};
	const notice = $derived(form ? null : NOTICES[page.url.searchParams.get('saved') ?? '']);
	let confirmArchive = $state(false);
	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});
	const values = $derived(form && 'values' in form ? form.values : null);
	const errors = $derived(form && 'errors' in form ? (form.errors as Record<string, string[]>) : {});
</script>

<svelte:head><title>{data.isNew ? 'Nieuw product' : data.product?.name} — Beheer</title></svelte:head>

<PageHeader title={data.isNew ? 'Nieuw product' : (data.product?.name ?? '')}>
	{#snippet meta()}
		{#if data.product}
			<StatusBadge status={data.product.status} />
			<span class="muted">Laatst gewijzigd {formatDateTime(data.product.updatedAt)}</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.product}
			{#if data.product.status === 'active'}
				<Button href="/nl/p/{data.product.slug}" variant="ghost" size="sm" icon="external" target="_blank" rel="noopener">Bekijk in winkel</Button>
			{/if}
			{#if data.canWrite}
				<form method="POST" action="?/duplicate" use:enhance>
					<Button type="submit" variant="outline" size="sm" icon="copy">Dupliceren</Button>
				</form>
				{#if data.product.status === 'archived'}
					<form method="POST" action="?/restore" use:enhance>
						<Button type="submit" variant="outline" size="sm" icon="refresh">Terugzetten</Button>
					</form>
				{:else}
					<form method="POST" action="?/archive" id="archive-form" use:enhance>
						<Button
							type="submit"
							variant="outline"
							size="sm"
							icon="trash"
							onclick={(e) => {
								if (mounted) {
									e.preventDefault();
									confirmArchive = true;
								}
							}}>Archiveren</Button
						>
					</form>
				{/if}
			{/if}
		{/if}
	{/snippet}
</PageHeader>

{#if notice}
	<p class="notice" role="status"><Icon name="check" size={16} />{notice}</p>
{/if}
{#if form && 'uploaded' in form && form.uploaded}
	<p class="notice info" role="status"><Icon name="info" size={16} />{form.uploaded} foto('s) geüpload. Vul de alt-tekst in en sla opnieuw op.</p>
{/if}
{#if !data.canWrite}
	<p class="notice info" role="status"><Icon name="lock" size={16} />Je kan dit product bekijken maar niet wijzigen.</p>
{/if}

{#key values ?? data.version}
	<fieldset class="wrap" disabled={!data.canWrite}>
		<ProductForm
			model={values ?? data.model}
			{errors}
			isNew={data.isNew}
			categories={data.categories}
			products={data.products}
			stoneColors={data.stoneColors}
			startDirty={!!values}
		/>
	</fieldset>
{/key}

<ConfirmDialog
	bind:open={confirmArchive}
	title="Product archiveren?"
	message="Het product verdwijnt uit de winkel. Bestellingen en historiek blijven bewaard; je kan het later terugzetten."
	confirmLabel="Archiveren"
	danger
	form="archive-form"
/>

<style>
	.muted {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.wrap {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
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
	.notice.info {
		border-color: var(--ui-info);
		background: var(--ui-info-bg);
		color: var(--ui-info);
	}
</style>
