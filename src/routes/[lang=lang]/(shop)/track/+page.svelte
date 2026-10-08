<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import AuthShell from '#lib/components/storefront/AuthShell.svelte';
	import Notice from '#lib/components/storefront/Notice.svelte';
	import OrderTimeline from '#lib/components/storefront/OrderTimeline.svelte';
	import Turnstile from '#lib/components/storefront/Turnstile.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { errText, statusLabel } from '#lib/components/storefront/account-labels.ts';
	import { formatDate } from '#lib/utils/format.ts';
	import { localizeHref } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();
	let busy = $state(false);
	const errors = $derived(form && 'errors' in form ? form.errors : null);
	const values = $derived(form && 'values' in form ? form.values : null);
	const order = $derived(form && 'order' in form ? form.order : null);
</script>

<Seo title={m.track_title()} description={m.track_lead()} />

<AuthShell title={m.track_title()} lead={m.track_lead()}>
	{#if order}
		<section class="result" aria-labelledby="track-result">
			<h2 id="track-result">{m.track_result_title({ number: order.number })}</h2>
			<p class="meta">
				{m.acct_placed_on({ date: formatDate(order.placedAt, data.lang, { day: 'numeric', month: 'long', year: 'numeric' }) })} ·
				<strong>{statusLabel(order.status)}</strong>
			</p>
			<OrderTimeline steps={order.timeline} shipments={order.shipments} lang={data.lang} />
			{#if order.lines.length}
				<ul class="lines">
					{#each order.lines as l, i (i)}
						<li>{l.qty} × {l.name}{#if l.variantLabel}<span> — {l.variantLabel}</span>{/if}</li>
					{/each}
				</ul>
			{/if}
			<a class="again" href={localizeHref('/track', data.lang)}>{m.track_another()}</a>
		</section>
	{:else}
		<form
			method="POST"
			class="form"
			novalidate
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			{#if form && 'error' in form}
				<Notice kind="error">
					<p>{form.error === 'rate' ? m.acct_err_rate() : form.error === 'captcha' ? m.acct_err_captcha() : m.track_not_found()}</p>
				</Notice>
			{/if}
			<Field label={m.track_number()} required hint={m.track_number_hint()} error={errText(errors, 'number')}>
				<Input name="number" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength={20} placeholder="SK-2026-000123" value={values?.number ?? ''} />
			</Field>
			<Field label={m.acct_email()} required hint={m.track_email_hint()} error={errText(errors, 'email')}>
				<Input name="email" type="email" autocomplete="email" inputmode="email" value={values?.email ?? ''} />
			</Field>
			<Turnstile />
			<Button type="submit" full loading={busy}>{m.track_submit()}</Button>
		</form>
	{/if}
	{#snippet footer()}
		<p>{m.track_have_account()} <a href={localizeHref('/account/orders', data.lang)}>{m.track_account_link()}</a></p>
	{/snippet}
</AuthShell>

<style>
	.form,
	.result {
		display: grid;
		gap: var(--space-5);
	}
	h2 {
		margin: 0;
		font-size: var(--fs-xl);
		overflow-wrap: anywhere;
	}
	.meta {
		margin: 0;
		color: var(--ui-text-muted);
	}
	.meta strong {
		color: var(--ui-text);
		font-weight: var(--fw-medium);
	}
	.lines {
		margin: 0;
		padding: var(--space-4) 0 0;
		list-style: none;
		border-top: 1px solid var(--ui-border);
		font-size: var(--fs-sm);
		display: grid;
		gap: var(--space-1);
	}
	.lines span {
		color: var(--ui-text-muted);
	}
	.again {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--ui-accent);
	}
</style>
