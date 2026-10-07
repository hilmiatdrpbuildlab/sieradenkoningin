<!-- @component Skeleton — placeholder block while content loads. Shimmer is disabled under reduced motion. -->
<script lang="ts">
	let { width = '100%', height = '1rem', ratio, class: className = '' }: { width?: string; height?: string; ratio?: string; class?: string } = $props();
</script>

<span class="sk {className}" style:width style:height={ratio ? undefined : height} style:aspect-ratio={ratio} aria-hidden="true"></span>

<style>
	.sk {
		display: block;
		background: linear-gradient(90deg, var(--ui-surface-sunken) 25%, var(--ui-border) 37%, var(--ui-surface-sunken) 63%) 0 0 / 400% 100%;
		animation: shimmer 1.4s ease infinite;
	}
	@keyframes shimmer {
		to {
			background-position: -100% 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sk {
			animation: none;
		}
	}
</style>
