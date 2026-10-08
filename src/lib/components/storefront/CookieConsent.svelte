<!--
  @component CookieConsent — cookie banner (P4-03): necessary / analytics / marketing. "Alles accepteren"
  and "Alles weigeren" have equal weight; "Instellen" shows per-category switches. The choice is stored
  for 6 months (Consent store, cookie `sk_consent`) and can be reopened from the footer.
  Non-modal: the shop stays usable; nothing non-essential loads until consent is given.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { getConsent } from '#lib/stores/consent.svelte.ts';
	import { localizeHref, type Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { lang }: { lang: Lang } = $props();
	const consent = getConsent();
	const uid = $props.id();
	let analytics = $state(false);
	let marketing = $state(false);
	let panel: HTMLElement | undefined = $state();

	onMount(() => consent?.load());

	// Sync the switches with the stored choice whenever the banner opens; focus it when reopened.
	$effect(() => {
		if (!consent?.open) return;
		analytics = consent.analytics;
		marketing = consent.marketing;
		if (consent.decided) tick().then(() => panel?.focus());
	});
</script>

{#if consent?.open}
	<div
		bind:this={panel}
		class="cc"
		role="dialog"
		aria-modal="false"
		aria-labelledby="cc{uid}-t"
		aria-describedby="cc{uid}-d"
		tabindex="-1"
		data-testid="cookie-consent"
	>
		<div class="inner">
			<h2 id="cc{uid}-t">{consent.details ? m.cookie_settings_title() : m.cookie_title()}</h2>
			<p id="cc{uid}-d">
				{m.cookie_text()}
				<a href={localizeHref('/cookies', lang)}>{m.cookie_policy()}</a>
			</p>

			{#if consent.details}
				<ul class="cats">
					<li>
						<label>
							<input type="checkbox" checked disabled />
							<span
								><strong>{m.cookie_necessary()}</strong> · {m.cookie_always_on()}<small
									>{m.cookie_necessary_desc()}</small
								></span
							>
						</label>
					</li>
					<li>
						<label>
							<input type="checkbox" bind:checked={analytics} />
							<span><strong>{m.cookie_analytics()}</strong><small>{m.cookie_analytics_desc()}</small></span>
						</label>
					</li>
					<li>
						<label>
							<input type="checkbox" bind:checked={marketing} />
							<span><strong>{m.cookie_marketing()}</strong><small>{m.cookie_marketing_desc()}</small></span>
						</label>
					</li>
				</ul>
			{/if}

			<div class="actions">
				<Button variant="outline" size="sm" onclick={() => consent.rejectAll()}>{m.cookie_reject()}</Button>
				<Button variant="outline" size="sm" onclick={() => consent.acceptAll()}>{m.cookie_accept()}</Button>
				{#if consent.details}
					<Button variant="primary" size="sm" onclick={() => consent.save({ analytics, marketing })}
						>{m.cookie_save()}</Button
					>
				{:else}
					<Button variant="link" size="sm" onclick={() => (consent.details = true)}>{m.cookie_customize()}</Button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.cc {
		position: fixed;
		inset-inline: var(--space-2);
		bottom: var(--space-2);
		z-index: calc(var(--z-toast) - 1);
		max-height: calc(100dvh - var(--space-4));
		overflow-y: auto;
		background: var(--ui-surface);
		color: var(--ui-text);
		border: 1px solid var(--ui-border);
		box-shadow: var(--elev-xl);
	}
	.cc:focus-visible {
		outline: 2px solid var(--ui-border-focus);
	}
	@media (min-width: 48rem) {
		.cc {
			left: auto;
			right: var(--space-6);
			bottom: var(--space-6);
			width: 30rem;
		}
	}
	.inner {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-5);
	}
	h2 {
		margin: 0;
		font-size: var(--fs-xl);
	}
	p {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-relaxed);
	}
	a {
		color: var(--ui-accent);
	}
	.cats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
		border-top: 1px solid var(--ui-border);
		padding-top: var(--space-3);
	}
	label {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		min-height: 2.75rem;
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	input {
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 2px;
		accent-color: var(--ui-action);
		flex-shrink: 0;
	}
	input:disabled + span {
		cursor: default;
	}
	small {
		display: block;
		color: var(--ui-text-muted);
		font-size: var(--fs-xs);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.actions :global(.btn--outline) {
		flex: 1 1 9rem;
	}
</style>
