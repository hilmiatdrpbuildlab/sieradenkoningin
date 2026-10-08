<!--
  @component BlockEditor — edits one CMS block in the page builder (P4-01): NL/FR fields per block type,
  image picker, product-rail sources, hide toggle and schedule (visible from/until, entered in
  Europe/Brussels, stored as UTC ISO). Reordering: drag the grip (parent handles drop) or use the
  keyboard-accessible up/down buttons.
-->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import I18nInput from './I18nInput.svelte';
	import MediaPicker from './MediaPicker.svelte';
	import ProductPicker from './ProductPicker.svelte';
	import { BLOCK_LABELS, blockSummary, type EditorBlock } from './block-defaults.ts';
	import { fromBrusselsInput, toBrusselsInput, formatBrussels } from '#lib/utils/brussels-time.ts';
	import { isBlockVisible } from '#lib/schemas/page-block.ts';

	interface Props {
		block: EditorBlock;
		index: number;
		total: number;
		open?: boolean;
		collections: { id: string; name: string }[];
		faqGroups: string[];
		legalSlots: { key: string; label: string }[];
		error?: string | null;
		onmove: (delta: -1 | 1) => void;
		onremove: () => void;
		onduplicate: () => void;
		ongrab?: () => void;
	}
	let {
		block = $bindable(),
		index,
		total,
		open = $bindable(false),
		collections,
		faqGroups,
		legalSlots,
		error,
		onmove,
		onremove,
		onduplicate,
		ongrab
	}: Props = $props();

	const uid = $props.id();
	const d = $derived(block.data);
	const scheduled = $derived(!!(block.visibleFrom || block.visibleUntil));
	const liveNow = $derived(isBlockVisible(block));

	const ICONS = ['truck', 'gift', 'sparkle', 'crown', 'clover', 'check'].map((v) => ({ value: v, label: v }));
	const SOURCES = [
		{ value: 'new', label: 'Nieuw binnen' },
		{ value: 'bestsellers', label: 'Bestsellers' },
		{ value: 'featured', label: 'Uitgelicht' },
		{ value: 'collection', label: 'Collectie' },
		{ value: 'manual', label: 'Handmatig gekozen' }
	];
	const HREF_HINT = 'Volledig pad per taal, bv. /nl/collectie/nieuw en /fr/collection/nouveautes';

	function addLink(key: string) {
		block.data[key] = { label: { nl: '' }, href: { nl: '' } };
	}
	function removeKey(key: string) {
		delete block.data[key];
	}
</script>

