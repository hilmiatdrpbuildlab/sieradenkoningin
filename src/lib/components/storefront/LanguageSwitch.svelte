<!--
  @component LanguageSwitch — NL | FR links to the SAME page in the other language.
  Uses `page.data.alternates` when a page provides them (localized slugs), otherwise maps the path.
  Full page load (data-sveltekit-reload) because the document language changes.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { localizeHref, type Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { lang, variant = 'compact' }: { lang: Lang; variant?: 'compact' | 'full' } = $props();

	const hrefFor = (l: Lang) => {
		const alt = (page.data as { alternates?: Record<Lang, string> }).alternates?.[l];
		return alt ?? localizeHref(page.url.pathname + page.url.search, l);
	};
	const langs: { code: Lang; short: string; name: () => string }[] = [
		{ code: 'nl', short: 'NL', name: m.lang_nl },
		{ code: 'fr', short: 'FR', name: m.lang_fr }
	];
</script>

<nav class="langs langs--{variant}" aria-label={m.lang_switch()}>
	{#each langs as l (l.code)}
		<a
			href={hrefFor(l.code)}
			hreflang={l.code === 'fr' ? 'fr-BE' : 'nl-BE'}
			lang={l.code}
			aria-current={l.code === lang ? 'true' : undefined}
			aria-label={l.code === lang ? l.name() : m.lang_switch_to({ language: l.name() })}
			data-sveltekit-reload
		>
			{variant === 'full' ? l.name() : l.short}
		</a>
	{/each}
</nav>

<style>
	.langs {
		display: flex;
		align-items: center;
	}
	a {
		min-width: 2.75rem;
		min-height: 2.75rem;
		display: grid;
		place-items: center;
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-decoration: none;
		opacity: 0.65;
	}
	a[aria-current] {
		opacity: 1;
		text-decoration: underline;
		text-underline-offset: 0.4em;
	}
	a:hover {
		opacity: 1;
	}
	.langs--compact a + a {
		position: relative;
	}
	.langs--compact a + a::before {
		content: '';
		position: absolute;
		left: 0;
		height: 0.75rem;
		width: 1px;
		background: currentColor;
		opacity: 0.35;
	}
	.langs--full {
		gap: var(--space-4);
	}
	.langs--full a {
		font-size: var(--fs-sm);
		letter-spacing: var(--ls-wide);
		min-width: 0;
		padding-inline: var(--space-1);
	}
</style>
