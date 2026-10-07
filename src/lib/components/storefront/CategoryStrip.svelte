<!--
  @component CategoryStrip — the six categories as HD icon (72px) + uppercase label, mirroring the
  brand board. Horizontal scroll-snap on mobile, 6-column grid on desktop.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { IconName } from '#lib/components/ui/icons.ts';
	import { reveal } from '#lib/actions/reveal.ts';
	import type { CategoryNav } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { title, eyebrow, categories }: { title?: string; eyebrow?: string; categories: CategoryNav[] } = $props();
	const uid = $props.id();
</script>

<section class="strip" aria-labelledby="cs{uid}">
	<div class="container-lux">
		<header class="head">
			{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
			<h2 id="cs{uid}">{title || m.categories_title()}</h2>
		</header>
		<ul class="list" use:reveal={{ stagger: true }}>
			{#each categories as c (c.key)}
				<li>
					<a href={c.href}>
						<span class="ico"><Icon name={c.icon as IconName} size={72} stroke={0.9} /></span>
						<span class="label">{c.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.strip {
		padding-block: var(--section-y-sm);
	}
	.head {
		text-align: center;
		margin-bottom: var(--space-10);
	}
	.head h2 {
		margin: var(--space-2) 0 0;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(7.5rem, 1fr);
		gap: var(--space-4);
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	@media (min-width: 64rem) {
		.list {
			grid-auto-flow: row;
			grid-template-columns: repeat(6, 1fr);
			overflow: visible;
		}
	}
	li {
		scroll-snap-align: start;
	}
	a {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		padding: var(--space-6) var(--space-2);
		text-decoration: none;
		border: 1px solid transparent;
		transition: border-color var(--dur-base) var(--motion-out);
	}
	a:hover {
		border-color: var(--ui-border);
	}
	.ico {
		color: var(--ui-text);
		transition: transform var(--dur-slow) var(--motion-out);
	}
	a:hover .ico {
		transform: translateY(-4px);
		color: var(--ui-accent);
	}
	.label {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
</style>
