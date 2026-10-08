/**
 * Cookie consent (P4-03). Stored client-side in the `sk_consent` cookie for ~6 months as
 * `{ v: 1, analytics, marketing, ts }`. Storefront HTML stays cacheable: the cookie is read after
 * hydration and nothing non-essential loads until `analytics`/`marketing` is true.
 * Exposed per page tree through context (no module-level state).
 */
import { getContext, setContext } from 'svelte';

export const CONSENT_COOKIE = 'sk_consent';
export const CONSENT_VERSION = 1;
/** 6 months — after that the visitor is asked again. */
export const CONSENT_MAX_AGE_S = 182 * 86400;

export interface ConsentValue {
	v: number;
	analytics: boolean;
	marketing: boolean;
	ts: number;
}

/** Parses the cookie value; null when missing, malformed, an older version or older than 6 months. */
export function parseConsent(raw: string | null | undefined, now = Date.now()): ConsentValue | null {
	if (!raw) return null;
	try {
		const v = JSON.parse(decodeURIComponent(raw));
		if (!v || v.v !== CONSENT_VERSION || typeof v.ts !== 'number') return null;
		if (now - v.ts > CONSENT_MAX_AGE_S * 1000 || v.ts > now + 86400_000) return null;
		return { v: CONSENT_VERSION, analytics: v.analytics === true, marketing: v.marketing === true, ts: v.ts };
	} catch {
		return null;
	}
}

export function serializeConsent(c: { analytics: boolean; marketing: boolean }, now = Date.now()) {
	return encodeURIComponent(
		JSON.stringify({ v: CONSENT_VERSION, analytics: c.analytics, marketing: c.marketing, ts: now })
	);
}

const readCookie = (name: string) =>
	document.cookie
		.split('; ')
		.find((c) => c.startsWith(name + '='))
		?.slice(name.length + 1) ?? null;

export class Consent {
	/** The visitor made a choice (and it is still valid). */
	decided = $state(false);
	analytics = $state(false);
	marketing = $state(false);
	/** Banner visible; `details` shows the per-category toggles. */
	open = $state(false);
	details = $state(false);

	/** Call once after mount: reads the cookie or shows the banner. */
	load() {
		const v = parseConsent(readCookie(CONSENT_COOKIE));
		if (v) {
			this.analytics = v.analytics;
			this.marketing = v.marketing;
			this.decided = true;
		} else this.open = true;
	}

	save(choice: { analytics: boolean; marketing: boolean }) {
		const secure = location.protocol === 'https:' ? '; Secure' : '';
		document.cookie = `${CONSENT_COOKIE}=${serializeConsent(choice)}; Max-Age=${CONSENT_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
		this.analytics = choice.analytics;
		this.marketing = choice.marketing;
		this.decided = true;
		this.open = false;
		this.details = false;
	}

	acceptAll() {
		this.save({ analytics: true, marketing: true });
	}

	rejectAll() {
		this.save({ analytics: false, marketing: false });
	}

	/** Re-open from the footer ("Cookie-instellingen"). */
	openSettings() {
		this.open = true;
		this.details = true;
	}
}

const KEY = Symbol('consent');
export const setConsentContext = () => setContext(KEY, new Consent());
export const getConsent = () => getContext<Consent | undefined>(KEY);
