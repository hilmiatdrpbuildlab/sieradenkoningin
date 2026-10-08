<!--
  @component BlockPreview — live preview of the UNSAVED draft (P4-01). The draft JSON is POSTed into an
  iframe (`/admin/preview/page?/render`), which resolves the blocks server-side and renders them with
  the storefront BlockRenderer and styles. Widths: 390 (mobile) and 1440 (desktop, scaled to fit).
  Must be placed OUTSIDE the editor <form> (it renders its own form).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import { fromBrusselsInput } from '#lib/utils/brussels-time.ts';

	interface Props {
		/** JSON-serialisable draft blocks. */
		blocks: unknown[];
		/** Block id to scroll to after reload (the one being edited). */
		focus?: string | null;
		title?: string;
	}
	let { blocks, focus = null, title = '' }: Props = $props();

	const uid = $props.id();
	const frameName = `preview-${uid}`;
	let width = $state<390 | 1440>(390);
	let lang = $state<'nl' | 'fr'>('nl');
	let at = $state('');
	let form: HTMLFormElement | undefined = $state();
	let frame: HTMLIFrameElement | undefined = $state();
	let boxWidth = $state(0);
	let loading = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const VIEW_H = 720;
	const scale = $derived(boxWidth ? Math.min(1, boxWidth / width) : 1);
	const draft = $derived(JSON.stringify({ blocks, lang, at: fromBrusselsInput(at), focus, title }));

	function refresh() {
		loading = true;
		form?.requestSubmit();
	}
	// Listener instead of an `onload` attribute: SSR would emit an inline handler that the CSP blocks.
	onMount(() => {
		const done = () => (loading = false);
		frame?.addEventListener('load', done);
		refresh();
		return () => frame?.removeEventListener('load', done);
	});
	$effect(() => {
		void draft;
		clearTimeout(timer);
		timer = setTimeout(refresh, 700);
		return () => clearTimeout(timer);
	});
</script>

<section class="bp" aria-label="Live preview">
	<div class="bar">
		<div class="seg" role="group" aria-label="Breedte">
			<Button
				size="sm"
				variant={width === 390 ? 'primary' : 'ghost'}
				icon="smartphone"
				aria-pressed={width === 390}
				onclick={() => (width = 390)}>390</Button
			>
			<Button
				size="sm"
				variant={width === 1440 ? 'primary' : 'ghost'}
				icon="monitor"
				aria-pressed={width === 1440}
				onclick={() => (width = 1440)}>1440</Button
			>
		</div>
		<div class="seg" role="group" aria-label="Taal">
			<Button
				size="sm"
				variant={lang === 'nl' ? 'primary' : 'ghost'}
				aria-pressed={lang === 'nl'}
				onclick={() => (lang = 'nl')}>NL</Button
			>
			<Button
				size="sm"
				variant={lang === 'fr' ? 'primary' : 'ghost'}
				aria-pressed={lang === 'fr'}
				onclick={() => (lang = 'fr')}>FR</Button
			>
		</div>
		<Button size="sm" variant="ghost" icon="refresh" aria-label="Preview vernieuwen" onclick={refresh} />
		{#if loading}<span class="status" role="status">Laden…</span>{/if}
	</div>
	<Field label="Bekijk op datum" hint="Brusselse tijd — test geplande blokken. Leeg = nu.">
		<Input type="datetime-local" bind:value={at} />
	</Field>

	<form bind:this={form} method="POST" action="/admin/preview/page?/render" target={frameName} hidden>
		<input type="hidden" name="draft" value={draft} />
	</form>

	<div class="box" bind:clientWidth={boxWidth}>
		<div class="frame-wrap" style:height="{VIEW_H}px" style:width="{Math.round(width * scale)}px">
			<iframe
				name={frameName}
				title="Preview van de pagina ({width}px, {lang.toUpperCase()})"
				src="/admin/preview/page"
				style:width="{width}px"
				style:height="{Math.round(VIEW_H / scale)}px"
				style:transform="scale({scale})"
				bind:this={frame}
			></iframe>
		</div>
	</div>
</section>

<style>
	.bp {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.seg {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
	}
	.status {
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.box {
		min-width: 0;
		display: flex;
		justify-content: center;
	}
	.frame-wrap {
		overflow: hidden;
		border: 1px solid var(--ui-border);
		border-radius: var(--r-sm);
		background: var(--ui-bg);
	}
	iframe {
		display: block;
		border: 0;
		transform-origin: 0 0;
		background: var(--ui-surface);
	}
</style>
