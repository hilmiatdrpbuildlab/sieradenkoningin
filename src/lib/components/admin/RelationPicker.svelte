<!--
  @component RelationPicker — ordered list of products (relations, manual collections).
  Posts one `name` field per product id, in order. With JS: add from the select instantly, reorder
  with ↑/↓ buttons or drag, remove with ×. Without JS: `${name}Add` (select) and `${name}Remove`
  (checkboxes) are applied by the server on save — see `applyListEdits()`.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';

	interface Option {
		id: string;
		name: string;
		image?: string | null;
		status?: string;
	}
	interface Props {
		name: string;
		label: string;
		ids: string[];
		options: Option[];
		hint?: string;
		max?: number;
		onchange?: () => void;
	}
	let { name, label, ids = $bindable(), options, hint, max = 24, onchange }: Props = $props();

	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});
	let dragIndex = $state<number | null>(null);
	let status = $state('');
	const uid = $props.id();

	const byId = $derived(new Map(options.map((o) => [o.id, o])));
	const available = $derived(options.filter((o) => !ids.includes(o.id)));

	function add(id: string) {
		if (!id || ids.includes(id) || ids.length >= max) return;
		ids = [...ids, id];
		status = `${byId.get(id)?.name ?? 'Product'} toegevoegd`;
		onchange?.();
	}
	function remove(i: number) {
		status = `${byId.get(ids[i])?.name ?? 'Product'} verwijderd`;
		ids = ids.filter((_, j) => j !== i);
		onchange?.();
	}
	function move(from: number, to: number) {
		if (to < 0 || to >= ids.length || from === to) return;
		const next = [...ids];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item);
		ids = next;
		status = `${byId.get(item)?.name ?? 'Product'} naar positie ${to + 1}`;
		onchange?.();
	}
</script>

<div class="picker">
	<p class="label" id="rp{uid}">{label}</p>
	{#if hint}<p class="hint">{hint}</p>{/if}
	{#if ids.length}
		<ol class="list" aria-labelledby="rp{uid}">
			{#each ids as id, i (id)}
				{@const o = byId.get(id)}
				<li
					draggable={mounted}
					ondragstart={() => (dragIndex = i)}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						if (dragIndex !== null) move(dragIndex, i);
						dragIndex = null;
					}}
				>
					<input type="hidden" {name} value={id} />
					{#if mounted}<span class="grip" aria-hidden="true"><Icon name="grip" size={14} /></span>{/if}
					<span class="pos">{i + 1}</span>
					{#if o?.image}<img src={o.image} alt="" width="32" height="40" />{:else}<span class="ph" aria-hidden="true"></span>{/if}
					<span class="name">{o?.name ?? 'Onbekend product'}{#if o?.status && o.status !== 'active'}<small> · {o.status === 'draft' ? 'concept' : 'gearchiveerd'}</small>{/if}</span>
					{#if mounted}
						<span class="btns">
							<button type="button" aria-label="{o?.name} omhoog" disabled={i === 0} onclick={() => move(i, i - 1)}><Icon name="arrow-up" size={14} /></button>
							<button type="button" aria-label="{o?.name} omlaag" disabled={i === ids.length - 1} onclick={() => move(i, i + 1)}><Icon name="arrow-down" size={14} /></button>
							<button type="button" aria-label="{o?.name} verwijderen" onclick={() => remove(i)}><Icon name="close" size={14} /></button>
						</span>
					{:else}
						<label class="rm"><input type="checkbox" name="{name}Remove" value={id} /> Verwijderen</label>
					{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">Nog geen producten gekozen.</p>
	{/if}
	{#if ids.length < max}
		<label class="add">
			<span class="sr-only">Product toevoegen aan {label}</span>
			<select
				name={mounted ? undefined : `${name}Add`}
				onchange={(e) => {
					add(e.currentTarget.value);
					e.currentTarget.value = '';
				}}
			>
				<option value="">+ Product toevoegen…</option>
				{#each available as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
			</select>
		</label>
	{/if}
	<p class="sr-only" role="status" aria-live="polite">{status}</p>
</div>

<style>
	.picker {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	.label {
		margin: 0;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	.hint,
	.empty {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 3rem;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		font-size: var(--fs-sm);
	}
	li[draggable='true'] {
		cursor: grab;
	}
	.grip {
		color: var(--ui-text-muted);
		display: grid;
	}
	.pos {
		width: 1.5rem;
		text-align: right;
		color: var(--ui-text-muted);
		font-variant-numeric: tabular-nums;
		font-size: var(--fs-xs);
	}
	img,
	.ph {
		width: 2rem;
		height: 2.5rem;
		object-fit: cover;
		border-radius: var(--r-xs);
		background: var(--ui-surface-sunken);
		flex: none;
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name small {
		color: var(--ui-text-muted);
	}
	.btns {
		display: flex;
		gap: 2px;
	}
	.btns button {
		width: 2.25rem;
		height: 2.25rem;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: var(--r-xs);
		background: none;
		color: var(--ui-text);
		cursor: pointer;
	}
	.btns button:hover {
		border-color: var(--ui-border);
	}
	.btns button:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.btns button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.rm {
		display: flex;
		gap: 4px;
		align-items: center;
		font-size: var(--fs-xs);
	}
	.add select {
		width: 100%;
		height: 2.5rem;
		padding-inline: var(--space-2);
		font: inherit;
		font-size: var(--fs-sm);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
	}
	.add select:focus-visible {
		outline: 2px solid var(--ui-border-focus);
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
