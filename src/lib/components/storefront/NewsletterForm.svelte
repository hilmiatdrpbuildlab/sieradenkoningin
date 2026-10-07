<!--
  @component NewsletterForm — posts to the newsletter action (double opt-in, P4-06).
  Works without JS (full page result); with JS the result is shown inline.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import type { Lang } from '#lib/i18n/paths.ts';

	let { lang, source = 'footer' }: { lang: Lang; source?: string } = $props();
	let status = $state<'idle' | 'sending' | 'ok' | 'invalid' | 'error'>('idle');
	const uid = $props.id();
</script>

<form
	method="POST"
	action="/{lang}/newsletter?/subscribe"
	class="nl"
	use:enhance={() => {
		status = 'sending';
		return async ({ result }) => {
			if (result.type === 'success') status = 'ok';
			else if (result.type === 'failure') status = result.data?.reason === 'invalid' ? 'invalid' : 'error';
			else status = 'error';
		};
	}}
>
	{#if status === 'ok'}
		<p class="msg" role="status">{m.newsletter_thanks()}</p>
	{:else}
		<input type="hidden" name="source" value={source} />
		<div class="row">
			<label for="nl{uid}" class="sr-only">{m.newsletter_email()}</label>
			<input
				id="nl{uid}"
				type="email"
				name="email"
				required
				autocomplete="email"
				placeholder={m.newsletter_email()}
				aria-invalid={status === 'invalid' || undefined}
				aria-describedby="nl{uid}-hint"
			/>
			<button type="submit" disabled={status === 'sending'}>{m.newsletter_submit()}</button>
		</div>
		<p id="nl{uid}-hint" class="hint" role={status === 'invalid' || status === 'error' ? 'alert' : undefined}>
			{status === 'invalid' ? m.newsletter_invalid() : status === 'error' ? m.newsletter_error() : m.newsletter_consent()}
		</p>
	{/if}
</form>

<style>
	.nl {
		width: 100%;
		max-width: 28rem;
	}
	.row {
		display: flex;
		border-bottom: 1px solid var(--ui-border-strong);
	}
	input {
		flex: 1;
		min-width: 0;
		height: 3rem;
		padding: 0 var(--space-2);
		background: transparent;
		border: 0;
		color: var(--ui-text);
		font: inherit;
	}
	input::placeholder {
		color: var(--ui-text-muted);
	}
	input:focus-visible {
		outline: none;
	}
	.row:focus-within {
		border-bottom-color: var(--ui-border-focus);
		box-shadow: 0 1px 0 0 var(--ui-border-focus);
	}
	button {
		min-height: 3rem;
		padding: 0 var(--space-4);
		background: none;
		border: 0;
		color: var(--ui-text);
		font: inherit;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	button:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	.hint,
	.msg {
		margin: var(--space-3) 0 0;
		font-size: var(--fs-xs);
		color: var(--ui-text-muted);
	}
	.msg {
		font-size: var(--fs-sm);
		color: var(--ui-text);
	}
	input[aria-invalid='true'] {
		color: var(--ui-danger);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
