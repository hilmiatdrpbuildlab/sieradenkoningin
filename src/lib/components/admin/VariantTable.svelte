<!--
  @component VariantTable — metal × size → SKU, stock, price override and low-stock threshold.
  Rows post as `variants.N.*`. Existing rows are deleted via a `remove` flag (undoable before saving).
  The matrix generator works with JS (instant rows) and without (fields `matrix.*` are expanded on save).
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { METALS, METAL_LABELS, parseSizes, skuFor, variantMatrix, type MetalValue, type VariantModel } from '#lib/schemas/product.ts';

	interface Props {
		variants: VariantModel[];
		slug: string;
		errors?: Record<string, string[] | undefined>;
		onchange?: () => void;
	}
	let { variants = $bindable(), slug, errors = {}, onchange }: Props = $props();

	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});
	let matrixMetals = $state<MetalValue[]>([]);
	let matrixSizes = $state('');
	let status = $state('');

	const e = (i: number, f: string) => errors[`variants.${i}.${f}`]?.[0];
	const active = $derived(variants.filter((v) => !v.remove).length);

	function generate() {
		const existing = new Set(variants.map((v) => `${v.metal}|${v.size.trim()}`));
		const add = variantMatrix(slug || 'product', matrixMetals, parseSizes(matrixSizes)).filter((r) => !existing.has(`${r.metal}|${r.size}`));
		variants = [...variants, ...add.map((r) => ({ sku: r.sku, metal: r.metal, size: r.size, stock: '0', priceOverride: '', lowStockThreshold: '2' }))];
		status = add.length ? `${add.length} varianten toegevoegd` : 'Geen nieuwe combinaties';
		matrixMetals = [];
		matrixSizes = '';
		onchange?.();
	}
	function addRow() {
		const metal = (variants.at(-1)?.metal as MetalValue) ?? 'gold';
		variants = [...variants, { sku: skuFor(slug || 'product', metal), metal, size: '', stock: '0', priceOverride: '', lowStockThreshold: '2' }];
		onchange?.();
	}
	function toggleRemove(i: number) {
		const v = variants[i];
		if (!v.id) variants = variants.filter((_, j) => j !== i);
		else variants[i] = { ...v, remove: v.remove ? undefined : 'on' };
		status = v.id && !v.remove ? `Variant ${v.sku} wordt verwijderd bij opslaan` : '';
		onchange?.();
	}
	function move(i: number, d: number) {
		const j = i + d;
		if (j < 0 || j >= variants.length) return;
		const next = [...variants];
		[next[i], next[j]] = [next[j], next[i]];
		variants = next;
		onchange?.();
	}
	function suggestSku(i: number) {
		// new rows follow the SKU convention while metal / size change; saved rows keep their SKU
		const v = variants[i];
		if (!v.id) variants[i] = { ...v, sku: skuFor(slug || 'product', v.metal as MetalValue, v.size) };
	}
</script>

