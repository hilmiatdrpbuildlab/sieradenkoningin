/** Money is ALWAYS stored as integer cents (EUR). Never floats. */
export type Locale = 'nl-BE' | 'fr-BE' | 'en';

/** formatPrice(4995) → "€ 49,95" (nl-BE) · "49,95 €" (fr-BE). Formatters are created per call
 *  site via the Intl cache of the runtime — no module-level mutable state (§2.2). */
export function formatPrice(cents: number, locale: Locale | 'nl' | 'fr' = 'nl-BE'): string {
	const loc = locale === 'nl' ? 'nl-BE' : locale === 'fr' ? 'fr-BE' : locale;
	return new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Cents → "49,95" for form inputs (admin). */
export function centsToInput(cents: number | null | undefined): string {
	if (cents == null) return '';
	return (cents / 100).toFixed(2).replace('.', ',');
}

/** Belgian standard VAT rate. Consumer prices are displayed VAT-inclusive. */
export const BE_VAT_RATE = 0.21;

/** VAT portion contained in a VAT-inclusive amount (for invoices / admin). */
export function vatIncluded(grossCents: number, rate = BE_VAT_RATE): number {
	return Math.round(grossCents - grossCents / (1 + rate));
}

/** All timestamps are stored in UTC and rendered in Europe/Brussels (§2.4). */
export const TIME_ZONE = 'Europe/Brussels';

export function formatDate(d: Date | string, locale: Locale | 'nl' | 'fr' = 'nl-BE', opts?: Intl.DateTimeFormatOptions) {
	const loc = locale === 'nl' ? 'nl-BE' : locale === 'fr' ? 'fr-BE' : locale;
	return new Intl.DateTimeFormat(loc, { timeZone: TIME_ZONE, ...(opts ?? { day: 'numeric', month: 'short', year: 'numeric' }) }).format(
		typeof d === 'string' ? new Date(d) : d
	);
}

export function formatDateTime(d: Date | string, locale: Locale | 'nl' | 'fr' = 'nl-BE') {
	return formatDate(d, locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
