<!-- @component NewsletterBlock — home/landing newsletter signup on espresso. -->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import NewsletterForm from '#lib/components/storefront/NewsletterForm.svelte';
	import type { Lang } from '#lib/i18n/paths.ts';
	let { title, text, lang }: { title: string; text?: string; lang: Lang } = $props();
	const uid = $props.id();
</script>

<section class="nlb" data-surface="espresso" aria-labelledby="nlb{uid}">
	<div class="inner container-lux">
		<Icon name="sparkle" size={20} class="orn" />
		<h2 id="nlb{uid}">{title}</h2>
		{#if text}<p>{text}</p>{/if}
		<NewsletterForm {lang} source="home" />
	</div>
</section>

<style>
	.nlb {
		padding-block: var(--section-y-sm);
	}
	.inner {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		text-align: center;
		max-width: 40rem;
	}
	.inner :global(.orn) {
		color: var(--ui-accent);
	}
	h2 {
		margin: 0;
		color: var(--ui-text);
	}
	p {
		margin: 0;
		color: var(--ui-text-muted);
	}
</style>
