import { defineCustomClientStrategy } from '#lib/paraglide/runtime.js';

// The document language is fixed per page load (language switches are full reloads), so the
// client locale is read from <html lang="nl-BE|fr-BE"> rendered by the server.
defineCustomClientStrategy('custom-path', {
	getLocale: () => (document.documentElement.lang.startsWith('fr') ? 'fr' : 'nl'),
	setLocale: () => {}
});
