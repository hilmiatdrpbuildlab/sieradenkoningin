<!--
  @component OrderTimeline — the order's history from `order_events` (newest first): payment,
  status changes, shipments, refunds, emails and internal notes. Notes are visually distinct.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import { ORDER_STATUS_LABELS } from './order-labels.ts';
	import { formatDateTime, formatPrice } from '#lib/utils/format.ts';
	import type { OrderStatus } from '#lib/types.ts';

	interface TimelineEvent {
		id: string;
		type: string;
		data: Record<string, unknown> | null;
		actor: string | null;
		createdAt: Date | string;
	}
	let { events }: { events: TimelineEvent[] } = $props();

	const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
	const status = (v: unknown) => ORDER_STATUS_LABELS[v as OrderStatus] ?? s(v);
	const money = (v: unknown) => (typeof v === 'number' ? formatPrice(v) : '');

	function describe(e: TimelineEvent): { icon: IconName; title: string; detail?: string; tone?: 'danger' | 'success' } {
		const d = e.data ?? {};
		switch (e.type) {
			case 'placed':
				return {
					icon: 'bag',
					title: 'Bestelling geplaatst',
					detail: `${money(d.total)} · ${d.method === 'pickup' ? 'afhaalpunt' : 'thuislevering'}`
				};
			case 'payment_created':
				return {
					icon: 'receipt',
					title: 'Betaling gestart',
					detail: [s(d.method), s(d.ref)].filter(Boolean).join(' · ')
				};
			case 'payment_retry':
				return { icon: 'refresh', title: 'Klant probeert opnieuw te betalen' };
			case 'paid':
				return {
					icon: 'check',
					title: 'Betaald',
					detail: [money(d.amount), s(d.method), d.invoiceNumber ? `factuur ${s(d.invoiceNumber)}` : '']
						.filter(Boolean)
						.join(' · '),
					tone: 'success'
				};
			case 'payment_failed':
				return { icon: 'alert', title: 'Betaling niet gelukt', detail: s(d.status), tone: 'danger' };
			case 'payment_error':
				return { icon: 'alert', title: 'Betaling kon niet starten', detail: s(d.reason), tone: 'danger' };
			case 'superseded':
				return { icon: 'history', title: 'Vervangen door een nieuwe bestelpoging' };
			case 'oversold':
				return { icon: 'alert', title: 'Oververkocht: onvoldoende voorraad bij betaling', tone: 'danger' };
			case 'status':
				return {
					icon: 'arrow-right',
					title: `Status: ${status(d.from)} → ${status(d.to)}`,
					detail: [s(d.reason), d.restocked ? `${s(d.restocked)} st. terug in voorraad` : '']
						.filter(Boolean)
						.join(' · ')
				};
			case 'shipment': {
				const what: Record<string, string> = {
					label_created: 'Verzendlabel aangemaakt',
					shipped: 'Verzonden',
					delivered: 'Geleverd (vervoerder)',
					exception: 'Probleem gemeld door de vervoerder'
				};
				return {
					icon: 'truck',
					title: what[s(d.action)] ?? 'Verzending',
					detail: d.trackingNumber ? `Track & trace ${s(d.trackingNumber)}` : undefined,
					tone: d.action === 'exception' ? 'danger' : undefined
				};
			}
			case 'refund':
				return {
					icon: 'return',
					title: d.full ? 'Volledig terugbetaald' : 'Gedeeltelijk terugbetaald',
					detail: [money(d.amount), s(d.reason), d.restocked ? `${s(d.restocked)} st. terug in voorraad` : '']
						.filter(Boolean)
						.join(' · ')
				};
			case 'refund_failed':
				return {
					icon: 'alert',
					title: 'Terugbetaling mislukt',
					detail: [money(d.amount), s(d.error)].filter(Boolean).join(' · '),
					tone: 'danger'
				};
			case 'invoice':
				return { icon: 'file', title: 'Factuur aangemaakt', detail: s(d.invoiceNumber) };
			case 'email':
				return { icon: 'mail', title: 'E-mail verstuurd', detail: s(d.template) };
			case 'note':
				return { icon: 'edit', title: 'Interne notitie', detail: s(d.text) };
			default:
				return { icon: 'info', title: e.type };
		}
	}
</script>

{#if events.length}
	<ol class="timeline">
		{#each events as e (e.id)}
			{@const v = describe(e)}
			<li class:note={e.type === 'note'} data-tone={v.tone}>
				<span class="dot" aria-hidden="true"><Icon name={v.icon} size={14} /></span>
				<div class="body">
					<p class="title">{v.title}</p>
					{#if v.detail}<p class="detail">{v.detail}</p>{/if}
					<p class="meta">
						<time datetime={new Date(e.createdAt).toISOString()}>{formatDateTime(e.createdAt)}</time>{#if e.actor}
							· {e.actor === 'system' ? 'systeem' : e.actor === 'customer' ? 'klant' : e.actor}{/if}
					</p>
				</div>
			</li>
		{/each}
	</ol>
{:else}
	<p class="empty">Nog geen gebeurtenissen.</p>
{/if}

<style>
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	li {
		position: relative;
		display: grid;
		grid-template-columns: 1.75rem 1fr;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
	}
	li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: calc(0.875rem - 0.5px);
		top: 1.75rem;
		bottom: 0;
		width: 1px;
		background: var(--ui-border);
	}
	.dot {
		width: 1.75rem;
		height: 1.75rem;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--ui-surface-sunken);
		color: var(--ui-text-muted);
		border: 1px solid var(--ui-border);
	}
	[data-tone='success'] .dot {
		background: var(--ui-success-bg);
		color: var(--ui-success);
	}
	[data-tone='danger'] .dot {
		background: var(--ui-danger-bg);
		color: var(--ui-danger);
	}
	.body {
		min-width: 0;
		padding-top: 2px;
	}
	.note .body {
		padding: var(--space-2) var(--space-3);
		background: color-mix(in srgb, var(--ui-ornament) 10%, var(--ui-surface));
		border-radius: var(--r-sm);
	}
	p {
		margin: 0;
	}
	.title {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	.detail {
		font-size: var(--fs-sm);
		white-space: pre-line;
		word-break: break-word;
	}
	.meta,
	.empty {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
</style>
