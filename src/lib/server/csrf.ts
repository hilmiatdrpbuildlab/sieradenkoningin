/**
 * CSRF protection (replaces SvelteKit's built-in origin check, which is disabled via
 * `csrf.trustedOrigins: ['*']` in vite.config.ts).
 *
 * Why: payment/shipping providers post webhooks as form data WITHOUT an Origin header (Mollie), which
 * SvelteKit's global check rejects with 403 in production. We apply the exact same rule as SvelteKit
 * (form content type + mutating method + Origin ≠ self) but exempt `/api/webhooks/*`. Webhook handlers
 * never trust the request body: Mollie payments are re-fetched from the API, Sendcloud is HMAC-signed.
 */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
export const CSRF_EXEMPT_PREFIXES = ['/api/webhooks/'];

export function isCsrfForbidden(request: Request, url: URL): boolean {
	if (!MUTATING.has(request.method)) return false;
	if (CSRF_EXEMPT_PREFIXES.some((p) => url.pathname.startsWith(p))) return false;
	const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (type && !FORM_TYPES.includes(type)) return false;
	return request.headers.get('origin') !== url.origin;
}
