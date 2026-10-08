<!--
  @component ImageUploader — direct-to-object-storage uploads for product media.
  Flow:  pick/drop → validate (type, size, min dimensions) → POST /admin/api/uploads
         (server returns presigned PUT url + key) → XHR PUT with progress → done.
  The Worker never proxies file bytes (Cloudflare request-body + CPU limits).
  Every image is posted as indexed fields (`images.0.key`, `images.0.alt.nl` …) so the parent
  <form> submits order + alt text natively. Without JavaScript the component shows a plain
  file input (`fallbackName`, needs enctype="multipart/form-data") plus remove / position fields.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { ImageModel } from '#lib/schemas/product.ts';

	interface Pending {
		id: string;
		name: string;
		progress: number;
		error?: string;
		preview: string;
	}

	interface Props {
		name?: string;
		value?: ImageModel[];
		errors?: Record<string, string[]>;
		max?: number;
		maxSizeMb?: number;
		minEdge?: number; // px — product photos must be ≥ 1600 on the shortest edge
		folder?: 'products' | 'media';
		/** Name of the no-JS file input (multipart fallback). Empty = no fallback. */
		fallbackName?: string;
		/** Show alt-text inputs (product form). The media library edits alt text separately. */
		withAlt?: boolean;
		onchange?: () => void;
	}

	let {
		name = 'images',
		value = $bindable([]),
		errors = {},
		max = 12,
		maxSizeMb = 15,
		minEdge = 1600,
		folder = 'products',
		fallbackName = 'newImages',
		withAlt = true,
		onchange
	}: Props = $props();

	let pending = $state<Pending[]>([]);
	let dragging = $state(false);
	let dragIndex = $state<number | null>(null);
	let mounted = $state(false);
	let input = $state<HTMLInputElement>();
	let status = $state('');
	$effect(() => {
		mounted = true;
	});

	const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
	const err = (path: string) => errors[`${name}.${path}`]?.[0];

	function dims(file: File): Promise<{ width: number; height: number }> {
		return createImageBitmap(file).then((b) => {
			const d = { width: b.width, height: b.height };
			b.close();
			return d;
		});
	}

	function changed() {
		onchange?.();
	}

	async function handleFiles(files: FileList | File[]) {
		const list = [...files].slice(0, Math.max(0, max - value.length - pending.length));
		for (const file of list) {
			const id = crypto.randomUUID();
			const p: Pending = { id, name: file.name, progress: 0, preview: URL.createObjectURL(file) };
			pending = [...pending, p];
			const fail = (msg: string) => (pending = pending.map((x) => (x.id === id ? { ...x, error: msg } : x)));

			if (!ACCEPT.includes(file.type)) {
				fail('Alleen JPG, PNG, WebP of AVIF');
				continue;
			}
			if (file.size > maxSizeMb * 1024 * 1024) {
				fail(`Max ${maxSizeMb} MB`);
				continue;
			}
			let size: { width: number; height: number };
			try {
				size = await dims(file);
			} catch {
				fail('Afbeelding kan niet gelezen worden');
				continue;
			}
			if (Math.min(size.width, size.height) < minEdge) {
				fail(`Minstens ${minEdge}px aan de kortste zijde`);
				continue;
			}

			try {
				const res = await fetch('/admin/api/uploads', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, folder })
				});
				if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? 'Upload geweigerd');
				const { uploadUrl, key, publicUrl } = (await res.json()) as { uploadUrl: string; key: string; publicUrl: string };

				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();
					xhr.open('PUT', uploadUrl);
					xhr.setRequestHeader('content-type', file.type);
					xhr.upload.onprogress = (e) => {
						if (e.lengthComputable) {
							const pct = Math.round((e.loaded / e.total) * 100);
							pending = pending.map((x) => (x.id === id ? { ...x, progress: pct } : x));
						}
					};
					xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload mislukt (HTTP ${xhr.status})`)));
					xhr.onerror = () => reject(new Error('Netwerkfout'));
					xhr.send(file);
				});

				value = [...value, { key, url: publicUrl, alt: { nl: '', fr: '' }, width: String(size.width), height: String(size.height), bytes: String(file.size) }];
				URL.revokeObjectURL(p.preview);
				pending = pending.filter((x) => x.id !== id);
				status = `${file.name} geüpload. Vul de alt-tekst in.`;
				changed();
			} catch (e) {
				fail(e instanceof Error ? e.message : 'Upload mislukt');
			}
		}
	}

	function remove(i: number) {
		value = value.filter((_, j) => j !== i);
		status = `Foto ${i + 1} verwijderd`;
		changed();
	}
	function move(from: number, to: number) {
		if (to < 0 || to >= value.length) return;
		const next = [...value];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item);
		value = next;
		status = `Foto verplaatst naar positie ${to + 1}`;
		changed();
	}
</script>

<div class="uploader">
	{#if mounted}
		<button
			type="button"
			class="drop"
			class:dragging
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={(e) => {
				e.preventDefault();
				dragging = false;
				if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
			}}
			onclick={() => input?.click()}
			disabled={value.length >= max}
		>
			<Icon name="upload" size={28} stroke={1} />
			<strong>Sleep foto's hierheen of klik om te bladeren</strong>
			<span>JPG, PNG, WebP, AVIF · max {maxSizeMb} MB · min. {minEdge}px · {value.length}/{max}</span>
		</button>
		<input
			bind:this={input}
			type="file"
			accept={ACCEPT.join(',')}
			multiple
			hidden
			onchange={(e) => {
				if (e.currentTarget.files) handleFiles(e.currentTarget.files);
				e.currentTarget.value = '';
			}}
		/>
	{:else if fallbackName}
		<label class="fallback">
			<span>Foto's toevoegen (JPG, PNG, WebP, AVIF · max {maxSizeMb} MB · min. {minEdge}px)</span>
			<input type="file" name={fallbackName} accept={ACCEPT.join(',')} multiple />
		</label>
	{/if}
	<p class="sr-only" role="status" aria-live="polite">{status}</p>
	{#if err('_') || errors[name]?.[0]}<p class="error" role="alert"><Icon name="alert" size={14} />{errors[name]?.[0] ?? err('_')}</p>{/if}

	{#if value.length || pending.length}
		<ul class="grid">
			{#each value as img, i (img.key ?? img.mediaId ?? i)}
				<li
					class="tile"
					class:primary={i === 0}
					draggable={mounted}
					ondragstart={() => (dragIndex = i)}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						if (dragIndex !== null) move(dragIndex, i);
						dragIndex = null;
					}}
				>
					{#if img.mediaId}<input type="hidden" name="{name}.{i}.mediaId" value={img.mediaId} />{/if}
					{#if img.key}<input type="hidden" name="{name}.{i}.key" value={img.key} />{/if}
					<input type="hidden" name="{name}.{i}.url" value={img.url} />
					<input type="hidden" name="{name}.{i}.width" value={img.width ?? ''} />
					<input type="hidden" name="{name}.{i}.height" value={img.height ?? ''} />
					<input type="hidden" name="{name}.{i}.bytes" value={img.bytes ?? ''} />
					<div class="thumb">
						<img src={img.url} alt="" loading="lazy" />
						{#if i === 0}<span class="tag">Hoofdfoto</span>{/if}
						{#if mounted}
							<div class="actions">
								<button type="button" aria-label="Foto {i + 1} naar links" disabled={i === 0} onclick={() => move(i, i - 1)}><Icon name="chevron-left" size={14} /></button>
								<button type="button" aria-label="Foto {i + 1} naar rechts" disabled={i === value.length - 1} onclick={() => move(i, i + 1)}><Icon name="chevron-right" size={14} /></button>
								<button type="button" aria-label="Foto {i + 1} verwijderen" onclick={() => remove(i)}><Icon name="trash" size={14} /></button>
							</div>
						{/if}
					</div>
					{#if err(`${i}.key`)}<p class="error" role="alert"><Icon name="alert" size={14} />{err(`${i}.key`)}</p>{/if}
					{#if withAlt}
						<label class="alt">
							<span>Alt-tekst NL <span aria-hidden="true">*</span></span>
							<input
								name="{name}.{i}.alt.nl"
								bind:value={img.alt.nl}
								oninput={changed}
								placeholder="bv. Gouden klaverring met granaat"
								class:missing={!img.alt.nl}
								aria-invalid={!!err(`${i}.alt.nl`) || undefined}
								maxlength="250"
							/>
						</label>
						{#if err(`${i}.alt.nl`)}<p class="error" role="alert"><Icon name="alert" size={14} />{err(`${i}.alt.nl`)}</p>{/if}
						<label class="alt">
							<span>Alt-tekst FR <small>(optioneel)</small></span>
							<input name="{name}.{i}.alt.fr" bind:value={img.alt.fr} oninput={changed} placeholder="ex. Bague trèfle dorée" maxlength="250" />
						</label>
					{/if}
					{#if !mounted}
						<div class="nojs">
							<label><span>Positie</span><input type="number" name="{name}.{i}.position" value={i + 1} min="1" /></label>
							<label class="rm"><input type="checkbox" name="{name}.{i}.remove" /> Verwijderen</label>
						</div>
					{/if}
				</li>
			{/each}
			{#each pending as p (p.id)}
				<li class="tile pending" class:error-tile={p.error}>
					<div class="thumb">
						<img src={p.preview} alt="" />
						<div class="progress" style:--p="{p.progress}%">
							{#if p.error}
								<Icon name="alert" size={18} /><span>{p.error}</span>
								<button type="button" onclick={() => (pending = pending.filter((x) => x.id !== p.id))}>Sluiten</button>
							{:else}<span>{p.progress}%</span>{/if}
						</div>
					</div>
					<p class="fname">{p.name}</p>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.uploader {
		display: grid;
		gap: var(--space-4);
	}
	.drop {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		padding: var(--space-8) var(--space-4);
		border: 1px dashed var(--ui-border-strong);
		border-radius: var(--r-md);
		background: var(--ui-surface-sunken);
		color: var(--ui-text);
		text-align: center;
		cursor: pointer;
		font: inherit;
		transition:
			background-color var(--dur-fast),
			border-color var(--dur-fast);
	}
	.drop:hover,
	.drop.dragging {
		border-color: var(--ui-accent);
		background: color-mix(in srgb, var(--ui-ornament) 10%, var(--ui-surface));
	}
	.drop:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: 2px;
	}
	.drop :global(svg) {
		color: var(--ui-accent);
	}
	.drop strong {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	.drop span {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.drop:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.fallback {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: 1px dashed var(--ui-border-strong);
		border-radius: var(--r-md);
		font-size: var(--fs-sm);
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: var(--space-4);
	}
	.tile {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
	}
	.tile[draggable='true'] {
		cursor: grab;
	}
	.thumb {
		position: relative;
		aspect-ratio: var(--ratio-product, 4 / 5);
		overflow: hidden;
		border-radius: var(--r-sm);
		background: var(--ui-surface-sunken);
		border: 1px solid var(--ui-border);
	}
	.primary .thumb {
		outline: 2px solid var(--ui-ornament);
		outline-offset: 2px;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.tag {
		position: absolute;
		top: 6px;
		left: 6px;
		padding: 2px 8px;
		background: var(--ui-surface-inverse);
		color: var(--ui-text-inverse);
		font-size: var(--fs-2xs, 0.625rem);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		border-radius: var(--r-full);
	}
	.actions {
		position: absolute;
		inset-inline: 6px;
		bottom: 6px;
		display: flex;
		justify-content: flex-end;
		gap: 4px;
	}
	.actions button {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
		cursor: pointer;
	}
	.actions button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.actions button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.alt {
		display: grid;
		gap: 2px;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.alt input,
	.nojs input[type='number'] {
		width: 100%;
		height: 2.25rem;
		padding-inline: var(--space-2);
		font: inherit;
		font-size: var(--fs-xs);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-xs);
		background: var(--ui-surface);
		color: var(--ui-text);
	}
	.alt input.missing {
		border-color: var(--ui-warning);
	}
	.alt input[aria-invalid='true'] {
		border-color: var(--ui-danger);
	}
	.nojs {
		display: flex;
		gap: var(--space-2);
		align-items: end;
		font-size: var(--fs-xs);
	}
	.nojs label {
		display: grid;
		gap: 2px;
	}
	.nojs .rm {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 2.25rem;
	}
	.error {
		display: flex;
		gap: 4px;
		align-items: center;
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-danger);
	}
	.progress {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 4px;
		padding: var(--space-2);
		text-align: center;
		font-size: var(--fs-xs);
		color: var(--ui-text-inverse);
		background: linear-gradient(to top, color-mix(in srgb, var(--ui-surface-inverse) 80%, transparent) var(--p), color-mix(in srgb, var(--ui-surface-inverse) 45%, transparent) var(--p));
	}
	.error-tile .progress {
		background: color-mix(in srgb, var(--ui-danger) 85%, transparent);
	}
	.progress button {
		background: none;
		border: 1px solid currentColor;
		color: inherit;
		font-size: var(--fs-xs);
		padding: 2px 8px;
		cursor: pointer;
	}
	.fname {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
