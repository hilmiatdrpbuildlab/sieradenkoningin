<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import OrderLinesTable from '#lib/components/admin/OrderLinesTable.svelte';
	import OrderTimeline from '#lib/components/admin/OrderTimeline.svelte';
	import RefundPanel from '#lib/components/admin/RefundPanel.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import {
		METHOD_LABELS,
		PAYMENT_STATUS_LABELS,
		PAYMENT_TONES,
		SHIPMENT_LABELS
	} from '#lib/components/admin/order-labels.ts';
	import { formatDateTime, formatPrice } from '#lib/utils/format.ts';

	let { data, form } = $props();
	const o = $derived(data.order);
	const openShipment = $derived(data.shipments.find((s) => s.status === 'created' || s.status === 'shipped'));
	const canShip = $derived(data.transitions.includes('shipped'));
	const paidLike = $derived(['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus));
	const notes = $derived(data.events.filter((e) => e.type === 'note').length);
	let busy = $state<string | null>(null);

	/** use:enhance with a per-button busy state; keeps form values on failure. */
	const submit = (name: string) => () => {
		busy = name;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			busy = null;
			await update({ reset: name === 'note' });
		};
	};
	const addr = (a: {
		name: string;
		company?: string;
		line1: string;
		line2?: string;
		postalCode: string;
		city: string;
		country: string;
		phone?: string;
	}) => [a.company, a.name, a.line1, a.line2, `${a.postalCode} ${a.city}`, a.country].filter(Boolean);
</script>

<svelte:head><title>{o.number} — Bestellingen — Beheer</title></svelte:head>

<PageHeader title={o.number} description="Geplaatst op {formatDateTime(o.placedAt)} · {o.locale.toUpperCase()}">
	{#snippet meta()}
		<StatusBadge status={o.status} />
		<Badge tone={PAYMENT_TONES[o.paymentStatus]}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</Badge>
		{#if o.giftWrap}<Badge tone="gold">Cadeau</Badge>{/if}
	{/snippet}
	{#snippet actions()}
		<Button href="/admin/orders/{o.id}/packing-slip" size="sm" variant="outline" icon="printer" target="_blank"
			>Pakbon</Button
		>
		{#if o.invoiceNumber}
			<Button href="/api/invoices/{o.invoiceNumber}" size="sm" variant="outline" icon="download" data-sveltekit-reload
				>Factuur</Button
			>
		{/if}
	{/snippet}
</PageHeader>

{#if form && 'done' in form && form.done}<p class="notice" role="status">{form.done}</p>{/if}
{#if form && 'actionError' in form && form.actionError}<p class="notice notice--error" role="alert">
		{form.actionError}
	</p>{/if}

<div class="grid">
	<div class="main">
		<Card title="Artikelen" padded={false} id="lines">
			<OrderLinesTable lines={data.lines} totals={o} />
		</Card>

		<Card
			title="Verzending"
			id="shipping"
			description={o.shippingMethod === 'pickup' ? 'Levering in een afhaalpunt' : 'Thuislevering'}
		>
			{#if o.shippingMethod === 'pickup' && o.servicePoint}
				<p class="sp">
					<strong>{o.servicePoint.name}</strong><br />{o.servicePoint.street}, {o.servicePoint.postalCode}
					{o.servicePoint.city} · {o.servicePoint.carrier} #{o.servicePoint.id}
				</p>
			{/if}
			{#if data.shipments.length}
				<ul class="shipments">
					{#each data.shipments as s (s.id)}
						<li>
							<div>
								<strong>{s.carrier}</strong>
								<Badge tone={s.status === 'exception' ? 'danger' : s.status === 'created' ? 'warning' : 'success'}
									>{SHIPMENT_LABELS[s.status] ?? s.status}</Badge
								>
								<span class="sub">
									{#if s.trackingNumber}Track & trace:
										{#if s.trackingUrl}<a href={s.trackingUrl} target="_blank" rel="noopener noreferrer"
												>{s.trackingNumber}</a
											>{:else}{s.trackingNumber}{/if}
									{:else}Geen track & trace{/if}
									· {formatDateTime(s.createdAt)}
								</span>
							</div>
							{#if s.labelKey}
								<Button
									href="/admin/orders/{o.id}/label/{s.id}"
									size="sm"
									variant="outline"
									icon="printer"
									target="_blank"
									data-sveltekit-reload>Label</Button
								>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">Nog geen zending.</p>
			{/if}

			{#if data.can.fulfil && (canShip || data.transitions.includes('delivered'))}
				<div class="ship-actions">
					{#if canShip && !openShipment?.labelKey}
						<form method="POST" action="?/label" use:enhance={submit('label')}>
							<Button type="submit" size="sm" icon="truck" loading={busy === 'label'} disabled={!!busy}
								>Label aanmaken</Button
							>
						</form>
					{/if}
					{#if canShip}
						<details class="disclosure" open={!!(form && 'shipErrors' in form)}>
							<summary>Markeer verzonden</summary>
							<form method="POST" action="?/ship" class="stack" use:enhance={submit('ship')}>
								{#if openShipment?.trackingNumber}
									<p class="muted">
										Het pakje met track & trace {openShipment.trackingNumber} is overhandigd aan de vervoerder.
									</p>
								{:else}
									<label class="field"
										><span>Vervoerder</span><input name="carrier" value="bpost" maxlength="40" /></label
									>
									<label class="field"
										><span>Track & trace-nummer (optioneel)</span><input name="trackingNumber" maxlength="80" /></label
									>
									<label class="field"
										><span>Track & trace-link (optioneel)</span><input
											name="trackingUrl"
											type="url"
											maxlength="500"
											placeholder="https://"
										/></label
									>
									{#if form && 'shipErrors' in form && form.shipErrors}<p class="err">
											{Object.values(form.shipErrors)[0]?.[0]}
										</p>{/if}
								{/if}
								<p class="muted">De klant krijgt een e-mail dat de bestelling onderweg is.</p>
								<div>
									<Button type="submit" size="sm" loading={busy === 'ship'} disabled={!!busy}>Markeer verzonden</Button>
								</div>
							</form>
						</details>
					{/if}
					{#if data.transitions.includes('delivered')}
						<form method="POST" action="?/status" use:enhance={submit('delivered')}>
							<input type="hidden" name="to" value="delivered" />
							<Button
								type="submit"
								size="sm"
								variant="outline"
								icon="check"
								loading={busy === 'delivered'}
								disabled={!!busy}>Markeer geleverd</Button
							>
						</form>
					{/if}
				</div>
			{/if}
		</Card>

		{#if paidLike}
			<Card title="Terugbetalingen" id="refunds">
				{#if data.refunds.length}
					<ul class="refunds">
						{#each data.refunds as r (r.id)}
							<li>
								<strong>{formatPrice(r.amount)}</strong>
								<Badge tone={r.status === 'failed' ? 'danger' : r.status === 'pending' ? 'warning' : 'success'}
									>{r.status === 'failed' ? 'Mislukt' : r.status === 'pending' ? 'Bezig' : 'Uitgevoerd'}</Badge
								>
								<span class="sub">
									{formatDateTime(r.createdAt)} · {r.actor ?? '—'}{#if r.reason}
										· {r.reason}{/if}{#if r.restock}
										· terug in voorraad{/if}{#if r.providerRef}
										· {r.providerRef}{/if}
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">Nog geen terugbetalingen.</p>
				{/if}
				{#if data.can.refund && data.refundable > 0}
					<RefundPanel
						lines={data.lines}
						refundable={data.refundable}
						captured={data.captured}
						shippingTotal={o.shippingTotal}
						error={form && 'refundError' in form ? form.refundError : null}
						errors={form && 'refundErrors' in form ? form.refundErrors : null}
					/>
				{/if}
			</Card>
		{/if}

		<Card
			title="Tijdlijn"
			id="timeline"
			description={notes ? `${notes} interne notitie${notes === 1 ? '' : 's'}` : undefined}
		>
			{#if data.can.fulfil}
				<form method="POST" action="?/note" class="note-form" use:enhance={submit('note')}>
					<label class="field">
						<span>Interne notitie (niet zichtbaar voor de klant)</span>
						<textarea name="text" rows="2" maxlength="2000" required aria-invalid={!!(form && 'noteErrors' in form)}
						></textarea>
					</label>
					{#if form && 'noteErrors' in form && form.noteErrors}<p class="err">{form.noteErrors.text?.[0]}</p>{/if}
					<div>
						<Button type="submit" size="sm" variant="outline" loading={busy === 'note'} disabled={!!busy}
							>Notitie toevoegen</Button
						>
					</div>
				</form>
			{/if}
			<OrderTimeline events={data.events} />
		</Card>
	</div>

	<aside class="side">
		{#if data.can.fulfil && (data.transitions.includes('processing') || data.transitions.includes('cancelled'))}
			<Card title="Status" id="status">
				{#if data.transitions.includes('processing')}
					<form method="POST" action="?/status" use:enhance={submit('processing')}>
						<input type="hidden" name="to" value="processing" />
						<Button type="submit" size="sm" full loading={busy === 'processing'} disabled={!!busy}
							>Markeer in behandeling</Button
						>
					</form>
				{/if}
				{#if data.transitions.includes('cancelled')}
					<details class="disclosure">
						<summary>Bestelling annuleren</summary>
						<form method="POST" action="?/status" class="stack" use:enhance={submit('cancel')}>
							<input type="hidden" name="to" value="cancelled" />
							<p class="muted">
								{#if o.status === 'pending'}De voorraadreservering wordt vrijgegeven.{:else}De artikelen gaan terug in
									voorraad. Het bedrag wordt <strong>niet</strong> automatisch terugbetaald.{/if}
							</p>
							<label class="field"><span>Reden (intern)</span><input name="reason" maxlength="500" /></label>
							<div>
								<Button type="submit" size="sm" variant="danger" loading={busy === 'cancel'} disabled={!!busy}
									>Annuleren bevestigen</Button
								>
							</div>
						</form>
					</details>
				{/if}
			</Card>
		{/if}

		<Card title="Klant" id="customer">
			<dl>
				<dt>Naam</dt>
				<dd>{o.billingAddress.name}</dd>
				<dt>E-mail</dt>
				<dd><a href="mailto:{o.email}">{o.email}</a></dd>
				{#if o.shippingAddress.phone}<dt>Telefoon</dt>
					<dd>{o.shippingAddress.phone}</dd>{/if}
				{#if o.vatNumber}<dt>Btw-nr.</dt>
					<dd>{o.vatNumber}</dd>{/if}
				<dt>Account</dt>
				<dd>
					{#if o.customerId && data.can.customers}<a href="/admin/customers/{o.customerId}">Klantprofiel</a
						>{:else if o.customerId}Ja{:else}Gast{/if}
				</dd>
			</dl>
		</Card>

		<Card title="Adressen" id="addresses">
			<div class="addresses">
				<address>
					<span class="lbl">Levering</span>
					{#each addr(o.shippingAddress) as l, i (i)}{l}<br />{/each}
				</address>
				<address>
					<span class="lbl">Facturatie</span>
					{#each addr(o.billingAddress) as l, i (i)}{l}<br />{/each}
				</address>
			</div>
		</Card>

		<Card title="Betaling" id="payment">
			{#if data.payments.length}
				{#each data.payments as p, i (p.id)}
					<dl class:older={i > 0}>
						<dt>Status</dt>
						<dd><Badge tone={PAYMENT_TONES[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</Badge></dd>
						<dt>Bedrag</dt>
						<dd>{formatPrice(p.amount)}</dd>
						<dt>Methode</dt>
						<dd>{p.method ? (METHOD_LABELS[p.method] ?? p.method) : '—'}</dd>
						<dt>Provider</dt>
						<dd>{p.provider}</dd>
						<dt>Referentie</dt>
						<dd class="mono">{p.providerRef}</dd>
						<dt>Datum</dt>
						<dd>{formatDateTime(p.createdAt)}</dd>
					</dl>
				{/each}
			{:else}
				<p class="muted">Geen betaling.</p>
			{/if}
			{#if o.invoiceNumber}
				<dl>
					<dt>Factuur</dt>
					<dd>
						<a href="/api/invoices/{o.invoiceNumber}" data-sveltekit-reload>{o.invoiceNumber}</a>{#if !o.invoiceKey}
							<span class="sub">(PDF in wachtrij)</span>{/if}
					</dd>
				</dl>
				{#if data.can.fulfil}
					<form method="POST" action="?/invoice" use:enhance={submit('invoice')}>
						<Button
							type="submit"
							size="sm"
							variant="ghost"
							icon="refresh"
							loading={busy === 'invoice'}
							disabled={!!busy}>Factuur-PDF opnieuw maken</Button
						>
					</form>
				{/if}
			{/if}
		</Card>

		{#if o.giftWrap || o.giftMessage}
			<Card title="Cadeau" id="gift">
				{#if o.giftWrap}<p class="muted">Cadeauverpakking gevraagd.</p>{/if}
				{#if o.giftMessage}<blockquote>“{o.giftMessage}”</blockquote>{/if}
			</Card>
		{/if}
	</aside>
</div>

<style>
	.grid {
		display: grid;
		gap: var(--space-6);
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.main,
	.side {
		display: grid;
		gap: var(--space-6);
		min-width: 0;
	}
	.notice {
		margin: 0 0 var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--ui-success-bg);
		color: var(--ui-success);
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
	}
	.notice--error {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
	.muted,
	.sub {
		margin: 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.sub {
		display: block;
		font-size: var(--fs-xs);
	}
	.sp {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.shipments,
	.refunds {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}
	.shipments li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--ui-border);
	}
	.shipments li > div,
	.refunds li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		font-size: var(--fs-sm);
	}
	.shipments .sub,
	.refunds .sub {
		flex-basis: 100%;
	}
	.ship-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.disclosure {
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		flex: 1 1 16rem;
	}
	.disclosure summary {
		cursor: pointer;
		padding: var(--space-2) var(--space-3);
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		min-height: 2.75rem;
		display: flex;
		align-items: center;
	}
	.disclosure summary:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.stack {
		display: grid;
		gap: var(--space-3);
		padding: 0 var(--space-3) var(--space-3);
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.field span {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.field input,
	.field textarea {
		width: 100%;
		min-height: 2.5rem;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-sm);
	}
	.field input:focus-visible,
	.field textarea:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 1px;
	}
	.note-form {
		display: grid;
		gap: var(--space-2);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--ui-border);
	}
	.err {
		margin: 0;
		color: var(--ui-danger);
		font-size: var(--fs-sm);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-4);
		margin: 0;
		font-size: var(--fs-sm);
	}
	dl.older {
		padding-top: var(--space-3);
		border-top: 1px solid var(--ui-border);
		opacity: 0.75;
	}
	dt {
		color: var(--ui-text-muted);
	}
	dd {
		margin: 0;
		word-break: break-word;
	}
	.mono {
		font-family: var(--ff-mono, monospace);
		font-size: var(--fs-xs);
	}
	.addresses {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--space-4);
	}
	address {
		font-style: normal;
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
	}
	.lbl {
		display: block;
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--ui-text-muted);
		margin-bottom: var(--space-1);
	}
	blockquote {
		margin: 0;
		padding-left: var(--space-3);
		border-left: 2px solid var(--ui-ornament);
		font-style: italic;
		font-size: var(--fs-sm);
	}
</style>
