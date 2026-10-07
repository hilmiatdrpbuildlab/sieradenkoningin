/**
 * Newsletter adapter (decision D5: Brevo). Only CONFIRMED (double opt-in) subscribers are synced.
 * - `brevo`: Brevo contacts API.
 * - `mock`: no-op that records calls in memory for the current request only.
 */
export interface NewsletterAdapter {
	provider: 'brevo' | 'mock';
	upsertContact(email: string, locale: string, source?: string | null): Promise<void>;
	unsubscribe(email: string): Promise<void>;
}

export function createNewsletter(apiKey: string, listId: string): NewsletterAdapter {
	if (!apiKey) {
		return { provider: 'mock', async upsertContact() {}, async unsubscribe() {} };
	}
	const api = async (path: string, init: RequestInit) => {
		const res = await fetch(`https://api.brevo.com/v3${path}`, {
			...init,
			headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' }
		});
		if (!res.ok && res.status !== 204) throw new Error(`Brevo ${path} → ${res.status}: ${await res.text()}`);
	};
	return {
		provider: 'brevo',
		upsertContact: (email, locale, source) =>
			api('/contacts', {
				method: 'POST',
				body: JSON.stringify({
					email,
					updateEnabled: true,
					listIds: listId ? [Number(listId)] : undefined,
					attributes: { LOCALE: locale, SOURCE: source ?? '' }
				})
			}),
		unsubscribe: (email) =>
			api(`/contacts/${encodeURIComponent(email)}`, { method: 'PUT', body: JSON.stringify({ emailBlacklisted: true }) })
	};
}
