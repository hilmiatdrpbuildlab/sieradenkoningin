<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { formatDate, formatDateTime, formatPrice } from '#lib/utils/format.ts';

	let { data, form } = $props();
	const c = $derived(data.customer);
	const name = $derived([c.firstName, c.lastName].filter(Boolean).join(' ') || c.email);
	let confirmOpen = $state(false);
</script>

<svelte:head><title>{name} — Klanten — Beheer</title></svelte:head>

<PageHeader title={name} description={c.email}>
	{#snippet meta()}
		{#if c.emailVerifiedAt}<Badge tone="success">E-mail bevestigd</Badge>{:else}<Badge tone="warning">E-mail niet bevestigd</Badge>{/if}
		{#if c.marketingOptIn}<Badge tone="info">Nieuwsbrief</Badge>{/if}
		<Badge>{c.locale.toUpperCase()}</Badge>
		{#each c.tags as t (t)}<Badge>{t}</Badge>{/each}
	{/snippet}
	{#snippet actions()}
		{#if data.isOwner}
			<Button href="/admin/customers/{c.id}/export" size="sm" variant="outline" icon="download" data-sveltekit-reload>Gegevens exporteren</Button>
			<Button size="sm" variant="danger" icon="trash" onclick={() => (confirmOpen = true)}>Account verwijderen</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="grid">
	<div class="main">
		<section class="stats" aria-label="Kerncijfers">
			<div><span>Bestellingen</span><strong>{data.stats.orders}</strong></div>
			<div><span>Besteed (netto)</span><strong>{formatPrice(data.stats.spent)}</strong></div>
			<div><span>Klant sinds</span><strong>{formatDate(c.createdAt)}</strong></div>
		</section>

		<Card title="Bestellingen" padded={false}>
			{#if data.orders.length}
				<ul class="orders">
					{#each data.orders as o (o.id)}
						<li>
							<a href="/admin/orders/{o.id}"><strong>{o.number}</strong></a>
							<span class="muted">{formatDateTime(o.placedAt)}</span>
							<span class="amount">{formatPrice(o.total)}</span>
							<StatusBadge status={o.status} />
						</li>
					{/each}
				</ul>
			{:else}<p class="empty">Nog geen bestellingen.</p>{/if}
		</Card>
	</div>

	<aside class="side">
		<Card title="Contact">
			<dl>
				<dt>E-mail</dt><dd><a href="mailto:{c.email}">{c.email}</a></dd>
				<dt>Telefoon</dt><dd>{c.phone ?? '—'}</dd>
				<dt>Nieuwsbrief</dt><dd>{data.newsletter === 'confirmed' ? 'Ingeschreven' : data.newsletter === 'pending' ? 'Wacht op bevestiging' : 'Niet ingeschreven'}</dd>
				<dt>Account</dt><dd>{c.hasPassword ? 'Met wachtwoord' : 'Alleen magic link'}</dd>
			</dl>
		</Card>
		<Card title="Adressen">
			{#each data.addresses as a (a.id)}
				<address>
					{#if a.isDefault}<Badge tone="info">Standaard</Badge>{/if}
					<strong>{a.name}</strong>{#if a.company}<br />{a.company}{/if}<br />{a.line1}{#if a.line2}<br />{a.line2}{/if}<br />{a.postalCode} {a.city}<br />{a.country}
				</address>
			{:else}<p class="empty">Geen opgeslagen adressen.</p>{/each}
		</Card>
		<Card title="Interne notities">
			{#if data.canWrite}
				<form method="POST" action="?/notes" use:enhance={() => async ({ update }) => update({ reset: false })}>
					{#if form && 'saved' in form}<p class="ok" role="status">Opgeslagen.</p>{/if}
					<Field label="Notities" hint="Alleen zichtbaar voor het team."><Textarea name="notes" rows={4} value={c.notes ?? ''} /></Field>
					<Field label="Tags" hint="Gescheiden door komma's, bv. vip, cadeau"><Input name="tags" value={c.tags.join(', ')} /></Field>
					<div><Button type="submit" size="sm">Opslaan</Button></div>
				</form>
			{:else}
				<p>{c.notes ?? 'Geen notities.'}</p>
			{/if}
		</Card>
	</aside>
</div>

{#if data.isOwner}
	<Dialog bind:open={confirmOpen} title="Klantaccount definitief verwijderen?" size="sm">
		<form method="POST" action="?/delete" class="del">
			<p>Persoonsgegevens, adressen, verlanglijst en nieuwsbriefinschrijving worden <strong>onherroepelijk</strong> gewist. Bestellingen blijven bewaard voor de boekhouding (wettelijke bewaarplicht), maar worden losgekoppeld.</p>
			<Field label="Typ ter bevestiging: {c.email}" error={form && 'deleteError' in form ? form.deleteError : undefined}><Input name="confirm" autocomplete="off" /></Field>
			<div class="row"><Button variant="ghost" size="sm" onclick={() => (confirmOpen = false)}>Annuleren</Button><Button type="submit" variant="danger" size="sm">Definitief verwijderen</Button></div>
		</form>
	</Dialog>
{/if}

<style>
	.grid {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: 2fr 1fr;
			align-items: start;
		}
	}
	.main,
	.side {
		display: grid;
		gap: var(--space-6);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-4);
	}
	.stats div {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-4);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
	}
	.stats span {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
	}
	.stats strong {
		font-family: var(--ff-serif);
		font-size: var(--fs-xl);
		font-weight: var(--fw-regular);
	}
	.orders {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.orders li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: var(--space-1) var(--space-3);
		align-items: center;
		padding: var(--space-3) var(--space-5);
		border-top: 1px solid var(--ui-border);
		font-size: var(--fs-sm);
	}
	.orders .muted {
		grid-column: 1;
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
	}
	.amount {
		font-variant-numeric: tabular-nums;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-4);
		margin: 0;
		font-size: var(--fs-sm);
	}
	dt {
		color: var(--ui-text-muted);
	}
	dd {
		margin: 0;
		word-break: break-word;
	}
	address {
		font-style: normal;
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--ui-border);
	}
	address:last-child {
		border-bottom: 0;
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
	.ok {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-xs);
	}
	.empty {
		margin: 0;
		padding: var(--space-4) var(--space-5);
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.del p {
		margin: 0;
	}
	.row {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
