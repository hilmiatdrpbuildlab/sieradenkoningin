<script lang="ts">
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Dashboard — Beheer</title></svelte:head>
<PageHeader title="Welkom, {data.admin.name}" description="Overzicht van je winkel." />
