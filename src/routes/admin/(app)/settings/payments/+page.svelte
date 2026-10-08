<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';

	let { data, form } = $props();
	const labels: Record<string, string> = {
		bancontact: 'Bancontact',
		creditcard: 'Kredietkaart (Visa, Mastercard)',
		applepay: 'Apple Pay',
		googlepay: 'Google Pay',
		kbc: 'KBC/CBC-betaalknop',
		belfius: 'Belfius Pay Button'
	};
</script>

<svelte:head><title>Betalingen — Beheer</title></svelte:head>

<PageHeader title="Betalingen" description="Mollie verwerkt alle betalingen. Bancontact staat altijd eerst in de kassa.">
	{#snippet meta()}
		{#if data.mode === 'live'}<Badge tone="success">Mollie live</Badge>
		{:else if data.mode === 'test'}<Badge tone="warning">Mollie testmodus</Badge>
		{:else}<Badge tone="info">Simulatie (geen Mollie-sleutel)</Badge>{/if}
	{/snippet}
</PageHeader>

<Card title="Betaalmethoden in de kassa" description="Activeer dezelfde methoden ook in je Mollie-dashboard.">
	<form method="POST" use:enhance={() => async ({ update }) => update({ reset: false })}>
		{#if form?.saved}<p class="ok" role="status">Opgeslagen.</p>{/if}
		{#each data.all as m (m)}
			<Checkbox name="methods" value={m} checked={data.methods.includes(m)}>{labels[m] ?? m}</Checkbox>
		{/each}
		<div><Button type="submit" size="sm">Opslaan</Button></div>
	</form>
</Card>

<style>
	form {
		display: grid;
		gap: var(--space-1);
		max-width: 32rem;
	}
	.ok {
		margin: 0 0 var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-xs);
	}
</style>
