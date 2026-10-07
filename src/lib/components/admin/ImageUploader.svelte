<!--
  @component ImageUploader — direct-to-object-storage uploads for product media.
  Flow:  pick/drop → validate (type, size, min dimensions) → POST /admin/api/uploads
         (server returns presigned PUT url + key) → XHR PUT with progress → done.
  The Worker never proxies file bytes (Cloudflare request-body + CPU limits).
  Result is serialised into a hidden <input name="images"> so the parent
  <form method="POST" use:enhance> submits keys + alt + order with the product.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { UploadedImage } from '#lib/types.ts';

	interface Pending { id: string; name: string; progress: number; error?: string; preview: string }

	interface Props {
		name?: string;
		value?: UploadedImage[];
		max?: number;
		maxSizeMb?: number;
		minEdge?: number;     // px — product photos must be ≥ 1600 on shortest edge
	}

	let { name = 'images', value = $bindable([]), max = 10, maxSizeMb = 15, minEdge = 1600 }: Props = $props();

	let pending = $state<Pending[]>([]);
	let dragging = $state(false);
	let dragIndex = $state<number | null>(null);
	let input: HTMLInputElement;

	const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

	function dims(file: File): Promise<{ width: number; height: number }> {
		return createImageBitmap(file).then((b) => {
			const d = { width: b.width, height: b.height };
			b.close();
			return d;
		});
	}

	async function handleFiles(files: FileList | File[]) {
		const list = [...files].slice(0, Math.max(0, max - value.length - pending.length));
		for (const file of list) {
			const id = crypto.randomUUID();
			const p: Pending = { id, name: file.name, progress: 0, preview: URL.createObjectURL(file) };
			pending = [...pending, p];
			const fail = (msg: string) => (pending = pending.map((x) => (x.id === id ? { ...x, error: msg } : x)));

			if (!ACCEPT.includes(file.type)) { fail('Alleen JPG, PNG, WebP of AVIF'); continue; }
			if (file.size > maxSizeMb * 1024 * 1024) { fail(`Max ${maxSizeMb} MB`); continue; }
			const { width, height } = await dims(file);
			if (Math.min(width, height) < minEdge) { fail(`Minstens ${minEdge}px aan de kortste zijde`); continue; }

			try {
				const res = await fetch('/admin/api/uploads', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size })
				});
				if (!res.ok) throw new Error(((await res.json()) as { message?: string }).message ?? 'Upload geweigerd');
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
					xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
					xhr.onerror = () => reject(new Error('Netwerkfout'));
					xhr.send(file);
				});

				value = [...value, { key, url: publicUrl, alt: '', width, height }];
				URL.revokeObjectURL(p.preview);
				pending = pending.filter((x) => x.id !== id);
			} catch (e) {
				fail(e instanceof Error ? e.message : 'Upload mislukt');
			}
		}
	}

	function remove(i: number) { value = value.filter((_, j) => j !== i); }
	function move(from: number, to: number) {
		if (to < 0 || to >= value.length) return;
		const next = [...value];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item);
		value = next;
	}
</script>

<input type="hidden" {name} value={JSON.stringify(value)} />

