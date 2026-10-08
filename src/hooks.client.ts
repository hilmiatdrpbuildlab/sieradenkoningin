import type { HandleClientError } from '@sveltejs/kit/hooks';
import { defineCustomClientStrategy } from '#lib/paraglide/runtime.js';

// The document language is fixed per page load (language switches are full reloads), so the
// client locale is read from <html lang="nl-BE|fr-BE"> rendered by the server.
defineCustomClientStrategy('custom-path', {
	getLocale: () => (document.documentElement.lang.startsWith('fr') ? 'fr' : 'nl'),
	setLocale: () => {}
});

/** Unexpected browser errors → same-origin relay → Sentry (P5-04). Fire-and-forget, never throws. */
export const handleError: HandleClientError = ({ error, event, kind }) => {
	if (kind !== 'unknown') return;
	const e = error instanceof Error ? error : new Error(String(error));
	try {
		navigator.sendBeacon?.(
			'/api/client-error',
			new Blob(
				[
					JSON.stringify({
						message: e.message.slice(0, 1000),
						stack: e.stack?.slice(0, 5000),
						path: event.url.pathname
					})
				],
				{ type: 'application/json' }
			)
		);
	} catch {
		/* ignore */
	}
};
