<!--
  @component Turnstile — Cloudflare Turnstile widget for public forms. Renders nothing when no site
  key is configured (dev/tests); the server then skips verification (adapters/turnstile.ts).
  The script is loaded lazily on mount, only on pages that contain a protected form.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_TURNSTILE_SITE_KEY } from '$app/env/public';

	let el: HTMLDivElement | undefined = $state();

	onMount(() => {
		if (!PUBLIC_TURNSTILE_SITE_KEY || !el) return;
		const id = 'cf-turnstile-script';
		if (!document.getElementById(id)) {
			const s = document.createElement('script');
			s.id = id;
			s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
			s.async = true;
			s.defer = true;
			document.head.appendChild(s);
		}
	});
</script>

{#if PUBLIC_TURNSTILE_SITE_KEY}
	<div bind:this={el} class="cf-turnstile" data-sitekey={PUBLIC_TURNSTILE_SITE_KEY} data-theme="light" data-language="auto"></div>
{/if}
