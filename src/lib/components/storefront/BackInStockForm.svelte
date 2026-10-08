<!--
  @component BackInStockForm — "Mail me when it's back" for a sold-out variant (P3-09). Posts to
  /api/stock-alerts (Turnstile + rate limit). With JS the result shows inline; without JS the endpoint
  redirects back here with `?alert=<result>`, which this component reads from the URL.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import Turnstile from './Turnstile.svelte';
	import type { Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { variantId, lang }: { variantId: string; lang: Lang } = $props();

	type Result = 'ok' | 'in_stock' | 'invalid' | 'captcha' | 'rate' | 'not_found' | 'error';
	let result = $state<Result | null>(null);
	let busy = $state(false);
	let lastVariant: string | null = null;

	// A no-JS submit lands back on the PDP with ?alert=…
	const fromUrl = $derived((page.url.searchParams.get('alert') as Result | null) ?? null);
	const shown = $derived(result ?? fromUrl);
	const returnTo = $derived(page.url.pathname + page.url.search.replace(/([?&])alert=[^&]*&?/, '$1').replace(/[?&]$/, ''));

	$effect(() => {
		// Switching to another sold-out variant resets the inline state.
		if (lastVariant !== null && lastVariant !== variantId) result = null;
		lastVariant = variantId;
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const formEl = e.currentTarget as HTMLFormElement;
		busy = true;
		try {
			const res = await fetch(formEl.action, { method: 'POST', body: new FormData(formEl), headers: { accept: 'application/json' } });
			const body = (await res.json().catch(() => null)) as { result?: Result } | null;
			result = body?.result ?? 'error';
		} catch {
			result = 'error';
		} finally {
			busy = false;
		}
	}

	const message = (r: Result) =>
		r === 'ok'
			? m.bis_ok()
			: r === 'invalid'
				? m.acct_err_email()
				: r === 'rate'
					? m.acct_err_rate()
					: r === 'captcha'
						? m.acct_err_captcha()
						: r === 'in_stock'
							? m.bis_in_stock()
							: m.acct_err_generic();
</script>

<div class="bis">
	{#if shown === 'ok'}
		<p class="ok" role="status"><Icon name="check" size={18} />{message('ok')}</p>
	{:else}
		<p class="title"><Icon name="mail" size={18} />{m.bis_title()}</p>
		<p class="lead">{m.bis_lead()}</p>
		<form method="POST" action="/api/stock-alerts" onsubmit={submit} novalidate>
			<input type="hidden" name="variantId" value={variantId} />
			<input type="hidden" name="locale" value={lang} />
			<input type="hidden" name="return" value={returnTo} />
			<Field label={m.bis_email()} error={shown ? message(shown) : undefined}>
				<Input name="email" type="email" autocomplete="email" inputmode="email" required />
			</Field>
			<Turnstile />
			<Button type="submit" variant="outline" full loading={busy}>{m.bis_submit()}</Button>
		</form>
		<p class="note">{m.bis_note()}</p>
	{/if}
</div>

<style>
	.bis {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-4);
		padding: var(--space-5);
		background: var(--ui-surface-sunken);
	}
	.title,
	.ok {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-weight: var(--fw-medium);
	}
	.title :global(svg) {
		color: var(--ui-accent);
	}
	.ok {
		color: var(--ui-success);
	}
	.lead,
	.note {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.note {
		font-size: var(--fs-xs);
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
</style>
