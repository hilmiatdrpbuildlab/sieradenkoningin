<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { formatDateTime } from '#lib/utils/format.ts';

	let { data, form } = $props();
	const errs = $derived(form && 'errors' in form ? (form.errors as Record<string, string[]>) : {});
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<svelte:head><title>Gebruikers — Beheer</title></svelte:head>

<PageHeader title="Gebruikers & rollen" description="Eigenaar: alles · Redacteur: catalogus, content, kortingen · Fulfilment: bestellingen verwerken, voorraad · Klantendienst: bestellingen, terugbetalingen, klanten." />

{#if form && 'error' in form && form.error}<p class="err" role="alert">{form.error}</p>{/if}

<div class="grid">
	<Card title="Teamleden" padded={false}>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable, WCAG 2.1.1) -->
		<div class="scroller" tabindex="0" role="region" aria-label="Teamleden">
			<table>
				<thead><tr><th scope="col">Naam</th><th scope="col">Rol</th><th scope="col">Status</th><th scope="col">Laatst ingelogd</th><th scope="col"><span class="sr-only">Acties</span></th></tr></thead>
				<tbody>
					{#each data.users as u (u.id)}
						<tr>
							<td><strong>{u.name}</strong><br /><small>{u.email}</small></td>
							<td>
								<form method="POST" action="?/role" use:enhance={keep} class="inline">
									<input type="hidden" name="id" value={u.id} />
									<label class="sr-only" for="role-{u.id}">Rol van {u.name}</label>
									<select id="role-{u.id}" name="role" value={u.role} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
										{#each data.roles as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
									</select>
									<noscript><button type="submit">Wijzig</button></noscript>
								</form>
							</td>
							<td class="badges">
								{#if !u.active}<Badge tone="neutral">Gedeactiveerd</Badge>
								{:else if u.invited}<Badge tone="info">Uitgenodigd</Badge>
								{:else}<Badge tone="success">Actief</Badge>{/if}
								{#if u.twoFactor}<Badge tone="success">2FA</Badge>{:else if !u.invited}<Badge tone="warning">2FA nog in te stellen</Badge>{/if}
							</td>
							<td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
							<td class="actions">
								{#if u.id !== data.me}
									<form method="POST" action="?/toggleActive" use:enhance={keep}><input type="hidden" name="id" value={u.id} /><Button type="submit" size="sm" variant="ghost">{u.active ? 'Deactiveren' : 'Activeren'}</Button></form>
									{#if u.twoFactor}<form method="POST" action="?/reset2fa" use:enhance={keep}><input type="hidden" name="id" value={u.id} /><Button type="submit" size="sm" variant="ghost">2FA resetten</Button></form>{/if}
								{:else}<small>(jij)</small>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>

	<Card title="Iemand uitnodigen" description="De uitnodiging is 7 dagen geldig; bij de eerste login is tweestapsverificatie verplicht.">
		<form method="POST" action="?/invite" use:enhance>
			{#if form && 'invited' in form}
				<p class="ok" role="status">Uitnodiging verstuurd naar {form.invited}.{#if form.link}<br /><small>Simulatie — link: <code>{form.link}</code></small>{/if}</p>
			{/if}
			<Field label="Naam" required error={errs.name}><Input name="name" /></Field>
			<Field label="E-mailadres" required error={errs.email}><Input name="email" type="email" /></Field>
			<Field label="Rol" error={errs.role}><Select name="role" options={data.roles} value="editor" /></Field>
			<div><Button type="submit" size="sm" icon="mail">Uitnodigen</Button></div>
		</form>
	</Card>
</div>

<style>
	.grid {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 80rem) {
		.grid {
			grid-template-columns: 2fr 1fr;
			align-items: start;
		}
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
		vertical-align: middle;
	}
	th {
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
		background: var(--ui-surface-sunken);
		white-space: nowrap;
	}
	small {
		color: var(--ui-text-muted);
	}
	select {
		height: 2.25rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.actions {
		display: flex;
		gap: var(--space-1);
		justify-content: flex-end;
		white-space: nowrap;
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
	form.inline,
	.actions form {
		display: inline;
	}
	.ok {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-xs);
		word-break: break-all;
	}
	.err {
		padding: var(--space-3);
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
		border-radius: var(--r-xs);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
