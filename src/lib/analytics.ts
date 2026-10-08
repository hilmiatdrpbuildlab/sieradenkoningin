/**
 * Consent-aware analytics events (P4-05).
 *
 * Usage in any storefront component (inside the shop layout):
 *   import { getAnalytics } from '#lib/analytics.ts';
 *   const analytics = getAnalytics();
 *   analytics?.track('add_to_cart', { value: 4995, items: [{ id: product.id, name, variant: 'gold / 52', price: 4995, quantity: 1 }] });
 *
 * - Money is passed in CENTS and sent to GA4 in euros with currency EUR.
 * - `track()` is a no-op (returns false) without analytics consent or when GA4 isn't loaded.
 * - Payloads are rebuilt from a whitelist, so customer data (email, name, address, phone…) can never
 *   leak into an event — even if a caller passes it by mistake. Email-like strings are dropped.
 * - Debug: add `?analytics_debug=1` to a URL (GA4 DebugView + console output).
 */
import { getContext, setContext } from 'svelte';

export type AnalyticsEvent = 'view_item_list' | 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase';

export interface AnalyticsItemInput {
	id: string;
	name: string;
	category?: string;
	variant?: string;
	/** Unit price in cents. */
	price?: number;
	quantity?: number;
	index?: number;
	listName?: string;
	[extra: string]: unknown;
}

export interface EventInputs {
	view_item_list: { listId?: string; listName?: string; items: AnalyticsItemInput[] };
	view_item: { value?: number; items: AnalyticsItemInput[] };
	add_to_cart: { value?: number; items: AnalyticsItemInput[] };
	begin_checkout: { value?: number; coupon?: string; items: AnalyticsItemInput[] };
	purchase: {
		transactionId: string;
		value: number;
		tax?: number;
		shipping?: number;
		coupon?: string;
		items: AnalyticsItemInput[];
	};
}

export interface Ga4Item {
	item_id: string;
	item_name: string;
	item_category?: string;
	item_variant?: string;
	item_list_name?: string;
	price?: number;
	quantity?: number;
	index?: number;
}

export interface Ga4Payload {
	currency: 'EUR';
	value?: number;
	items: Ga4Item[];
	item_list_id?: string;
	item_list_name?: string;
	transaction_id?: string;
	tax?: number;
	shipping?: number;
	coupon?: string;
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** Safe short string: drops anything that looks like an email address; trims to 100 chars. */
function clean(v: unknown): string | undefined {
	if (typeof v !== 'string') return undefined;
	const s = v.trim();
	if (!s || EMAIL_RE.test(s)) return undefined;
	return s.slice(0, 100);
}
const euros = (cents: unknown) =>
	typeof cents === 'number' && Number.isFinite(cents) ? Math.round(cents) / 100 : undefined;
const int = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : undefined);

function prune<T extends object>(o: T): T {
	for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
	return o;
}

export function buildItem(i: AnalyticsItemInput): Ga4Item | null {
	const id = clean(i?.id);
	const name = clean(i?.name);
	if (!id || !name) return null;
	return prune({
		item_id: id,
		item_name: name,
		item_category: clean(i.category),
		item_variant: clean(i.variant),
		item_list_name: clean(i.listName),
		price: euros(i.price),
		quantity: int(i.quantity),
		index: int(i.index)
	});
}

/** Whitelisted GA4 payload for `event` — never contains PII. */
export function buildPayload<E extends AnalyticsEvent>(event: E, input: EventInputs[E]): Ga4Payload {
	const any = input as Partial<EventInputs['purchase'] & EventInputs['view_item_list']>;
	const items = (Array.isArray(any.items) ? any.items : [])
		.map(buildItem)
		.filter((x): x is Ga4Item => !!x)
		.slice(0, 200);
	const out: Ga4Payload = { currency: 'EUR', items, value: euros(any.value) };
	if (event === 'view_item_list') {
		out.item_list_id = clean(any.listId);
		out.item_list_name = clean(any.listName);
		delete out.value;
	}
	if (event === 'begin_checkout' || event === 'purchase') out.coupon = clean(any.coupon);
	if (event === 'purchase') {
		out.transaction_id = clean(any.transactionId);
		out.tax = euros(any.tax);
		out.shipping = euros(any.shipping);
	}
	return prune(out);
}

type Gtag = (...args: unknown[]) => void;

export interface Analytics {
	track<E extends AnalyticsEvent>(event: E, input: EventInputs[E]): boolean;
}

/** `allowed()` is read at call time (the consent store). */
export function createAnalytics(allowed: () => boolean, debug = () => false): Analytics {
	return {
		track(event, input) {
			if (typeof window === 'undefined' || !allowed()) return false;
			const gtag = (window as unknown as { gtag?: Gtag }).gtag;
			if (!gtag) return false;
			const payload = buildPayload(event, input);
			gtag('event', event, debug() ? { ...payload, debug_mode: true } : payload);
			if (debug()) console.info('[analytics]', event, payload);
			return true;
		}
	};
}

const KEY = Symbol('analytics');
export const setAnalyticsContext = (a: Analytics) => setContext(KEY, a);
export const getAnalytics = () => getContext<Analytics | undefined>(KEY);
