<!--
  @component SaveBar — sticky footer for admin forms with unsaved-change detection.
  Warns on tab close (beforeunload) and on in-app navigation (beforeNavigate) while `dirty`.
  The submit button belongs to the surrounding <form> (or `form` id). Works without JS: the bar is
  rendered server-side and the button posts the form; only the dirty indicator needs JS.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import Button from '#lib/components/ui/Button.svelte';

	interface Props {
		dirty?: boolean;
		saving?: boolean;
		/** Skip the navigation guard (e.g. while the form itself is submitting). */
		bypass?: boolean;
		label?: string;
		cancelHref?: string;
		form?: string;
		extra?: Snippet;
	}
	let { dirty = false, saving = false, bypass = false, label = 'Opslaan', cancelHref, form, extra }: Props = $props();

	const MESSAGE = 'Je hebt niet-opgeslagen wijzigingen. Pagina toch verlaten?';

	beforeNavigate((nav) => {
		if (!dirty || bypass || saving || nav.type === 'form') return;
		if (nav.willUnload) return; // handled by beforeunload below
		if (!confirm(MESSAGE)) nav.cancel();
	});

	function onbeforeunload(e: BeforeUnloadEvent) {
		if (dirty && !bypass && !saving) {
			e.preventDefault();
			e.returnValue = MESSAGE;
		}
	}
</script>

<svelte:window {onbeforeunload} />

<div class="savebar" class:dirty role="region" aria-label="Opslaan">
	<p class="state" aria-live="polite">
		{#if saving}Bezig met opslaan…{:else if dirty}<span class="dot" aria-hidden="true"></span>Niet-opgeslagen wijzigingen{:else}Geen openstaande wijzigingen{/if}
	</p>
	<div class="actions">
		{#if extra}{@render extra()}{/if}
		{#if cancelHref}<Button href={cancelHref} variant="ghost" size="sm">Annuleren</Button>{/if}
		<Button type="submit" size="sm" loading={saving} {form}>{label}</Button>
	</div>
</div>

<style>
	.savebar {
		position: sticky;
		bottom: var(--space-3);
		z-index: 20;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: var(--r-md);
		box-shadow: var(--elev-md, var(--elev-xs));
	}
	.savebar.dirty {
		border-color: var(--ui-warning);
	}
	.state {
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.dirty .state {
		color: var(--ui-text);
		font-weight: var(--fw-medium);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 1px;
		transform: rotate(45deg);
		background: var(--ui-warning);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-left: auto;
	}
</style>
