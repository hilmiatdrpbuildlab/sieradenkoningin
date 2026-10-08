<!--
  @component MediaPicker — choose an existing image from the media library (P4-01) and edit its alt
  text per language. Stores `{ key, alt, width?, height? }` (the block image shape). Uploading new
  images happens in Beheer → Media.
-->
<script lang="ts">
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import I18nInput from './I18nInput.svelte';
	import { img } from '#lib/utils/media.ts';

	type I18n = { nl: string; fr?: string };
	type ImageRef = { key: string; alt: I18n; width?: number; height?: number };
	interface MediaRow {
		id: string;
		key: string;
		url: string;
		alt: I18n;
		width: number | null;
		height: number | null;
	}
	let {
		label = 'Afbeelding',
		value = $bindable(),
		onchange
	}: { label?: string; value?: ImageRef | null; onchange?: () => void } = $props();

	let open = $state(false);
	let q = $state('');
	let rows = $state<MediaRow[]>([]);
	let loading = $state(false);
	let failed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function search() {
		loading = true;
		failed = false;
		try {
			const r = await fetch(`/admin/content/lookup?kind=media&q=${encodeURIComponent(q)}`);
			rows = r.ok ? await r.json() : [];
			failed = !r.ok;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}
	function openPicker() {
		open = true;
		search();
	}
	function choose(m: MediaRow) {
		const alt = value?.alt?.nl ? value.alt : { nl: m.alt?.nl ?? '', ...(m.alt?.fr ? { fr: m.alt.fr } : {}) };
		value = { key: m.key, alt, ...(m.width ? { width: m.width } : {}), ...(m.height ? { height: m.height } : {}) };
		open = false;
		onchange?.();
	}
</script>

<fieldset class="mp">
	<legend>{label}</legend>
	<div class="row">
		<div class="thumb">
			{#if value?.key}<img src={img(value.key, 400)} alt="" loading="lazy" />{:else}<span>Geen afbeelding</span>{/if}
		</div>
		<div class="meta">
			{#if value?.key}<code>{value.key}</code>{/if}
			<Button size="sm" variant="outline" icon="image" onclick={openPicker}
				>{value?.key ? 'Andere afbeelding' : 'Kies afbeelding'}</Button
			>
		</div>
	</div>
	{#if value}
		<I18nInput
			label="Alt-tekst"
			bind:value={value.alt}
			required
			hint="Beschrijf wat er te zien is (toegankelijkheid + SEO)."
			{onchange}
		/>
	{/if}
</fieldset>

<Dialog bind:open title="Kies uit de mediabibliotheek" size="lg">
	<!-- not a <form>: the picker lives inside the page editor form -->
	<div class="search" role="search">
		<Field label="Zoeken" hideLabel>
			<Input
				type="search"
				placeholder="Zoek op bestandsnaam of alt-tekst"
				bind:value={q}
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
	</div>
	{#if failed}
		<p class="note" role="alert">Laden mislukt. Probeer opnieuw.</p>
	{:else if loading && !rows.length}
		<p class="note">Laden…</p>
	{:else if !rows.length}
		<p class="note">Geen afbeeldingen gevonden. Upload nieuwe beelden via Beheer → Media.</p>
	{:else}
		<ul class="grid">
			{#each rows as m (m.id)}
				<li>
					<button type="button" onclick={() => choose(m)} aria-pressed={value?.key === m.key}>
						<img src={m.url} alt="" loading="lazy" />
						<span>{m.alt?.nl || m.key.split('/').pop()}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Dialog>

<style>
	.mp {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		min-width: 0;
	}
	legend {
		padding-inline: var(--space-1);
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	.row {
		display: flex;
		gap: var(--space-3);
		align-items: center;
	}
	.thumb {
		width: 6rem;
		aspect-ratio: 4 / 3;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: var(--ui-bg);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		overflow: hidden;
		font-size: var(--fs-2xs);
		color: var(--ui-text-muted);
		text-align: center;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.meta {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
		min-width: 0;
	}
	code {
		font-size: var(--fs-2xs);
		color: var(--ui-text-muted);
		word-break: break-all;
	}
	.search {
		margin-bottom: var(--space-4);
	}
	.note {
		color: var(--ui-text-muted);
		font-size: var(--fs-sm);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: var(--space-3);
	}
	.grid button {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		padding: var(--space-1);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
	}
	.grid button:hover,
	.grid button[aria-pressed='true'] {
		border-color: var(--ui-action);
		box-shadow: 0 0 0 1px var(--ui-action);
	}
	.grid button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.grid img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		background: var(--ui-bg);
	}
	.grid span {
		font-size: var(--fs-2xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
