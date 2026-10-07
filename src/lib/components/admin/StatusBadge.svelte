<!--
  @component StatusBadge — order / product status pill. Colour is never the only signal:
  each status also has a distinct label (and dot shape for "attention" states).
-->
<script lang="ts">
	import type { OrderStatus } from '#lib/types.ts';

	type Status = OrderStatus | 'draft' | 'active' | 'archived' | 'low_stock';
	let { status }: { status: Status } = $props();

	const map: Record<Status, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
		pending: { label: 'In afwachting', tone: 'warning' },
		paid: { label: 'Betaald', tone: 'info' },
		processing: { label: 'In behandeling', tone: 'info' },
		shipped: { label: 'Verzonden', tone: 'success' },
		delivered: { label: 'Geleverd', tone: 'success' },
		cancelled: { label: 'Geannuleerd', tone: 'neutral' },
		refunded: { label: 'Terugbetaald', tone: 'danger' },
		draft: { label: 'Concept', tone: 'neutral' },
		active: { label: 'Actief', tone: 'success' },
		archived: { label: 'Gearchiveerd', tone: 'neutral' },
		low_stock: { label: 'Lage voorraad', tone: 'warning' }
	};
	const s = $derived(map[status]);
</script>

<span class="badge badge--{s.tone}"><span class="dot"></span>{s.label}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 1.5rem;
		padding-inline: 0.625rem;
		border-radius: var(--r-full);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		white-space: nowrap;
	}
	.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
	.badge--success { background: var(--sk-success-bg); color: var(--sk-success); }
	.badge--warning { background: var(--sk-warning-bg); color: var(--sk-warning); }
	.badge--warning .dot { border-radius: 1px; transform: rotate(45deg); }
	.badge--danger { background: var(--sk-danger-bg); color: var(--sk-danger); }
	.badge--info { background: var(--sk-info-bg); color: var(--sk-info); }
	.badge--neutral { background: var(--sk-cream-100); color: var(--sk-espresso); }
</style>
