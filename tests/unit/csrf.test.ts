import { describe, expect, it } from 'vitest';
import { isCsrfForbidden } from '#lib/server/csrf.ts';

const url = (p: string) => new URL(`https://shop.example${p}`);
const req = (method: string, headers: Record<string, string>) => new Request('https://shop.example/x', { method, headers, body: method === 'GET' ? undefined : 'a=1' });
const form = { 'content-type': 'application/x-www-form-urlencoded' };

describe('CSRF origin check', () => {
	it('allows same-origin form posts and blocks cross-site ones', () => {
		expect(isCsrfForbidden(req('POST', { ...form, origin: 'https://shop.example' }), url('/nl/afrekenen'))).toBe(false);
		expect(isCsrfForbidden(req('POST', { ...form, origin: 'https://evil.example' }), url('/nl/afrekenen'))).toBe(true);
		expect(isCsrfForbidden(req('POST', form), url('/admin/products'))).toBe(true); // no Origin
		expect(isCsrfForbidden(req('DELETE', { 'content-type': 'text/plain' }), url('/admin/x'))).toBe(true);
	});

	it('exempts provider webhooks (they verify themselves)', () => {
		expect(isCsrfForbidden(req('POST', form), url('/api/webhooks/mollie'))).toBe(false);
		expect(isCsrfForbidden(req('POST', form), url('/api/webhooks/sendcloud'))).toBe(false);
	});

	it('ignores JSON requests and safe methods (same as SvelteKit)', () => {
		expect(isCsrfForbidden(req('POST', { 'content-type': 'application/json' }), url('/api/cart'))).toBe(false);
		expect(isCsrfForbidden(req('GET', {}), url('/nl'))).toBe(false);
	});
});
