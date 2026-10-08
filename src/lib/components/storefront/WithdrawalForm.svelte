<!--
  @component WithdrawalForm — HTML version of the statutory model withdrawal form (Directive 2011/83/EU,
  Annex I(B)), shown on the withdrawal legal page next to the PDF (P4-03). The consumer fills it in,
  prints / saves it as PDF and sends it; nothing is submitted to the server. The trader block comes from
  the store settings.
-->
<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Store {
		name: string;
		legalName: string;
		street: string;
		postalCode: string;
		city: string;
		country: string;
		email: string;
		phone: string;
	}
	let { store, lang }: { store: Store; lang: 'nl' | 'fr' } = $props();
	const uid = $props.id();
	const trader = $derived(
		[
			store.legalName || store.name,
			store.street,
			[store.postalCode, store.city].filter(Boolean).join(' '),
			store.street ? store.country : '',
			store.email,
			store.phone
		].filter(Boolean)
	);
	const id = (k: string) => `wd${uid}-${k}`;
	const colon = $derived(lang === 'fr' ? ' :' : ':');
</script>

<section class="wd" aria-labelledby={id('t')}>
	<h2 id={id('t')}>{m.wd_html_title()}</h2>
	<p class="lead">{m.wd_html_text()}</p>

	<div class="sheet">
		<h3>{m.wd_title()}</h3>
		<p class="intro">{m.wd_intro()}</p>

		<div class="to">
			<span>— {m.wd_to()}{colon}</span>
			<address>
				{#each trader as line, i (i)}{line}<br />{/each}
				{#if !store.street || !store.city}<em>{m.wd_trader_missing()}</em>{/if}
			</address>
		</div>

		<p>— {m.wd_notice()}{colon}</p>
		<label class="sr" for={id('goods')}>{m.wd_goods()}</label>
		<textarea id={id('goods')} rows="3" {lang}></textarea>

		<label for={id('ordered')}>— {m.wd_ordered()}{colon}</label>
		<input id={id('ordered')} type="text" />

		<label for={id('name')}>— {m.wd_name()}{colon}</label>
		<input id={id('name')} type="text" autocomplete="name" />

		<label for={id('address')}>— {m.wd_address()}{colon}</label>
		<textarea id={id('address')} rows="2" autocomplete="street-address"></textarea>

		<p class="sig">— {m.wd_signature()}{colon}</p>
		<div class="line" aria-hidden="true"></div>

		<label for={id('date')}>— {m.wd_date()}{colon}</label>
		<input id={id('date')} type="date" />

		<p class="note">{m.wd_strike()}</p>
	</div>

	<div class="actions">
		<Button variant="outline" size="sm" icon="printer" onclick={() => window.print()}>{m.wd_print()}</Button>
		<Button variant="link" size="sm" icon="download" href="/api/legal/withdrawal-form.pdf?lang={lang}" download
			>{m.legal_withdrawal_download()}</Button
		>
	</div>
</section>

<style>
	.wd {
		margin-top: var(--space-12);
	}
	h2 {
		font-size: var(--fs-2xl);
		margin: 0 0 var(--space-2);
	}
	.lead {
		margin: 0 0 var(--space-6);
		color: var(--ui-text-muted);
	}
	.sheet {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-6);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
	}
	h3 {
		margin: 0;
		font-size: var(--fs-xl);
	}
	.intro,
	.note {
		margin: 0 0 var(--space-3);
		font-size: var(--fs-sm);
		font-style: italic;
		color: var(--ui-text-muted);
	}
	.note {
		margin: var(--space-3) 0 0;
	}
	.to {
		display: grid;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}
	address {
		font-style: normal;
		padding-left: var(--space-4);
	}
	p {
		margin: var(--space-2) 0 0;
	}
	label {
		margin-top: var(--space-3);
		font-size: var(--fs-sm);
	}
	input,
	textarea {
		width: 100%;
		min-height: 2.75rem;
		padding: var(--space-2);
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--ui-border-strong);
		color: var(--ui-text);
		font: inherit;
		resize: vertical;
	}
	input:focus-visible,
	textarea:focus-visible {
		outline: none;
		border-bottom-color: var(--ui-border-focus);
		box-shadow: 0 1px 0 0 var(--ui-border-focus);
	}
	.sig {
		font-size: var(--fs-sm);
	}
	.line {
		height: 3rem;
		border-bottom: 1px solid var(--ui-border-strong);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	@media print {
		.actions,
		.lead {
			display: none;
		}
		.sheet {
			border: 0;
			padding: 0;
		}
	}
</style>
