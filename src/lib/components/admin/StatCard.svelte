<!--
  @component StatCard — dashboard KPI widget with delta + optional sparkline.
  <StatCard label="Omzet (30d)" value={formatPrice(1284500)} delta={0.124} trend={[…]} />
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';

	interface Props {
		label: string;
		value: string;
		delta?: number;          // 0.124 = +12.4% vs previous period
		deltaLabel?: string;     // "vs vorige 30 dagen"
		icon?: IconName;
		trend?: number[];        // sparkline points
		invert?: boolean;        // true when "down" is good (e.g. returns)
	}
	let { label, value, delta, deltaLabel = 'vs vorige periode', icon, trend, invert = false }: Props = $props();

	const up = $derived((delta ?? 0) >= 0);
	const good = $derived(invert ? !up : up);

	const path = $derived.by(() => {
		if (!trend || trend.length < 2) return '';
		const min = Math.min(...trend), max = Math.max(...trend), span = max - min || 1;
		return trend
			.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (trend.length - 1)) * 100).toFixed(1)},${(28 - ((v - min) / span) * 26).toFixed(1)}`)
			.join(' ');
	});
</script>

<article class="stat">
	<header>
		<h3>{label}</h3>
		{#if icon}<span class="ico"><Icon name={icon} size={18} /></span>{/if}
	</header>
	<p class="value">{value}</p>
	<footer>
		{#if delta !== undefined}
			<span class="delta" class:good class:bad={!good}>
				<Icon name={up ? 'trend-up' : 'trend-down'} size={14} />
				{up ? '+' : '−'}{Math.abs(delta * 100).toFixed(1)}%
			</span>
			<span class="vs">{deltaLabel}</span>
		{/if}
		{#if path}
			<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
				<path d={path} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" />
			</svg>
		{/if}
	</footer>
</article>

<style>
	.stat {
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		padding: var(--space-5);
		display: grid;
		gap: var(--space-2);
		box-shadow: var(--elev-xs);
	}
	header { display: flex; justify-content: space-between; align-items: center; }
	h3 { margin: 0; font-family: var(--ff-body); font-size: var(--fs-xs); font-weight: var(--fw-medium); letter-spacing: var(--ls-wide); text-transform: uppercase; color: var(--ui-text-muted); }
	.ico { width: 2rem; height: 2rem; display: grid; place-items: center; border-radius: var(--r-xs); background: var(--ui-surface-sunken); color: var(--ui-accent); }
	.value { margin: 0; font-family: var(--ff-serif); font-size: 1.875rem; line-height: 1.1; color: var(--ui-text-strong); font-variant-numeric: lining-nums tabular-nums; }
	footer { display: flex; align-items: center; gap: var(--space-2); font-size: var(--fs-xs); min-height: 1.75rem; }
	.delta { display: inline-flex; align-items: center; gap: 4px; font-weight: var(--fw-semibold); }
	.good { color: var(--sk-success); }
	.bad { color: var(--sk-danger); }
	.vs { color: var(--ui-text-muted); }
	.spark { margin-left: auto; width: 5rem; height: 1.75rem; color: var(--sk-cognac); }
</style>
