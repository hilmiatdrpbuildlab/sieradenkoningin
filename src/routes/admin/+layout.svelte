<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div data-theme="admin" class="admin-root">
	{@render children()}
</div>

<style>
	.admin-root {
		min-height: 100dvh;
		background: var(--ui-bg);
		color: var(--ui-text);
		font-size: var(--fs-base);
	}
</style>
