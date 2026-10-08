<!--
  @component ProductPicker — searchable multi-select of products for manual product rails (P4-01).
  Keeps the chosen order (up/down buttons). `bind:value` is an array of product ids.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';

	interface Row {
		id: string;
		name: string;
		slug: string;
		status: string;
		image: string | null;
	}
	let {
		value = $bindable([]),
		max = 16,
		onchange
	}: { value?: string[]; max?: number; onchange?: () => void } = $props();

	let q = $state('');
	let results = $state<Row[]>([]);
	let known = $state<Record<string, Row>>({});
	let searching = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function fetchRows(params: string): Promise<Row[]> {
		try {
			const r = await fetch(`/admin/content/lookup?kind=products&${params}`);
			return r.ok ? await r.json() : [];
		} catch {
			return [];
		}
	}
	function remember(rows: Row[]) {
		known = { ...known, ...Object.fromEntries(rows.map((r) => [r.id, r])) };
	}
	async function search() {
		searching = true;
		results = await fetchRows(`q=${encodeURIComponent(q)}`);
		remember(results);
		searching = false;
	}
	onMount(async () => {
		if (value.length) remember(await fetchRows(`ids=${value.join(',')}`));
	});

	function set(next: string[]) {
		value = next;
		onchange?.();
	}
	function move(i: number, d: -1 | 1) {
		const next = [...value];
		[next[i], next[i + d]] = [next[i + d], next[i]];
		set(next);
	}
</script>

<div class="pp">
	<p class="lbl">Gekozen producten ({value.length}/{max})</p>
	{#if value.length}
		<ol class="chosen">
			{#each value as id, i (id)}
				{@const p = known[id]}
				<li>
					{#if p?.image}<img src={p.image} alt="" />{:else}<span class="ph"></span>{/if}
					<span class="name"
						>{p?.name ?? id}{#if p && p.status !== 'active'}
							<Badge tone="warning">{p.status === 'draft' ? 'concept' : 'gearchiveerd'}</Badge>{/if}</span
					>
					<span class="btns">
						<Button
							size="sm"
							variant="ghost"
							icon="arrow-up"
							aria-label="Omhoog"
							disabled={i === 0}
							onclick={() => move(i, -1)}
						/>
						<Button
							size="sm"
							variant="ghost"
							icon="arrow-down"
							aria-label="Omlaag"
							disabled={i === value.length - 1}
							onclick={() => move(i, 1)}
						/>
						<Button
							size="sm"
							variant="ghost"
							icon="close"
							aria-label="Verwijder {p?.name ?? 'product'}"
							onclick={() => set(value.filter((x) => x !== id))}
						/>
					</span>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="note">Nog geen producten gekozen.</p>
	{/if}

	<Field label="Product zoeken">
		<Input
			type="search"
			placeholder="Naam of slug"
			bind:value={q}
			onfocus={() => !results.length && search()}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					search();
				}
			}}
			oninput={() => {
				clearTimeout(timer);
				timer = setTimeout(search, 250);
			}}
		/>
	</Field>
	{#if results.length}
		<ul class="results" aria-label="Zoekresultaten" aria-busy={searching}>
			{#each results as r (r.id)}
				{@const added = value.includes(r.id)}
				<li>
					<button type="button" disabled={added || value.length >= max} onclick={() => set([...value, r.id])}>
						{#if r.image}<img src={r.image} alt="" />{:else}<span class="ph"></span>{/if}
						<span class="name">{r.name}</span>
						<span class="add">{added ? 'Toegevoegd' : 'Toevoegen'}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.pp {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.lbl {
		margin: 0;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	.note {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	ol,
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}
	.chosen li,
	.results button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		background: var(--ui-surface);
		min-width: 0;
	}
	.results {
		max-height: 16rem;
		overflow: auto;
	}
	.results button {
		width: 100%;
		min-height: 2.75rem;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.results button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.results button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	img,
	.ph {
		width: 2.25rem;
		height: 2.25rem;
		object-fit: cover;
		border-radius: var(--r-xs);
		background: var(--ui-bg);
		flex-shrink: 0;
	}
	.name {
		flex: 1;
		min-width: 0;
		font-size: var(--fs-sm);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.btns {
		display: flex;
	}
	.add {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
</style>
