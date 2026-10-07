/** Money is ALWAYS stored as integer cents (EUR). Never floats. */
export type Locale = 'nl-BE' | 'fr-BE' | 'en';

const eur = new Map<Locale, Intl.NumberFormat>();

/** formatPrice(4995) → "€ 49,95" (nl-BE) · "49,95 €" (fr-BE) */
export function formatPrice(cents: number, locale: Locale = 'nl-BE'): string {
	if (!eur.has(locale)) {
		eur.set(locale, new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }));
	}
	return eur.get(locale)!.format(cents / 100);
}

/** Belgian standard VAT rate. Consumer prices are displayed VAT-inclusive. */
export const BE_VAT_RATE = 0.21;

/** VAT portion contained in a VAT-inclusive amount (for invoices / admin). */
export function vatIncluded(grossCents: number, rate = BE_VAT_RATE): number {
	return Math.round(grossCents - grossCents / (1 + rate));
}

export function formatDate(d: Date | string, locale: Locale = 'nl-BE', opts?: Intl.DateTimeFormatOptions) {
	return new Intl.DateTimeFormat(locale, opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(
		typeof d === 'string' ? new Date(d) : d
	);
}
