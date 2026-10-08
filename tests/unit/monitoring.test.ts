import { describe, expect, it } from 'vitest';
import { buildEnvelope, parseDsn, scrub } from '#lib/server/monitoring.ts';

describe('error monitoring (P5-04)', () => {
	it('scrubs personal data from messages', () => {
		const s = scrub('Order for anna.peeters@example.be failed, IBAN BE68539007547034, card 4111 1111 1111 1111, token AbCdEfGhIjKlMnOpQrStUvWxYz0123456789');
		expect(s).not.toContain('anna.peeters');
		expect(s).not.toContain('BE68539007547034');
		expect(s).not.toContain('4111');
		expect(s).not.toContain('AbCdEfGh');
		expect(s).toContain('[email]');
	});

	it('parses a DSN into the envelope endpoint', () => {
		expect(parseDsn('https://abc123@o1.ingest.sentry.io/4567')).toEqual({ endpoint: 'https://o1.ingest.sentry.io/api/4567/envelope/', key: 'abc123' });
		expect(parseDsn('not a dsn')).toBeNull();
	});

	it('builds an envelope without query strings or cookies', () => {
		const env = buildEnvelope('https://k@o1.ingest.sentry.io/1', { message: 'boom for x@y.be', path: '/nl/afrekenen?email=x@y.be', source: 'server' }, 'v1');
		const [header, item, event] = env.split('\n').map((l) => JSON.parse(l));
		expect(header.dsn).toContain('sentry.io');
		expect(item.type).toBe('event');
		expect(event.request.url).toBe('/nl/afrekenen');
		expect(JSON.stringify(event)).not.toContain('x@y.be');
		expect(event.release).toBe('v1');
	});
});
