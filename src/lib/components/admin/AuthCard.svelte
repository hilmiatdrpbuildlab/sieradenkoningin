<!-- @component AuthCard — centred card for admin login / 2FA / invite screens. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	let { title, subtitle, children }: { title: string; subtitle?: string; children: Snippet } = $props();
</script>

<main class="auth">
	<div class="card">
		<div class="brand" data-surface="inverse">
			<Icon name="crown" size={28} stroke={1} class="orn" />
			<span class="wm">Sieradenkoningin<small>Beheer</small></span>
		</div>
		<div class="body">
			<h1>{title}</h1>
			{#if subtitle}<p class="sub">{subtitle}</p>{/if}
			{@render children()}
		</div>
	</div>
</main>

<style>
	.auth {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: var(--space-6) var(--space-4);
	}
	.card {
		width: min(100%, 26rem);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		box-shadow: var(--elev-md);
		overflow: hidden;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-5) var(--space-6);
	}
	.brand :global(.orn) {
		color: var(--ui-ornament);
	}
	.wm {
		display: grid;
		font-family: var(--ff-serif);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.1;
	}
	.wm small {
		font-family: var(--ff-body);
		font-size: 0.625rem;
		letter-spacing: var(--ls-widest);
		color: var(--ui-text-muted);
	}
	.body {
		padding: var(--space-6);
		display: grid;
		gap: var(--space-4);
	}
	h1 {
		margin: 0;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
	}
	.sub {
		margin: 0;
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
</style>
