<!--
  @component TrendChart — single-series line + soft area over time (dataviz guidance):
  one hue (--ui-accent), 2px line, recessive grid, one y-axis, crosshair snapping to the nearest day
  with a tooltip (value first, label second), keyboard navigation (←/→ on the focused plot), and a
  visually-hidden data table so every value is reachable without hovering.
-->
<script lang="ts">
	interface Point {
		label: string; // x label, e.g. "3 okt"
		value: number;
	}
	interface Props {
		title: string;
		points: Point[];
		format: (v: number) => string;
		height?: number;
		/** Smallest y-axis maximum, so an empty period does not show a micro scale. */
		minMax?: number;
		hideTitle?: boolean;
	}
	let { title, points, format, height = 220, minMax = 10_000, hideTitle = false }: Props = $props();

	const W = 640;
	const pad = { t: 12, r: 12, b: 26, l: 56 };
	const uid = $props.id();
	let active = $state<number | null>(null);
	let svg: SVGSVGElement | undefined = $state();

	const max = $derived(Math.max(minMax, ...points.map((p) => p.value)));
	const ticks = $derived.by(() => {
		const raw = max / 3;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
		return [0, step, step * 2, step * 3];
	});
	const top = $derived(ticks[3]);
	const x = (i: number) => pad.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r));
	const y = (v: number) => pad.t + (1 - v / top) * (height - pad.t - pad.b);
	const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(''));
	const area = $derived(points.length ? `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : '');
	const labelEvery = $derived(Math.max(1, Math.ceil(points.length / 6)));

	function onMove(e: PointerEvent) {
		if (!svg || !points.length) return;
		const rect = svg.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * W;
		const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (points.length - 1));
		active = Math.max(0, Math.min(points.length - 1, i));
	}
	function onKey(e: KeyboardEvent) {
		if (!points.length) return;
		if (e.key === 'ArrowRight') active = Math.min(points.length - 1, (active ?? -1) + 1);
		else if (e.key === 'ArrowLeft') active = Math.max(0, (active ?? points.length) - 1);
		else if (e.key === 'Escape') active = null;
		else return;
		e.preventDefault();
	}
	const tipLeft = $derived(active === null ? 0 : (x(active) / W) * 100);
</script>

<figure class="chart">
	<figcaption id="tc{uid}" class:sr-only={hideTitle}>{title}</figcaption>
	<div class="plot">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<svg
			bind:this={svg}
			viewBox="0 0 {W} {height}"
			role="img"
			aria-labelledby="tc{uid}"
			aria-describedby="tc{uid}-hint"
			tabindex="0"
			onpointermove={onMove}
			onpointerleave={() => (active = null)}
			onkeydown={onKey}
			onblur={() => (active = null)}
		>
			{#each ticks as t (t)}
				<line class="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
				<text class="axis" x={pad.l - 8} y={y(t)} text-anchor="end" dominant-baseline="middle">{format(t)}</text>
			{/each}
			{#each points as p, i (i)}
				{#if (i % labelEvery === 0 && points.length - 1 - i >= labelEvery / 2) || i === points.length - 1}
					<text class="axis" x={x(i)} y={height - 6} text-anchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{p.label}</text>
				{/if}
			{/each}
			<path class="area" d={area} />
			<path class="line" d={line} />
			{#if active !== null && points[active]}
				<line class="cross" x1={x(active)} x2={x(active)} y1={pad.t} y2={y(0)} />
				<circle class="dot" cx={x(active)} cy={y(points[active].value)} r="4" />
			{/if}
		</svg>
		{#if active !== null && points[active]}
			<div class="tip" style:left="{tipLeft}%" class:flip={tipLeft > 70} role="status">
				<strong>{format(points[active].value)}</strong>
				<span>{points[active].label}</span>
			</div>
		{/if}
	</div>
	<p id="tc{uid}-hint" class="sr-only">Gebruik de pijltjestoetsen om per dag de waarde te lezen. De volledige gegevens staan in de tabel hieronder.</p>
	<table class="sr-only">
		<caption>{title}</caption>
		<thead><tr><th scope="col">Datum</th><th scope="col">Waarde</th></tr></thead>
		<tbody>{#each points as p, i (i)}<tr><td>{p.label}</td><td>{format(p.value)}</td></tr>{/each}</tbody>
	</table>
</figure>

<style>
	.chart {
		margin: 0;
	}
	figcaption {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		margin-bottom: var(--space-3);
	}
	.plot {
		position: relative;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		touch-action: pan-y;
	}
	svg:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 4px;
	}
	.grid {
		stroke: var(--ui-border);
		stroke-width: 1;
	}
	.axis {
		font-size: 11px;
		fill: var(--ui-text-muted);
		font-variant-numeric: tabular-nums;
	}
	.area {
		fill: var(--ui-accent);
		opacity: 0.1;
	}
	.line {
		fill: none;
		stroke: var(--ui-accent);
		stroke-width: 2;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}
	.cross {
		stroke: var(--ui-text-muted);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}
	.dot {
		fill: var(--ui-accent);
		stroke: var(--ui-surface);
		stroke-width: 2;
	}
	.tip {
		position: absolute;
		top: 0;
		transform: translateX(12px);
		display: grid;
		gap: 2px;
		padding: var(--space-2) var(--space-3);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		box-shadow: var(--elev-md);
		font-size: var(--fs-xs);
		white-space: nowrap;
		pointer-events: none;
	}
	.tip.flip {
		transform: translateX(calc(-100% - 12px));
	}
	.tip strong {
		font-size: var(--fs-sm);
		color: var(--ui-text);
	}
	.tip span {
		color: var(--ui-text-muted);
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
