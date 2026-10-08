<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { formatDateTime } from '#lib/utils/format.ts';

	let { data, form } = $props();
	const errs = $derived(form && 'errors' in form ? (form.errors as Record<string, string[]>) : {});
</script>

<svelte:head><title>E-mails — Beheer</title></svelte:head>

<PageHeader title="E-mails" description="Transactionele e-mails (bevestiging, verzending, terugbetaling) in de taal van de klant.">
	{#snippet meta()}{#if data.provider === 'mock'}<Badge tone="info">Simulatie: e-mails worden lokaal opgeslagen</Badge>{:else}<Badge tone="success">Postmark actief</Badge>{/if}{/snippet}
</PageHeader>

<div class="grid">
	<Card title="Afzender">
		<form method="POST" use:enhance={() => async ({ update }) => update({ reset: false })}>
			{#if form && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
			<Field label="Antwoordadres (reply-to)" hint="Waar klanten op antwoorden; leeg = afzenderadres." error={errs.replyTo}><Input name="replyTo" type="email" value={data.emails.replyTo} /></Field>
			<Checkbox name="bccOrders" checked={data.emails.bccOrders}>Stuur mij een kopie van elke orderbevestiging</Checkbox>
			<div><Button type="submit" size="sm">Opslaan</Button></div>
		</form>
	</Card>

	<Card title="Laatst verzonden" padded={false}>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable, WCAG 2.1.1) -->
		<div class="scroller" tabindex="0" role="region" aria-label="Verzonden e-mails">
			<table>
				<thead><tr><th scope="col">Tijdstip</th><th scope="col">Aan</th><th scope="col">Sjabloon</th><th scope="col">Taal</th><th scope="col">Status</th></tr></thead>
				<tbody>
					{#each data.log as l (l.id)}
						<tr>
							<td>{formatDateTime(l.createdAt)}</td>
							<td>{l.to}</td>
							<td>{l.template}</td>
							<td>{l.locale.toUpperCase()}</td>
							<td><Badge tone={l.status === 'sent' ? 'success' : l.status === 'failed' ? 'danger' : 'neutral'}>{l.status === 'sent' ? 'Verzonden' : l.status === 'failed' ? 'Mislukt' : l.status}</Badge></td>
						</tr>
					{:else}
						<tr><td colspan="5" class="empty">Nog geen e-mails verzonden.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>
</div>

<style>
	.grid {
		display: grid;
		gap: var(--space-6);
	}
	form {
		display: grid;
		gap: var(--space-4);
		max-width: 32rem;
	}
	.ok {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-xs);
	}
	.scroller {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th,
	td {
		text-align: left;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--ui-border);
		white-space: nowrap;
	}
	th {
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
		background: var(--ui-surface-sunken);
	}
	.empty {
		text-align: center;
		color: var(--ui-text-muted);
		padding: var(--space-8);
	}
</style>
