<!--
  @component MenuEditor — rows of NL/FR label + NL/FR link for one menu (P4-02). Rendered as plain,
  named form inputs (label_nl[], label_fr[], href_nl[], href_fr[], children[]) so it also works
  without JS: move/remove are submit buttons (name="move" value="3:up", name="remove" value="3") that
  the server applies; with JS they reorder/remove client-side. One empty row is always available.
-->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';

	type I18n = { nl: string; fr?: string };
	interface MenuRow {
		label: I18n;
		href: I18n;
		children?: unknown[];
	}
	let { items, errors = {} }: { items: MenuRow[]; errors?: Record<string, string[]> } = $props();

	const blank = (): MenuRow => ({ label: { nl: '', fr: '' }, href: { nl: '', fr: '' } });
	// svelte-ignore state_referenced_locally (editable copy; the page re-mounts the editor after saving)
	let rows = $state<MenuRow[]>([...items.map((i) => structuredClone(i)), blank()]);
	let announce = $state('');

	function move(e: Event, i: number, d: -1 | 1) {
		e.preventDefault();
		const j = i + d;
		if (j < 0 || j >= rows.length) return;
		[rows[i], rows[j]] = [rows[j], rows[i]];
		announce = `Item verplaatst naar positie ${j + 1}`;
	}
	function remove(e: Event, i: number) {
		e.preventDefault();
		rows.splice(i, 1);
		if (!rows.length) rows.push(blank());
		announce = 'Item verwijderd';
	}
	const err = (i: number, k: string) => errors[`${i}.${k}`]?.[0];
</script>

<p class="sr-only" aria-live="polite">{announce}</p>
<div class="wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">#</th>
				<th scope="col">Label NL</th>
				<th scope="col">Label FR</th>
				<th scope="col">Link NL</th>
				<th scope="col">Link FR</th>
				<th scope="col"><span class="sr-only">Acties</span></th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row, i (row)}
				{@const last = i === rows.length - 1}
				<tr class:new={last && !row.label.nl && !row.href.nl}>
					<td class="n">{last && !row.label.nl ? '+' : i + 1}</td>
					<td>
						<input
							aria-label="Label NL, item {i + 1}"
							name="label_nl"
							bind:value={row.label.nl}
							aria-invalid={!!err(i, 'label') || undefined}
							placeholder={last ? 'Nieuw item' : ''}
						/>
						{#if err(i, 'label')}<span class="e">{err(i, 'label')}</span>{/if}
					</td>
					<td
						><input
							aria-label="Label FR, item {i + 1}"
							name="label_fr"
							lang="fr"
							bind:value={() => row.label.fr ?? '', (v) => (row.label.fr = v)}
						/></td
					>
					<td>
						<input
							aria-label="Link NL, item {i + 1}"
							name="href_nl"
							bind:value={row.href.nl}
							placeholder="/nl/…"
							aria-invalid={!!err(i, 'href') || undefined}
						/>
						{#if err(i, 'href')}<span class="e">{err(i, 'href')}</span>{/if}
					</td>
					<td
						><input
							aria-label="Link FR, item {i + 1}"
							name="href_fr"
							bind:value={() => row.href.fr ?? '', (v) => (row.href.fr = v)}
							placeholder="/fr/…"
						/></td
					>
					<td class="act">
						<input type="hidden" name="children" value={JSON.stringify(row.children ?? [])} />
						<Button
							type="submit"
							size="sm"
							variant="ghost"
							icon="arrow-up"
							name="move"
							value="{i}:up"
							aria-label="Item {i + 1} omhoog"
							disabled={i === 0}
							onclick={(e) => move(e, i, -1)}
						/>
						<Button
							type="submit"
							size="sm"
							variant="ghost"
							icon="arrow-down"
							name="move"
							value="{i}:down"
							aria-label="Item {i + 1} omlaag"
							disabled={i >= rows.length - 1}
							onclick={(e) => move(e, i, 1)}
						/>
						<Button
							type="submit"
							size="sm"
							variant="ghost"
							icon="trash"
							name="remove"
							value={String(i)}
							aria-label="Item {i + 1} verwijderen"
							onclick={(e) => remove(e, i)}
						/>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<div><Button size="sm" variant="ghost" icon="plus" onclick={() => rows.push(blank())}>Rij toevoegen</Button></div>

<style>
	.wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		min-width: 46rem;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th {
		text-align: left;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--ui-text-muted);
		padding: 0 var(--space-1) var(--space-2);
	}
	td {
		padding: var(--space-1);
		vertical-align: top;
	}
	.n {
		width: 2rem;
		color: var(--ui-text-muted);
		font-variant-numeric: tabular-nums;
		padding-top: var(--space-3);
	}
	input {
		width: 100%;
		height: 2.5rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-sm);
		background: var(--ui-surface);
		color: var(--ui-text);
		font: inherit;
	}
	input:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 0;
	}
	input[aria-invalid='true'] {
		border-color: var(--ui-danger);
	}
	tr.new input {
		border-style: dashed;
	}
	.act {
		white-space: nowrap;
		width: 1%;
	}
	.e {
		display: block;
		margin-top: 2px;
		font-size: var(--fs-2xs);
		color: var(--ui-danger);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
