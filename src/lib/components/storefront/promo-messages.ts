/** Localized message for a discount failure reason (cart page, checkout). */
import { formatPrice } from '#lib/utils/format.ts';
import { m } from '#lib/paraglide/messages.js';

export function promoMessage(
	reason: string | null | undefined,
	minSubtotal: number | null | undefined,
	lang: 'nl' | 'fr'
): string {
	switch (reason) {
		case 'inactive':
			return m.cart_promo_inactive();
		case 'not_started':
			return m.cart_promo_not_started();
		case 'expired':
			return m.cart_promo_expired();
		case 'min_subtotal':
			return m.cart_promo_min_subtotal({ amount: formatPrice(minSubtotal ?? 0, lang) });
		case 'usage_limit':
			return m.cart_promo_usage_limit();
		case 'customer_limit':
			return m.cart_promo_customer_limit();
		default:
			return m.cart_promo_not_found();
	}
}
