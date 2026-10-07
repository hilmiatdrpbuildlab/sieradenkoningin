<!--
  @component MegaMenu (≥ lg) — "Collecties" disclosure: category links left, two editorial tiles right.
  Opens on hover after a 150 ms intent delay, or on click/Enter; closes on Esc (focus returns to the
  trigger), on outside click and when focus leaves the panel.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import type { CategoryNav } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Tile {
		label: string;
		href: string;
		image: string;
	}
	let { label, categories, tiles = [] }: { label: string; categories: CategoryNav[]; tiles?: Tile[] } = $props();

	let open = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let trigger: HTMLButtonElement;
	let root: HTMLDivElement;
	const uid = $props.id();

	function intent(next: boolean) {
		clearTimeout(timer);
		timer = setTimeout(() => (open = next), next ? 150 : 200);
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			trigger.focus();
		}
	}
	function onFocusOut(e: FocusEvent) {
		if (!root.contains(e.relatedTarget as Node)) open = false;
	}
</script>

<svelte:window onclick={(e) => open && !root.contains(e.target as Node) && (open = false)} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="mega" bind:this={root} onmouseenter={() => intent(true)} onmouseleave={() => intent(false)} onkeydown={onKey} onfocusout={onFocusOut}>
	<button bind:this={trigger} type="button" class="trigger" aria-expanded={open} aria-controls="mega{uid}" onclick={() => (open = !open)}>
		{label}
		<Icon name="chevron-down" size={12} />
	</button>
	<div id="mega{uid}" class="panel" class:open hidden={!open}>
		<div class="inner container-lux">
			<ul class="cats">
				{#each categories as c (c.key)}
					<li>
						<a href={c.href} onclick={() => (open = false)}>
							<Icon name={c.icon as IconName} size={36} stroke={1} />
							<span>{c.label}</span>
						</a>
					</li>
				{/each}
			</ul>
			<div class="tiles">
				{#each tiles as t (t.href)}
					<a class="tile" href={t.href} onclick={() => (open = false)}>
						<img src={t.image} alt="" loading="lazy" width="400" height="500" />
						<span class="eyebrow">{t.label}</span>
					</a>
				{/each}
			</div>
		</div>
		<p class="sr-only">{m.nav_categories()}</p>
	</div>
</div>

<style>
	.mega {
		position: static;
	}
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2.75rem;
		background: none;
		border: 0;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	.trigger[aria-expanded='true'] :global(svg) {
		transform: rotate(180deg);
	}
	.panel {
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		background: var(--ui-bg);
		color: var(--ui-text);
		border-top: 1px solid var(--ui-border);
		box-shadow: var(--elev-lg);
		opacity: 0;
		transform: translateY(-6px);
		transition:
			opacity var(--dur-base) var(--motion-out),
			transform var(--dur-base) var(--motion-out);
	}
	.panel.open {
		opacity: 1;
		transform: none;
	}
	.inner {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-12);
		padding-block: var(--space-10);
	}
	.cats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-2) var(--space-8);
		align-content: start;
	}
	.cats a {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding-block: var(--space-3);
		text-decoration: none;
		font-family: var(--ff-display);
		font-size: var(--fs-xl);
		border-bottom: 1px solid var(--ui-border);
	}
	.cats a :global(svg) {
		color: var(--ui-accent);
	}
	.cats a:hover span {
		text-decoration: underline;
		text-underline-offset: 0.25em;
	}
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}
	.tile {
		position: relative;
		display: block;
		aspect-ratio: var(--ratio-product);
		overflow: hidden;
		text-decoration: none;
		background: var(--ui-surface-sunken);
	}
	.tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 1.2s var(--motion-out);
	}
	.tile:hover img {
		transform: scale(1.04);
	}
	.tile .eyebrow {
		position: absolute;
		left: var(--space-4);
		bottom: var(--space-4);
		padding: var(--space-2) var(--space-3);
		background: var(--ui-glass);
		color: var(--ui-text-strong);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
