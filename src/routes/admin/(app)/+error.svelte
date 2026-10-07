<!-- Admin error page inside the admin shell (403 for role restrictions, 404, 500). -->
<script lang="ts">
	import { page } from '$app/state';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	const title = $derived(page.status === 403 ? 'Geen toegang' : page.status === 404 ? 'Niet gevonden' : 'Er ging iets mis');
</script>

<svelte:head><title>{title} — Beheer</title></svelte:head>

<EmptyState icon={page.status === 403 ? 'lock' : 'alert'} {title} text={page.error?.message ?? ''}>
	{#snippet action()}<Button href="/admin" variant="outline" size="sm">Terug naar het beheer</Button>{/snippet}
</EmptyState>
