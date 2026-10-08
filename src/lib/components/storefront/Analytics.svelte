<!--
  @component Analytics — loads analytics scripts in the shop layout (P4-05). Renders nothing.
  - Plausible (cookieless, no personal data): loaded whenever PUBLIC_PLAUSIBLE_DOMAIN is set and
    settings.analytics.plausible is on — no consent needed.
  - GA4 (PUBLIC_GA4_ID + settings.analytics.ga4): loaded ONLY after the visitor accepts "analytics" in
    the cookie banner (Consent context). Withdrawing consent stops tracking and removes the _ga cookies.

  API for other components — events are typed, consent-aware and PII-free (see #lib/analytics.ts):
    const analytics = getAnalytics();
    analytics?.track('view_item', { value: 4995, items: [{ id, name, price: 4995 }] });
  Events: view_item_list, view_item, add_to_cart, begin_checkout, purchase (server-confirmed on the
  thanks page). The layout creates the context: setAnalyticsContext(createAnalytics(() => consent.analytics)).
  Debug: append ?analytics_debug=1 (GA4 DebugView + console).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { PUBLIC_GA4_ID, PUBLIC_PLAUSIBLE_DOMAIN } from '$app/env/public';
	import { getConsent } from '#lib/stores/consent.svelte.ts';

	let { settings = { plausible: true, ga4: true } }: { settings?: { plausible: boolean; ga4: boolean } } = $props();

	const consent = getConsent();
	let gaLoaded = $state(false);
	let mounted = $state(false);

	type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };

	function addScript(src: string, attrs: Record<string, string> = {}) {
		const s = document.createElement('script');
		s.src = src;
		s.async = true;
		s.defer = true;
		for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
		document.head.appendChild(s);
	}

	function loadGa4() {
		const w = window as W;
		w.dataLayer = w.dataLayer || [];
		// gtag must push the `arguments` object itself (GA4 requirement).
		w.gtag = function gtag() {
			w.dataLayer!.push(arguments);
		};
		const debug = new URLSearchParams(location.search).has('analytics_debug');
		w.gtag('consent', 'default', {
			ad_storage: 'denied',
			ad_user_data: 'denied',
			ad_personalization: 'denied',
			analytics_storage: 'granted'
		});
		w.gtag('js', new Date());
		w.gtag('config', PUBLIC_GA4_ID, {
			send_page_view: false,
			allow_google_signals: false,
			allow_ad_personalization_signals: false,
			...(debug ? { debug_mode: true } : {})
		});
		addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(PUBLIC_GA4_ID)}`);
		gaLoaded = true;
		pageView();
	}

	function pageView() {
		const w = window as W;
		if (gaLoaded && consent?.analytics && w.gtag)
			w.gtag('event', 'page_view', { page_location: location.origin + location.pathname, page_title: document.title });
	}

	function removeGaCookies() {
		const host = location.hostname;
		const domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];
		for (const c of document.cookie.split('; ')) {
			const name = c.split('=')[0];
			if (name === '_ga' || name.startsWith('_ga_') || name === '_gid') {
				for (const d of domains) document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ''}`;
			}
		}
	}

	onMount(() => {
		mounted = true;
		if (PUBLIC_PLAUSIBLE_DOMAIN && settings.plausible)
			addScript('https://plausible.io/js/script.js', { 'data-domain': PUBLIC_PLAUSIBLE_DOMAIN });
	});

	$effect(() => {
		if (!mounted || !PUBLIC_GA4_ID || !settings.ga4) return;
		const allowed = !!consent?.analytics;
		const w = window as W;
		if (allowed && !gaLoaded) loadGa4();
		else if (!allowed && gaLoaded) {
			w.gtag?.('consent', 'update', { analytics_storage: 'denied' });
			removeGaCookies();
		} else if (allowed && gaLoaded) w.gtag?.('consent', 'update', { analytics_storage: 'granted' });
	});

	afterNavigate(({ type }) => {
		if (type !== 'enter') pageView();
	});
</script>