<div class="uploader">
	<button
		type="button"
		class="drop"
		class:dragging
		ondragover={(e) => { e.preventDefault(); dragging = true; }}
		ondragleave={() => (dragging = false)}
		ondrop={(e) => { e.preventDefault(); dragging = false; if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files); }}
		onclick={() => input.click()}
		disabled={value.length >= max}
	>
		<Icon name="upload" size={28} stroke={1} />
		<strong>Sleep foto's hierheen of klik om te bladeren</strong>
		<span>JPG, PNG, WebP, AVIF · max {maxSizeMb} MB · min. {minEdge}px · {value.length}/{max}</span>
	</button>
	<input bind:this={input} type="file" accept={ACCEPT.join(',')} multiple hidden onchange={(e) => { handleFiles(e.currentTarget.files!); e.currentTarget.value = ''; }} />

	{#if value.length || pending.length}
		<ul class="grid">
			{#each value as img, i (img.key)}
				<li
					class="tile"
					class:primary={i === 0}
					draggable="true"
					ondragstart={() => (dragIndex = i)}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => { e.preventDefault(); if (dragIndex !== null) move(dragIndex, i); dragIndex = null; }}
				>
					<div class="thumb">
						<img src={img.url} alt="" loading="lazy" />
						{#if i === 0}<span class="tag">Hoofdfoto</span>{/if}
						<div class="actions">
							<button type="button" aria-label="Naar links" disabled={i === 0} onclick={() => move(i, i - 1)}><Icon name="chevron-left" size={14} /></button>
							<button type="button" aria-label="Naar rechts" disabled={i === value.length - 1} onclick={() => move(i, i + 1)}><Icon name="chevron-right" size={14} /></button>
							<button type="button" aria-label="Verwijderen" onclick={() => remove(i)}><Icon name="trash" size={14} /></button>
						</div>
					</div>
					<label class="alt">
						<span class="sr-only">Alt-tekst foto {i + 1}</span>
						<input bind:value={img.alt} placeholder="Alt-tekst, bv. 'Gouden klaverring met granaat om hand'" class:missing={!img.alt} />
					</label>
				</li>
			{/each}
			{#each pending as p (p.id)}
				<li class="tile pending" class:error={p.error}>
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
	.uploader { display: grid; gap: var(--space-4); }
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
		transition: background-color var(--dur-fast), border-color var(--dur-fast);
	}
	.drop:hover, .drop.dragging { border-color: var(--sk-cognac); background: color-mix(in srgb, var(--sk-gold) 10%, var(--ui-surface)); }
	.drop :global(svg) { color: var(--ui-accent); }
	.drop strong { font-size: var(--fs-sm); font-weight: var(--fw-medium); }
	.drop span { font-size: var(--fs-xs); color: var(--ui-text-muted); }
	.drop:disabled { opacity: 0.5; cursor: not-allowed; }

	.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: var(--space-4); }
	.tile { display: grid; gap: var(--space-2); cursor: grab; }
	.thumb { position: relative; aspect-ratio: var(--ratio-product); overflow: hidden; border-radius: var(--r-sm); background: var(--ui-surface-sunken); border: 1px solid var(--ui-border); }
	.primary .thumb { outline: 2px solid var(--sk-gold); outline-offset: 2px; }
	.thumb img { width: 100%; height: 100%; object-fit: cover; }
	.tag { position: absolute; top: 6px; left: 6px; padding: 2px 8px; background: var(--sk-burgundy); color: var(--sk-cream); font-size: 0.625rem; letter-spacing: var(--ls-wide); text-transform: uppercase; border-radius: var(--r-full); }
	.actions { position: absolute; inset-inline: 6px; bottom: 6px; display: flex; justify-content: flex-end; gap: 4px; opacity: 0; transition: opacity var(--dur-fast); }
	.tile:hover .actions, .tile:focus-within .actions { opacity: 1; }
	@media (hover: none) { .actions { opacity: 1; } }
	.actions button { width: 1.75rem; height: 1.75rem; display: grid; place-items: center; border: 0; border-radius: var(--r-xs); background: rgb(255 255 255 / 0.92); color: var(--sk-espresso); cursor: pointer; }
	.actions button:disabled { opacity: 0.35; }
	.alt input { width: 100%; height: 2rem; padding-inline: var(--space-2); font: inherit; font-size: var(--fs-xs); border: 1px solid var(--ui-border); border-radius: var(--r-xs); background: var(--ui-surface); color: var(--ui-text); }
	.alt input.missing { border-color: var(--sk-warning); }
	.progress { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 4px; padding: var(--space-2); text-align: center; font-size: var(--fs-xs); color: var(--sk-cream); background: linear-gradient(to top, rgb(57 22 23 / 0.75) var(--p), rgb(57 22 23 / 0.45) var(--p)); }
	.error .progress { background: rgb(155 44 44 / 0.85); }
	.progress button { background: none; border: 1px solid currentColor; color: inherit; font-size: var(--fs-2xs); padding: 2px 8px; cursor: pointer; }
	.fname { margin: 0; font-size: var(--fs-xs); color: var(--ui-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