<div class="variants">
	{#if errors.variants?.[0]}<p class="error" role="alert"><Icon name="alert" size={14} />{errors.variants[0]}</p>{/if}

	<!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable region must be keyboard-focusable) -->
	<div class="scroller" tabindex="0" role="region" aria-label="Varianten">
		<table>
			<thead>
				<tr>
					<th>Metaal</th>
					<th>Maat</th>
					<th>SKU</th>
					<th class="num">Voorraad</th>
					<th class="num">Prijs (€)</th>
					<th class="num">Drempel</th>
					<th><span class="sr-only">Acties</span></th>
				</tr>
			</thead>
			<tbody>
				{#each variants as v, i (v.id ?? `new-${i}`)}
					<tr class:removed={!!v.remove}>
						<td>
							{#if v.id}<input type="hidden" name="variants.{i}.id" value={v.id} />{/if}
							{#if mounted && v.remove}<input type="hidden" name="variants.{i}.remove" value="on" />{/if}
							<label class="sr-only" for="v{i}-metal">Metaal variant {i + 1}</label>
							<select id="v{i}-metal" name="variants.{i}.metal" bind:value={v.metal} onchange={() => (suggestSku(i), onchange?.())} disabled={!!v.remove}>
								{#each METALS as m (m)}<option value={m}>{METAL_LABELS[m]}</option>{/each}
							</select>
						</td>
						<td>
							<label class="sr-only" for="v{i}-size">Maat variant {i + 1}</label>
							<input id="v{i}-size" class="sm" name="variants.{i}.size" bind:value={v.size} oninput={() => (suggestSku(i), onchange?.())} placeholder="—" readonly={!!v.remove} aria-invalid={!!e(i, 'size') || undefined} />
							{#if e(i, 'size')}<p class="error"><Icon name="alert" size={12} />{e(i, 'size')}</p>{/if}
						</td>
						<td>
							<label class="sr-only" for="v{i}-sku">SKU variant {i + 1}</label>
							<input id="v{i}-sku" class="sku" name="variants.{i}.sku" bind:value={v.sku} oninput={onchange} readonly={!!v.remove} aria-invalid={!!e(i, 'sku') || undefined} />
							{#if e(i, 'sku')}<p class="error"><Icon name="alert" size={12} />{e(i, 'sku')}</p>{/if}
						</td>
						<td class="num">
							<label class="sr-only" for="v{i}-stock">Voorraad variant {i + 1}</label>
							<input id="v{i}-stock" class="xs" type="number" min="0" step="1" name="variants.{i}.stock" bind:value={v.stock} oninput={onchange} readonly={!!v.remove} aria-invalid={!!e(i, 'stock') || undefined} />
							{#if e(i, 'stock')}<p class="error"><Icon name="alert" size={12} />{e(i, 'stock')}</p>{/if}
						</td>
						<td class="num">
							<label class="sr-only" for="v{i}-price">Afwijkende prijs variant {i + 1}</label>
							<input id="v{i}-price" class="xs" inputmode="decimal" name="variants.{i}.priceOverride" bind:value={v.priceOverride} oninput={onchange} placeholder="—" readonly={!!v.remove} aria-invalid={!!e(i, 'priceOverride') || undefined} />
							{#if e(i, 'priceOverride')}<p class="error"><Icon name="alert" size={12} />{e(i, 'priceOverride')}</p>{/if}
						</td>
						<td class="num">
							<label class="sr-only" for="v{i}-low">Lage-voorraaddrempel variant {i + 1}</label>
							<input id="v{i}-low" class="xs" type="number" min="0" step="1" name="variants.{i}.lowStockThreshold" bind:value={v.lowStockThreshold} oninput={onchange} readonly={!!v.remove} />
						</td>
						<td class="act">
							{#if mounted}
								<button type="button" aria-label="Variant {i + 1} omhoog" disabled={i === 0} onclick={() => move(i, -1)}><Icon name="arrow-up" size={14} /></button>
								<button type="button" aria-label="Variant {i + 1} omlaag" disabled={i === variants.length - 1} onclick={() => move(i, 1)}><Icon name="arrow-down" size={14} /></button>
								<button type="button" aria-label={v.remove ? `Verwijderen van ${v.sku} ongedaan maken` : `Variant ${v.sku || i + 1} verwijderen`} onclick={() => toggleRemove(i)}>
									<Icon name={v.remove ? 'refresh' : 'trash'} size={14} />
								</button>
							{:else}
								<label class="rm"><input type="checkbox" name="variants.{i}.remove" checked={!!v.remove} /> Verwijderen</label>
							{/if}
						</td>
					</tr>
				{:else}
					<tr><td colspan="7" class="empty">Nog geen varianten. Genereer ze hieronder uit metaal × maat.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="sr-only" role="status" aria-live="polite">{status}</p>

	<fieldset class="matrix">
		<legend>Varianten genereren (metaal × maat)</legend>
		<div class="metals">
			{#each METALS as m (m)}
				<label><input type="checkbox" name="matrix.metals" value={m} bind:group={matrixMetals} /> {METAL_LABELS[m]}</label>
			{/each}
		</div>
		<label class="sizes">
			<span>Maten (komma-gescheiden, leeg = geen maat)</span>
			<input name="matrix.sizes" bind:value={matrixSizes} placeholder="bv. 50, 52, 54, 56 of S, M, L" />
		</label>
		{#if mounted}
			<div class="gen">
				<Button size="sm" variant="outline" icon="layers" onclick={generate} disabled={!matrixMetals.length}>Genereer</Button>
				<Button size="sm" variant="ghost" icon="plus" onclick={addRow}>Losse variant</Button>
			</div>
		{:else}
			<p class="hint">Nieuwe combinaties worden aangemaakt wanneer je opslaat.</p>
		{/if}
	</fieldset>
	<p class="hint">{active} variant{active === 1 ? '' : 'en'} · voorraadwijzigingen worden gelogd als correctie.</p>
</div>

<style>
	.variants {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}
	.scroller {
		position: relative;
		overflow-x: auto;
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
	}
	.scroller:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: var(--space-2);
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid var(--ui-border);
	}
	th {
		background: var(--ui-surface-sunken);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--ui-text-muted);
		white-space: nowrap;
	}
	.num {
		text-align: right;
	}
	tr.removed td {
		background: var(--ui-danger-bg);
	}
	tr.removed :is(input, select) {
		text-decoration: line-through;
		opacity: 0.6;
	}
	input,
	select {
		height: 2.5rem;
		padding-inline: var(--space-2);
		font: inherit;
		font-size: var(--fs-sm);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		min-width: 0;
	}
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 0;
	}
	input[aria-invalid='true'] {
		border-color: var(--ui-danger);
	}
	select {
		width: 6.75rem;
	}
	.sku {
		width: 11rem;
		font-family: var(--ff-mono, monospace);
		font-size: var(--fs-xs);
	}
	.sm {
		width: 4.5rem;
	}
	.xs {
		width: 5.5rem;
		text-align: right;
	}
	.act {
		white-space: nowrap;
	}
	.act button {
		width: 2.25rem;
		height: 2.25rem;
		display: inline-grid;
		place-items: center;
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		cursor: pointer;
	}
	.act button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.act button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.rm {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--fs-xs);
		min-height: 2.5rem;
	}
	.rm input {
		height: auto;
	}
	.empty {
		text-align: center;
		color: var(--ui-text-muted);
		padding: var(--space-6);
	}
	.error {
		display: flex;
		gap: 4px;
		align-items: center;
		margin: 2px 0 0;
		font-size: var(--fs-xs);
		color: var(--ui-danger);
		white-space: normal;
		max-width: 14rem;
	}
	.matrix {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: var(--space-4);
		border: 1px dashed var(--ui-border-strong);
		border-radius: var(--r-sm);
	}
	legend {
		padding-inline: var(--space-1);
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	.metals {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		font-size: var(--fs-sm);
	}
	.metals label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
	}
	.metals input {
		height: 1rem;
		width: 1rem;
		accent-color: var(--ui-action);
	}
	.sizes {
		display: grid;
		gap: 4px;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.sizes input {
		width: 100%;
	}
	.gen {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
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
