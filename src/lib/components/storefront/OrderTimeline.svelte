<!--
  @component OrderTimeline — customer-facing order progress (account order detail + public tracking).
  Ordered list; each step carries a text state (done / current / upcoming) besides its marker, so
  progress is never conveyed by colour alone. Tracking links open the carrier's page.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatDate } from '#lib/utils/format.ts';
	import { stepLabel } from './account-labels.ts';
	import type { ShipmentView, TimelineStep } from './account-types.ts';
	import type { Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { steps, shipments = [], lang }: { steps: TimelineStep[]; shipments?: ShipmentView[]; lang: Lang } = $props();
	const stateText = (s: TimelineStep['state']) =>
		s === 'done' ? m.acct_step_state_done() : s === 'current' ? m.acct_step_state_current() : m.acct_step_state_upcoming();
</script>

<ol class="timeline">
	{#each steps as step (step.key)}
		<li class={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
			<span class="marker" aria-hidden="true">
				{#if step.state === 'done'}<Icon name="check" size={14} />{:else if step.state === 'current'}<span class="dot"></span>{/if}
			</span>
			<span class="text">
				<span class="label">{stepLabel(step.key)}</span>
				<span class="sr-only">({stateText(step.state)})</span>
				{#if step.at}<time datetime={step.at}>{formatDate(step.at, lang, { day: 'numeric', month: 'long', year: 'numeric' })}</time>{/if}
			</span>
		</li>
	{/each}
</ol>

{#each shipments as s, i (i)}
	{#if s.trackingNumber || s.trackingUrl}
		<div class="track">
			<Icon name="truck" size={18} />
			<div>
				<p class="carrier">{m.acct_shipment_with({ carrier: s.carrier })}</p>
				{#if s.trackingNumber}<p class="num">{m.acct_tracking_number()}: <span>{s.trackingNumber}</span></p>{/if}
			</div>
			{#if s.trackingUrl}
				<a class="link" href={s.trackingUrl} target="_blank" rel="noopener noreferrer">
					{m.acct_track_parcel()}<Icon name="external" size={14} /><span class="sr-only">({m.acct_opens_new_window()})</span>
				</a>
			{/if}
		</div>
	{/if}
{/each}

<style>
	.timeline {
		display: grid;
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		position: relative;
		display: flex;
		gap: var(--space-4);
		padding-bottom: var(--space-5);
	}
	li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 0.6875rem;
		top: 1.5rem;
		bottom: 0;
		width: 1px;
		background: var(--ui-border-strong);
	}
	li.done:not(:last-child)::before {
		background: var(--ui-ornament);
	}
	.marker {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.375rem;
		height: 1.375rem;
		border-radius: var(--r-full);
		border: 1px solid var(--ui-border-strong);
		background: var(--ui-surface);
		color: var(--ui-surface);
	}
	.done .marker {
		background: var(--ui-action);
		border-color: var(--ui-action);
		color: var(--ui-action-text);
	}
	.current .marker {
		border-color: var(--ui-action);
	}
	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--r-full);
		background: var(--ui-action);
	}
	.text {
		display: grid;
		gap: 2px;
	}
	.label {
		font-weight: var(--fw-medium);
	}
	.upcoming .label {
		color: var(--ui-text-muted);
		font-weight: var(--fw-regular);
	}
	time {
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.track {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-4);
		background: var(--ui-surface-sunken);
	}
	.track > :global(svg) {
		color: var(--ui-accent);
	}
	.track div {
		flex: 1;
		min-width: 12rem;
	}
	.track p {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.carrier {
		font-weight: var(--fw-medium);
	}
	.num span {
		font-variant-numeric: tabular-nums;
	}
	.link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		color: var(--ui-accent);
		font-size: var(--fs-sm);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
