<!--
  @component SiteFooter — burgundy (`data-surface="inverse"`) footer (DESIGN_SYSTEM §2.1):
  newsletter, 4 link columns (accordion on mobile), payment marks (Bancontact first), language
  switch, crown, legal links and the 14-day withdrawal notice.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import NewsletterForm from './NewsletterForm.svelte';
	import PaymentMarks from './PaymentMarks.svelte';
	import LanguageSwitch from './LanguageSwitch.svelte';
	import type { Lang } from '#lib/i18n/paths.ts';
	import type { NavLink } from '#lib/types.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		lang: Lang;
		columns: { shop: NavLink[]; help: NavLink[]; about: NavLink[]; legal: NavLink[] };
		paymentMethods: string[];
		oncookies?: () => void;
		showNewsletter?: boolean;
	}
	let { lang, columns, paymentMethods, oncookies, showNewsletter = true }: Props = $props();

	const groups = $derived([
		{ id: 'shop', title: m.footer_shop(), links: columns.shop },
		{ id: 'help', title: m.footer_help(), links: columns.help },
		{ id: 'about', title: m.footer_about(), links: columns.about },
		{ id: 'legal', title: m.footer_legal(), links: columns.legal }
	]);
	const year = new Date().getFullYear();
</script>

<footer class="footer" data-surface="inverse">
	<div class="container-lux">
		{#if showNewsletter}
		<section class="newsletter" aria-labelledby="nl-title">
			<Icon name="crown" size={30} stroke={1} class="orn" />
			<h2 id="nl-title" class="nl-title">{m.newsletter_title()}</h2>
			<p class="nl-text">{m.newsletter_text()}</p>
			<NewsletterForm {lang} source="footer" />
		</section>
		{/if}

		<div class="cols cols--desktop">
			{#each groups as g (g.id)}
				<nav aria-label={g.title}>
					<h3 class="col-title">{g.title}</h3>
					<ul>
						{#each g.links as l (l.href)}<li><a href={l.href}>{l.label}</a></li>{/each}
					</ul>
				</nav>
			{/each}
		</div>

		<div class="cols cols--mobile">
			{#each groups as g (g.id)}
				<details>
					<summary>{g.title}<Icon name="plus" size={14} class="ico" /></summary>
					<nav aria-label={g.title}>
						<ul>
							{#each g.links as l (l.href)}<li><a href={l.href}>{l.label}</a></li>{/each}
						</ul>
					</nav>
				</details>
			{/each}
		</div>

		<div class="meta">
			<div class="pay">
				<p class="eyebrow">{m.footer_payments()}</p>
				<PaymentMarks methods={paymentMethods} />
			</div>
			<LanguageSwitch {lang} variant="full" />
		</div>

		<div class="bottom">
			<Icon name="crown" size={20} stroke={1} class="orn" />
			<p>{m.footer_rights({ year })}</p>
			<p>{m.footer_withdrawal()}</p>
			{#if oncookies}<button type="button" class="linkish" onclick={oncookies}>{m.footer_cookie_settings()}</button>{/if}
		</div>
	</div>
</footer>

<style>
	.footer {
		padding-block: var(--section-y-sm) var(--space-8);
		margin-top: var(--section-y);
	}
	.footer :global(.orn) {
		color: var(--ui-ornament);
	}
	.newsletter {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: var(--space-3);
		max-width: 34rem;
		margin: 0 auto var(--space-16);
	}
	.nl-title {
		margin: 0;
		font-size: var(--fs-3xl);
		color: var(--ui-text-strong);
	}
	.nl-text {
		margin: 0 0 var(--space-3);
		color: var(--ui-text-muted);
	}
	.cols--desktop {
		display: none;
	}
	@media (min-width: 48rem) {
		.cols--desktop {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: var(--space-8);
			padding-block: var(--space-10);
			border-top: 1px solid var(--ui-border);
		}
		.cols--mobile {
			display: none;
		}
	}
	.col-title {
		margin: 0 0 var(--space-4);
		font-family: var(--ff-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}
	ul a {
		display: inline-flex;
		align-items: center;
		min-height: 2.25rem;
		font-size: var(--fs-sm);
		text-decoration: none;
	}
	ul a:hover {
		text-decoration: underline;
		text-underline-offset: 0.25em;
	}
	.cols--mobile details {
		border-top: 1px solid var(--ui-border);
	}
	.cols--mobile details:last-child {
		border-bottom: 1px solid var(--ui-border);
	}
	.cols--mobile summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 3.25rem;
		list-style: none;
		cursor: pointer;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
	}
	.cols--mobile summary::-webkit-details-marker {
		display: none;
	}
	.cols--mobile details[open] :global(.ico) {
		transform: rotate(45deg);
	}
	.cols--mobile ul {
		padding-bottom: var(--space-4);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-6);
		padding-block: var(--space-8);
		border-top: 1px solid var(--ui-border);
	}
	.pay .eyebrow {
		margin: 0 0 var(--space-3);
	}
	.bottom {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		padding-top: var(--space-6);
		border-top: 1px solid var(--ui-border);
		text-align: center;
		font-size: var(--fs-2xs);
		letter-spacing: 0.04em;
		color: var(--ui-text-muted);
	}
	.bottom p {
		margin: 0;
	}
	.linkish {
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
		min-height: 2.75rem;
	}
</style>
