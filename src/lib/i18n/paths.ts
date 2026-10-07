/**
 * Localized URL scheme (EXECUTION_PLAN §2.5, §7.1).
 *
 * Internal routes are English and live under `src/routes/[lang=lang]/(shop)/…`.
 * Public paths are localized per language:  /nl/winkelmand ⇄ /nl/cart (internal).
 * The `reroute` hook (src/hooks.ts) maps public → internal with `delocalizePath()`;
 * links are built with `localizeHref(internalPath, lang)`.
 *
 * Paths that are not in the map (product slugs under /p/, category and content-page slugs
 * resolved by the `[slug]` route) pass through unchanged.
 */

export const LANGS = ['nl', 'fr'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'nl';

export const isLang = (v: unknown): v is Lang => v === 'nl' || v === 'fr';

/** BCP-47 tag used for <html lang>, hreflang and Intl formatting. */
export const htmlLang = (lang: Lang) => (lang === 'fr' ? 'fr-BE' : 'nl-BE');

/**
 * Segment map: internal path prefix → localized prefix per language.
 * Multi-segment prefixes are matched before their parents (longest prefix wins).
 */
export const SEGMENTS: ReadonlyArray<readonly [internal: string, nl: string, fr: string]> = [
	['search', 'zoeken', 'recherche'],
	['wishlist', 'verlanglijst', 'liste-de-souhaits'],
	['cart', 'winkelmand', 'panier'],
	['checkout/thanks', 'bedankt', 'merci'],
	['checkout/pay', 'betalen', 'paiement'],
	['checkout', 'afrekenen', 'commande'],
	['track', 'bestelling-volgen', 'suivi-commande'],
	['collections', 'collectie', 'collection'],
	['account/login', 'account/inloggen', 'compte/connexion'],
	['account/register', 'account/registreren', 'compte/inscription'],
	['account/forgot', 'account/wachtwoord-vergeten', 'compte/mot-de-passe-oublie'],
	['account/reset', 'account/wachtwoord-herstellen', 'compte/reinitialiser'],
	['account/verify', 'account/bevestigen', 'compte/confirmer'],
	['account/magic', 'account/magische-link', 'compte/lien-magique'],
	['account/orders', 'account/bestellingen', 'compte/commandes'],
	['account/addresses', 'account/adressen', 'compte/adresses'],
	['account/settings', 'account/instellingen', 'compte/parametres'],
	['account/returns', 'account/retouren', 'compte/retours'],
	['account', 'account', 'compte'],
	['newsletter/confirm', 'nieuwsbrief/bevestigen', 'newsletter/confirmer'],
	['newsletter/unsubscribe', 'nieuwsbrief/uitschrijven', 'newsletter/desinscription'],
	['faq', 'faq', 'faq'],
	['contact', 'contact', 'contact']
];

const byLength = [...SEGMENTS].sort((a, b) => b[0].split('/').length - a[0].split('/').length);
const idx = (lang: Lang) => (lang === 'nl' ? 1 : 2);

function startsWithSegments(rest: string, prefix: string) {
	return rest === prefix || rest.startsWith(prefix + '/');
}

/** Split "/fr/panier?x=1" into { lang: 'fr', rest: 'panier', suffix: '?x=1' }. */
function split(path: string): { lang: Lang | null; rest: string; suffix: string } {
	const m = /^([^?#]*)(.*)$/.exec(path)!;
	const parts = m[1].split('/').filter(Boolean);
	const lang = isLang(parts[0]) ? parts[0] : null;
	return { lang, rest: (lang ? parts.slice(1) : parts).join('/'), suffix: m[2] };
}

/**
 * Public localized path → internal path. `/nl/winkelmand` → `/nl/cart`.
 * Returns the input unchanged for non-localized paths (admin, api, assets).
 */
export function delocalizePath(path: string): string {
	const { lang, rest, suffix } = split(path);
	if (!lang) return path;
	for (const entry of byLength) {
		const localized = entry[idx(lang)];
		if (startsWithSegments(rest, localized)) {
			const tail = rest.slice(localized.length);
			return `/${lang}/${entry[0]}${tail}${suffix}`;
		}
	}
	return path;
}

/**
 * Internal path (with or without language prefix) → public path in `lang`.
 * `localizeHref('/cart', 'fr')` → `/fr/panier`; `localizeHref('/nl/account/login', 'fr')` → `/fr/compte/connexion`.
 */
export function localizeHref(path: string, lang: Lang): string {
	if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
	const { lang: current, rest, suffix } = split(path);
	// An already-localized path in another language is first mapped back to internal.
	const internal = current ? split(delocalizePath(path)).rest : rest;
	for (const entry of byLength) {
		if (startsWithSegments(internal, entry[0])) {
			return `/${lang}/${entry[idx(lang)]}${internal.slice(entry[0].length)}${suffix}`;
		}
	}
	return `/${lang}${internal ? '/' + internal : ''}${suffix}`;
}

/** Pick the best language from an Accept-Language header (nl default, §2.5). */
export function negotiateLang(acceptLanguage: string | null | undefined): Lang {
	if (!acceptLanguage) return DEFAULT_LANG;
	const ranked = acceptLanguage
		.split(',')
		.map((part) => {
			const [tag, ...params] = part.trim().toLowerCase().split(';');
			const q = params.find((p) => p.trim().startsWith('q='));
			return { tag, q: q ? Number(q.trim().slice(2)) || 0 : 1 };
		})
		.sort((a, b) => b.q - a.q);
	for (const { tag } of ranked) {
		const base = tag.split('-')[0];
		if (isLang(base)) return base;
	}
	return DEFAULT_LANG;
}

/** Language of a request path (`/fr/...` → fr, anything else → nl). */
export const langFromPath = (pathname: string): Lang => (pathname.startsWith('/fr/') || pathname === '/fr' ? 'fr' : 'nl');
