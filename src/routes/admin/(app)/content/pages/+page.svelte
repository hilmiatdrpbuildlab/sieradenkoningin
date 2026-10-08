<script lang="ts">
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Card from '#lib/components/admin/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { formatBrussels } from '#lib/utils/brussels-time.ts';

	let { data } = $props();
	const TYPE_LABELS: Record<string, string> = {
		home: 'Home',
		page: 'Pagina',
		legal: 'Juridisch',
		landing: 'Landingspagina'
	};
	const groups = $derived(
		(['home', 'page', 'landing', 'legal'] as const)
			.map((t) => ({ type: t, rows: data.pages.filter((p) => p.type === t) }))
			.filter((g) => g.rows.length)
	);
	const scheduled = (p: { status: string; publishAt: string | null }) =>
		p.status === 'published' && p.publishAt && new Date(p.publishAt) > new Date();
	const publicPath = (p: { type: string; slugs: { nl: string; fr: string } }, lang: 'nl' | 'fr') =>
		p.type === 'home' ? `/${lang}` : `/${lang}/${p.slugs[lang]}`;
</script>

<svelte:head><title>Pagina's — Beheer</title></svelte:head>

<PageHeader
	title="Pagina's"
	description="Homepagina, infopagina's en juridische pagina's. Alles is per blok te bewerken in het Nederlands en het Frans."
>
	{#snippet actions()}
		{#if data.canWrite}<Button href="/admin/content/pages/nieuw" icon="plus" size="sm">Nieuwe pagina</Button>{/if}
	{/snippet}
</PageHeader>

<div class="stack">
	{#each groups as g (g.type)}
		<Card title={TYPE_LABELS[g.type]} padded={false}>
			<div class="wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Titel</th>
							<th scope="col" class="md">URL</th>
							<th scope="col">Status</th>
							<th scope="col" class="lg">Blokken</th>
							<th scope="col">Vertaling</th>
							<th scope="col" class="lg">Bijgewerkt</th>
						</tr>
					</thead>
					<tbody>
						{#each g.rows as p (p.id)}
							<tr>
								<th scope="row"
									><a href="/admin/content/pages/{p.id}">{p.title.nl}</a>{#if p.title.fr}<span class="fr"
											>{p.title.fr}</span
										>{/if}</th
								>
								<td class="md"><code>{publicPath(p, 'nl')}</code><br /><code>{publicPath(p, 'fr')}</code></td>
								<td>
									{#if p.status === 'draft'}<Badge>Concept</Badge>
									{:else if scheduled(p)}<Badge tone="warning">Gepland · {formatBrussels(p.publishAt)}</Badge>
									{:else}<Badge tone="success">Gepubliceerd</Badge>{/if}
								</td>
								<td class="lg num">{p.blockCount}</td>
								<td
									>{#if p.missingFr}<Badge tone="warning">FR ontbreekt</Badge>{:else}<Badge tone="success"
											>NL + FR</Badge
										>{/if}</td
								>
								<td class="lg">{formatBrussels(p.updatedAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/each}
</div>

<style>
	.stack {
		display: grid;
		gap: var(--space-6);
	}
	.wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th,
	td {
		padding: var(--space-3) var(--space-4);
		text-align: left;
		border-top: 1px solid var(--ui-border);
		vertical-align: top;
	}
	thead th {
		border-top: 0;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--ui-text-muted);
	}
	tbody th {
		font-weight: var(--fw-medium);
	}
	tbody th a {
		color: var(--ui-text);
	}
	.fr {
		display: block;
		font-weight: var(--fw-regular);
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	code {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.md,
	.lg {
		display: none;
	}
	@media (min-width: 48rem) {
		.md {
			display: table-cell;
		}
	}
	@media (min-width: 64rem) {
		.lg {
			display: table-cell;
		}
	}
</style>
