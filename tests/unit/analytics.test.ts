/** P4-05 / P4-03 — analytics payloads never contain PII; tracking needs consent; consent cookie format. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildItem, buildPayload, createAnalytics } from '#lib/analytics.ts';
import { CONSENT_MAX_AGE_S, parseConsent, serializeConsent } from '#lib/stores/consent.svelte.ts';

const PII = {
	email: 'jan.peeters@example.be',
	name: 'Jan Peeters',
	firstName: 'Jan',
	lastName: 'Peeters',
	address: { line1: 'Meir 1', postalCode: '2000', city: 'Antwerpen' },
	phone: '+32 470 12 34 56',
	customerId: 'c-123'
};

describe('payload builders strip PII', () => {
	it('purchase keeps only whitelisted ecommerce fields', () => {
		const p = buildPayload('purchase', {
			transactionId: 'SK-2026-000123',
			value: 12345,
			tax: 2143,
			shipping: 495,
			coupon: 'WELKOM10',
			items: [{ ...PII, id: 'p1', name: 'DEMO Klaverring', variant: 'gold / 52', price: 4995, quantity: 2 }],
			...PII
		} as never);
		expect(p).toEqual({
			currency: 'EUR',
			value: 123.45,
			tax: 21.43,
			shipping: 4.95,
			coupon: 'WELKOM10',
			transaction_id: 'SK-2026-000123',
			items: [{ item_id: 'p1', item_name: 'DEMO Klaverring', item_variant: 'gold / 52', price: 49.95, quantity: 2 }]
		});
		const json = JSON.stringify(p);
		for (const v of ['jan', 'Jan', 'Peeters', 'Meir', 'Antwerpen', '+32', 'c-123', '@']) expect(json).not.toContain(v);
	});

	it('drops email-like strings even in allowed fields', () => {
		const p = buildPayload('begin_checkout', {
			value: 1000,
			coupon: 'jan@example.be',
			items: [{ id: 'p1', name: 'jan@example.be', category: 'x@y.be' }]
		});
		expect(p.coupon).toBeUndefined();
		expect(p.items).toEqual([]);
		expect(buildItem({ id: 'p2', name: 'Ring', category: 'mail me@x.be' })).toEqual({
			item_id: 'p2',
			item_name: 'Ring'
		});
	});

	it('every event type yields only GA4 keys', () => {
		const allowed = new Set([
			'currency',
			'value',
			'items',
			'item_list_id',
			'item_list_name',
			'transaction_id',
			'tax',
			'shipping',
			'coupon'
		]);
		const events = [
			['view_item_list', { listId: 'rings', listName: 'Ringen', items: [] }],
			['view_item', { value: 100, items: [] }],
			['add_to_cart', { value: 100, items: [] }],
			['begin_checkout', { value: 100, items: [] }],
			['purchase', { transactionId: 'SK-1', value: 100, items: [] }]
		] as const;
		for (const [e, input] of events) {
			const keys = Object.keys(buildPayload(e, { ...input, ...PII } as never));
			expect(
				keys.every((k) => allowed.has(k)),
				`${e}: ${keys}`
			).toBe(true);
		}
	});
});

describe('track() needs consent', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('no-ops without consent and sends when allowed', () => {
		const gtag = vi.fn();
		vi.stubGlobal('window', { gtag });
		let allowed = false;
		const a = createAnalytics(() => allowed);
		expect(a.track('add_to_cart', { value: 100, items: [{ id: 'p', name: 'R' }] })).toBe(false);
		expect(gtag).not.toHaveBeenCalled();
		allowed = true;
		expect(a.track('add_to_cart', { value: 100, items: [{ id: 'p', name: 'R' }] })).toBe(true);
		expect(gtag).toHaveBeenCalledWith('event', 'add_to_cart', {
			currency: 'EUR',
			value: 1,
			items: [{ item_id: 'p', item_name: 'R' }]
		});
	});
});

describe('consent cookie', () => {
	it('round-trips and expires after 6 months', () => {
		const now = Date.UTC(2026, 9, 8);
		const raw = serializeConsent({ analytics: true, marketing: false }, now);
		expect(parseConsent(raw, now)).toEqual({ v: 1, analytics: true, marketing: false, ts: now });
		expect(parseConsent(raw, now + CONSENT_MAX_AGE_S * 1000 + 1)).toBeNull();
		expect(CONSENT_MAX_AGE_S).toBeGreaterThanOrEqual(180 * 86400);
		expect(parseConsent('garbage', now)).toBeNull();
		expect(parseConsent(encodeURIComponent(JSON.stringify({ v: 0, analytics: true, ts: now })), now)).toBeNull();
	});
});