{#snippet linkFields(key: string, label: string)}
	{#if block.data[key]}
		<fieldset class="sub">
			<legend>{label}</legend>
			<I18nInput label="Knoptekst" bind:value={block.data[key].label} />
			<I18nInput label="Link" bind:value={block.data[key].href} hint={HREF_HINT} />
			<div>
				<Button size="sm" variant="ghost" icon="trash" onclick={() => removeKey(key)}>{label} verwijderen</Button>
			</div>
		</fieldset>
	{:else}
		<div><Button size="sm" variant="ghost" icon="plus" onclick={() => addLink(key)}>{label} toevoegen</Button></div>
	{/if}
{/snippet}

{#snippet optionalImage(key: string, label: string)}
	<MediaPicker {label} bind:value={block.data[key]} />
{/snippet}

<article class="be" class:hidden-block={block.hidden} class:invalid={!!error} aria-labelledby="be{uid}-t">
	<header>
		<button
			type="button"
			class="grip"
			aria-hidden="true"
			tabindex="-1"
			title="Sleep om te verplaatsen"
			onpointerdown={() => ongrab?.()}
		>
			<Icon name="grip" size={18} />
		</button>
		<button
			type="button"
			class="toggle"
			aria-expanded={open}
			aria-controls="be{uid}-body"
			onclick={() => (open = !open)}
		>
			<span class="n">{index + 1}</span>
			<span class="t" id="be{uid}-t">{BLOCK_LABELS[block.type]}</span>
			<span class="s">{blockSummary(block)}</span>
			<Icon name="chevron-down" size={16} class="chev" />
		</button>
		<span class="badges">
			{#if block.hidden}<Badge tone="neutral">Verborgen</Badge>{/if}
			{#if scheduled}<Badge tone={liveNow ? 'info' : 'warning'}
					>{liveNow ? 'Gepland · nu zichtbaar' : 'Gepland · nu niet zichtbaar'}</Badge
				>{/if}
			{#if error}<Badge tone="danger">Fout</Badge>{/if}
		</span>
		<span class="tools">
			<Button
				size="sm"
				variant="ghost"
				icon="arrow-up"
				aria-label="Blok {index + 1} omhoog"
				disabled={index === 0}
				onclick={() => onmove(-1)}
			/>
			<Button
				size="sm"
				variant="ghost"
				icon="arrow-down"
				aria-label="Blok {index + 1} omlaag"
				disabled={index === total - 1}
				onclick={() => onmove(1)}
			/>
			<Button
				size="sm"
				variant="ghost"
				icon={block.hidden ? 'eye-off' : 'eye'}
				aria-label={block.hidden ? `Blok ${index + 1} tonen` : `Blok ${index + 1} verbergen`}
				aria-pressed={block.hidden}
				onclick={() => (block.hidden = !block.hidden)}
			/>
			<Button size="sm" variant="ghost" icon="copy" aria-label="Blok {index + 1} dupliceren" onclick={onduplicate} />
			<Button size="sm" variant="ghost" icon="trash" aria-label="Blok {index + 1} verwijderen" onclick={onremove} />
		</span>
	</header>

	{#if error}<p class="err" role="alert"><Icon name="alert" size={14} /> {error}</p>{/if}

	<div class="body" id="be{uid}-body" hidden={!open}>
		{#if block.type === 'hero'}
			<Field label="Variant">
				<Select
					bind:value={block.data.variant}
					options={[
						{ value: 'overlay', label: 'Beeld over volledige breedte' },
						{ value: 'split', label: 'Gesplitst (tekst + beeld)' }
					]}
				/>
			</Field>
			<I18nInput label="Bovenregel" bind:value={block.data.overline} />
			<I18nInput label="Titel" bind:value={block.data.title} required />
			<I18nInput label="Allura-woord" bind:value={block.data.script} hint="Eén woord in schrijfletter, bv. “You”." />
			<I18nInput label="Inleiding" bind:value={block.data.lead} multiline rows={2} />
			{@render optionalImage('image', 'Beeld (verplicht)')}
			{@render linkFields('cta', 'Hoofdknop')}
			{@render linkFields('secondaryCta', 'Tweede link')}
		{:else if block.type === 'usp_bar'}
			{#each d.items as _item, i (i)}
				<fieldset class="sub">
					<legend>Voordeel {i + 1}</legend>
					<Field label="Icoon"><Select bind:value={block.data.items[i].icon} options={ICONS} /></Field>
					<I18nInput label="Tekst" bind:value={block.data.items[i].text} required />
					{#if d.items.length > 1}
						<div>
							<Button size="sm" variant="ghost" icon="trash" onclick={() => block.data.items.splice(i, 1)}
								>Verwijderen</Button
							>
						</div>
					{/if}
				</fieldset>
			{/each}
			{#if d.items.length < 4}
				<div>
					<Button
						size="sm"
						variant="ghost"
						icon="plus"
						onclick={() => block.data.items.push({ icon: 'sparkle', text: { nl: '' } })}>Voordeel toevoegen</Button
					>
				</div>
			{/if}
		{:else if block.type === 'category_strip'}
			<I18nInput label="Bovenregel" bind:value={block.data.eyebrow} />
			<I18nInput label="Titel" bind:value={block.data.title} />
		{:else if block.type === 'product_rail'}
			<I18nInput label="Bovenregel" bind:value={block.data.eyebrow} />
			<I18nInput label="Titel" bind:value={block.data.title} required />
			<div class="two">
				<Field label="Bron"><Select bind:value={block.data.source} options={SOURCES} /></Field>
				<Field label="Aantal producten" hint="2 – 16">
					<Input
						type="number"
						min={2}
						max={16}
						value={d.limit ?? 8}
						oninput={(e) => (block.data.limit = Math.max(2, Math.min(16, Number(e.currentTarget.value) || 8)))}
					/>
				</Field>
			</div>
			{#if d.source === 'collection'}
				<Field label="Collectie" required>
					<Select
						bind:value={block.data.collectionId}
						placeholder="Kies een collectie"
						options={collections.map((c) => ({ value: c.id, label: c.name }))}
					/>
				</Field>
			{:else if d.source === 'manual'}
				<ProductPicker bind:value={() => block.data.productIds ?? [], (v) => (block.data.productIds = v)} max={16} />
			{/if}
			{@render linkFields('cta', '“Bekijk alles”-link')}
		{:else if block.type === 'banner'}
			{@render optionalImage('image', 'Beeld (verplicht)')}
			<I18nInput label="Bovenregel" bind:value={block.data.eyebrow} />
			<I18nInput label="Titel" bind:value={block.data.title} required />
			<I18nInput label="Tekst" bind:value={block.data.text} multiline rows={2} />
			<Field label="Achtergrond">
				<Select
					bind:value={block.data.surface}
					options={[
						{ value: 'inverse', label: 'Bordeaux' },
						{ value: 'espresso', label: 'Espresso' },
						{ value: 'light', label: 'Licht' }
					]}
				/>
			</Field>
			{@render linkFields('cta', 'Knop')}
		{:else if block.type === 'quote_band'}
			<I18nInput label="Quote" bind:value={block.data.quote} multiline rows={2} required />
			<I18nInput label="Bron / naam" bind:value={block.data.attribution} />
			<Field label="Achtergrond">
				<Select
					bind:value={block.data.surface}
					options={[
						{ value: 'espresso', label: 'Espresso' },
						{ value: 'inverse', label: 'Bordeaux' }
					]}
				/>
			</Field>
		{:else if block.type === 'editorial_split'}
			{@render optionalImage('image', 'Beeld (verplicht)')}
			<I18nInput label="Bovenregel" bind:value={block.data.eyebrow} />
			<I18nInput label="Titel" bind:value={block.data.title} required />
			<I18nInput label="Allura-woord" bind:value={block.data.script} />
			<I18nInput
				label="Verhaal"
				bind:value={block.data.body}
				multiline
				rows={5}
				required
				hint="Markdown: **vet**, *cursief*, [link](/nl/…), lijstjes met -."
			/>
			<Checkbox bind:checked={block.data.reverse}>Beeld rechts (spiegelen)</Checkbox>
			{@render linkFields('cta', 'Link')}
		{:else if block.type === 'rich_text'}
			<I18nInput label="Titel" bind:value={block.data.title} />
			<I18nInput
				label="Tekst"
				bind:value={block.data.body}
				multiline
				rows={10}
				required
				hint="Markdown: ## kop, ### subkop, **vet**, *cursief*, [link](/nl/…), lijstjes met - of 1."
			/>
		{:else if block.type === 'faq_list'}
			<I18nInput label="Titel" bind:value={block.data.title} />
			<Field label="Groep" hint="Beheer de vragen in Content → FAQ.">
				<Select
					value={d.group ?? ''}
					onchange={(e) => (e.currentTarget.value ? (block.data.group = e.currentTarget.value) : removeKey('group'))}
					options={[{ value: '', label: 'Alle vragen' }, ...faqGroups.map((g) => ({ value: g, label: g }))]}
				/>
			</Field>
		{:else if block.type === 'newsletter'}
			<I18nInput label="Titel" bind:value={block.data.title} required />
			<I18nInput label="Tekst" bind:value={block.data.text} multiline rows={2} />
		{:else if block.type === 'size_table'}
			<I18nInput label="Titel" bind:value={block.data.title} />
			<Field label="Soort"
				><Select
					bind:value={block.data.kind}
					options={[
						{ value: 'ring', label: 'Ringmaten (+ printbare maatmeter)' },
						{ value: 'bracelet', label: 'Armbandmaten' }
					]}
				/></Field
			>
		{:else if block.type === 'contact_form'}
			<I18nInput label="Titel" bind:value={block.data.title} />
		{:else if block.type === 'legal_slot'}
			<Field label="Juridische tekst" hint="De tekst zelf beheer je in Instellingen → Juridisch.">
				<Select bind:value={block.data.slot} options={legalSlots.map((s) => ({ value: s.key, label: s.label }))} />
			</Field>
			<I18nInput label="Interne notitie" bind:value={block.data.note} />
		{/if}

		<fieldset class="sub sched">
			<legend><Icon name="calendar" size={14} /> Zichtbaarheid</legend>
			<Checkbox
				bind:checked={() => !!block.hidden, (v) => (block.hidden = v)}
				description="Verborgen blokken blijven bewaard maar worden niet getoond.">Verbergen</Checkbox
			>
			<div class="two">
				<Field label="Zichtbaar vanaf" hint="Brusselse tijd. Leeg = meteen.">
					<Input
						type="datetime-local"
						value={toBrusselsInput(block.visibleFrom)}
						oninput={(e) => (block.visibleFrom = fromBrusselsInput(e.currentTarget.value))}
					/>
				</Field>
				<Field label="Zichtbaar tot" hint="Brusselse tijd. Leeg = onbeperkt.">
					<Input
						type="datetime-local"
						value={toBrusselsInput(block.visibleUntil)}
						oninput={(e) => (block.visibleUntil = fromBrusselsInput(e.currentTarget.value))}
					/>
				</Field>
			</div>
			{#if scheduled}
				<p class="hint">
					{#if block.visibleFrom}Vanaf {formatBrussels(block.visibleFrom)}{/if}
					{#if block.visibleUntil}{block.visibleFrom ? ' tot ' : 'Tot '}{formatBrussels(block.visibleUntil)}{/if}
					— tip: plan twee hero-blokken na elkaar om automatisch te wisselen.
				</p>
			{/if}
		</fieldset>
	</div>
</article>

<style>
	.be {
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		min-width: 0;
	}
	.be.invalid {
		border-color: var(--ui-danger);
	}
	.hidden-block header {
		opacity: 0.7;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		padding: var(--space-1) var(--space-2);
	}
	.grip {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2.75rem;
		background: none;
		border: 0;
		color: var(--ui-text-muted);
		cursor: grab;
		touch-action: none;
	}
	.toggle {
		flex: 1 1 10rem;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		min-height: 2.75rem;
		background: none;
		border: 0;
		padding: 0 var(--space-1);
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.toggle:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		border-radius: var(--r-xs);
	}
	.toggle :global(.chev) {
		margin-left: auto;
		flex-shrink: 0;
		transition: transform var(--dur-fast) var(--motion-out);
	}
	.toggle[aria-expanded='true'] :global(.chev) {
		transform: rotate(180deg);
	}
	.n {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--r-full);
		background: var(--ui-bg);
		font-size: var(--fs-2xs);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}
	.t {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-sm);
		white-space: nowrap;
	}
	.s {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.tools {
		display: flex;
		margin-left: auto;
	}
	.err {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		padding: 0 var(--space-4) var(--space-2);
		color: var(--ui-danger);
		font-size: var(--fs-xs);
	}
	.body {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4) var(--space-4);
		border-top: 1px solid var(--ui-border);
	}
	.body[hidden] {
		display: none;
	}
	.sub {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		min-width: 0;
	}
	.sub legend {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding-inline: var(--space-1);
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	.two {
		display: grid;
		gap: var(--space-3);
	}
	@media (min-width: 40rem) {
		.two {
			grid-template-columns: 1fr 1fr;
		}
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
</style>
