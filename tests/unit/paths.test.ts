import { describe, expect, it } from 'vitest';
import { delocalizePath, localizeHref, negotiateLang, SEGMENTS } from '#lib/i18n/paths.ts';

describe('localized path map', () => {
	it('maps every internal segment to NL and FR and back (round trip)', () => {
		for (const [internal, nl, fr] of SEGMENTS) {
			expect(localizeHref(`/${internal}`, 'nl')).toBe(`/nl/${nl}`);
			expect(localizeHref(`/${internal}`, 'fr')).toBe(`/fr/${fr}`);
			expect(delocalizePath(`/nl/${nl}`)).toBe(`/nl/${internal}`);
			expect(delocalizePath(`/fr/${fr}`)).toBe(`/fr/${internal}`);
		}
	});

	it('keeps the longest prefix (thanks page is not the checkout page)', () => {
		expect(delocalizePath('/nl/bedankt/SK-2026-000001')).toBe('/nl/checkout/thanks/SK-2026-000001');
		expect(localizeHref('/checkout/thanks/SK-2026-000001', 'fr')).toBe('/fr/merci/SK-2026-000001');
		expect(delocalizePath('/fr/compte/commandes/SK-1')).toBe('/fr/account/orders/SK-1');
	});

	it('switches language for an already-localized path, keeping query and hash', () => {
		expect(localizeHref('/nl/winkelmand?x=1#top', 'fr')).toBe('/fr/panier?x=1#top');
		expect(localizeHref('/fr/compte/connexion', 'nl')).toBe('/nl/account/inloggen');
		expect(localizeHref('/nl/zoeken?q=klaver', 'fr')).toBe('/fr/recherche?q=klaver');
		expect(localizeHref('/nl/p/klaver-ring', 'fr')).toBe('/fr/p/klaver-ring');
		expect(localizeHref('/fr', 'nl')).toBe('/nl');
	});

	it('leaves unknown, admin and external paths alone', () => {
		expect(delocalizePath('/nl/ringen')).toBe('/nl/ringen');
		expect(delocalizePath('/admin/products')).toBe('/admin/products');
		expect(localizeHref('https://example.com', 'fr')).toBe('https://example.com');
		expect(localizeHref('/', 'fr')).toBe('/fr');
	});

	it('negotiates nl by default and honours q-values', () => {
		expect(negotiateLang(null)).toBe('nl');
		expect(negotiateLang('fr-BE,fr;q=0.9,en;q=0.8')).toBe('fr');
		expect(negotiateLang('en-US,en;q=0.9')).toBe('nl');
		expect(negotiateLang('de;q=1,fr;q=0.5,nl;q=0.7')).toBe('nl');
	});
});
