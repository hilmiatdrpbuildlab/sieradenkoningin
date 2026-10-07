<!--
  @component Icon — line-art icon from the brand registry.
  • UI icons: 24×24 grid.  • Category icons (ring, bracelet, …): HD 64×64 grid.
  Category icons are finer-lined by design (stroke × 1.3 on the 64 grid ≈ 1px at 48px).
  Decorative by default (aria-hidden). Pass `label` when the icon carries meaning
  on its own (icon-only buttons should label the BUTTON instead).
  <Icon name="crown" size={28} class="text-ornament" />
  <Icon name="necklace" size={56} stroke={1} />
-->
<script lang="ts">
	import { icons, categoryIcons, type IconName } from './icons.ts';
	import { CATEGORY_VIEWBOX } from './category-icons.ts';

	interface Props {
		name: IconName;
		size?: number | string;
		stroke?: number;
		label?: string;
		class?: string;
	}

	let { name, size = 20, stroke = 1.25, label, class: className = '' }: Props = $props();

	const isCategory = $derived(name in categoryIcons);
	const grid = $derived(isCategory ? CATEGORY_VIEWBOX : 24);
	const body = $derived(
		isCategory ? categoryIcons[name as keyof typeof categoryIcons] : icons[name as keyof typeof icons]
	);
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 {grid} {grid}"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width={isCategory ? stroke * 1.3 : stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	class="icon {className}"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false"
>
	{@html body}
</svg>

<style>
	.icon {
		display: inline-block;
		flex-shrink: 0;
		vertical-align: middle;
	}
</style>
