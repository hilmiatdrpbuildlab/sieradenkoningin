/**
 * Error reporting to Sentry (P5-04) without an SDK: one fetch to the envelope endpoint.
 * PII scrubbing: no request bodies, no cookies, no headers except user-agent, query strings removed,
 * and anything that looks like an e-mail address, IBAN/card number or token is masked in messages.
 * Without SENTRY_DSN everything is a no-op (dev/tests).
 */

export interface ErrorReport {
	message: string;
	stack?: string;
	level?: 'error' | 'warning';
	path?: string; // URL pathname (no query string)
	method?: string;
	userAgent?: string | null;
	source: 'server' | 'client';
	tags?: Record<string, string>;
}

/** Masks e-mail addresses, long digit runs (cards/IBAN/phone) and long tokens. Unit-tested. */
export function scrub(text: string): string {
	return text
		.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
		.replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{10,30}\b/g, '[iban]')
		.replace(/\b\d[\d -]{10,}\d\b/g, '[number]')
		.replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]');
}

export function parseDsn(dsn: string): { endpoint: string; key: string } | null {
	try {
		const u = new URL(dsn);
		const project = u.pathname.replace(/^\//, '');
		if (!u.username || !project) return null;
		return { endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`, key: u.username };
	} catch {
		return null;
	}
}

/** Builds the envelope body (exported for tests). */
export function buildEnvelope(dsn: string, r: ErrorReport, release: string, now = new Date()): string {
	const eventId = crypto.randomUUID().replace(/-/g, '');
	const frames = (r.stack ?? '')
		.split('\n')
		.slice(1, 30)
		.map((l) => ({ function: scrub(l.trim()).slice(0, 200) }))
		.reverse();
	const event = {
		event_id: eventId,
		timestamp: now.toISOString(),
		platform: 'javascript',
		level: r.level ?? 'error',
		release,
		environment: 'production',
		tags: { source: r.source, ...r.tags },
		request: r.path ? { url: r.path.split('?')[0], method: r.method, headers: r.userAgent ? { 'User-Agent': r.userAgent } : {} } : undefined,
		exception: { values: [{ type: 'Error', value: scrub(r.message).slice(0, 1000), stacktrace: frames.length ? { frames } : undefined }] }
	};
	const header = { event_id: eventId, dsn, sent_at: now.toISOString() };
	return `${JSON.stringify(header)}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}`;
}

export async function reportError(dsn: string | undefined, r: ErrorReport, release = 'dev'): Promise<void> {
	if (!dsn) return;
	const target = parseDsn(dsn);
	if (!target) return;
	try {
		await fetch(target.endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-sentry-envelope', 'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=sk-min/1.0` },
			body: buildEnvelope(dsn, r, release)
		});
	} catch {
		/* monitoring must never break the request */
	}
}
