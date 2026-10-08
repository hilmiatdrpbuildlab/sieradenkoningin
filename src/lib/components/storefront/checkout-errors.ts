/** Maps checkout validation codes (schemas/checkout.ts) and field names to localized copy. */
import { m } from '#lib/paraglide/messages.js';

export function checkoutError(code: string): string {
	switch (code) {
		case 'email':
			return m.checkout_error_email();
		case 'postal':
			return m.checkout_error_postal();
		case 'country':
			return m.checkout_error_country();
		case 'vat':
			return m.checkout_error_vat();
		case 'phone':
			return m.checkout_error_phone();
		case 'too_long':
			return m.checkout_error_too_long();
		case 'terms':
			return m.checkout_error_terms();
		case 'method':
			return m.checkout_error_method();
		case 'payment':
			return m.checkout_error_payment();
		case 'service_point':
			return m.checkout_error_service_point();
		default:
			return m.checkout_error_required();
	}
}

/** Field label used in the error summary ("E-mail: …"). */
export function fieldLabel(field: string): string {
	const labels: Record<string, () => string> = {
		email: m.checkout_email,
		phone: m.checkout_phone,
		firstName: m.checkout_first_name,
		lastName: m.checkout_last_name,
		line1: m.checkout_line1,
		line2: m.checkout_line2,
		postalCode: m.checkout_postal_code,
		city: m.checkout_city,
		country: m.checkout_country,
		shippingMethod: m.checkout_shipping_title,
		servicePointId: m.checkout_pickup_point,
		spPostalCode: m.checkout_pickup_search_label,
		billingFirstName: m.checkout_billing_first_name,
		billingLastName: m.checkout_billing_last_name,
		billingLine1: m.checkout_billing_line1,
		billingLine2: m.checkout_billing_line2,
		billingPostalCode: m.checkout_billing_postal_code,
		billingCity: m.checkout_billing_city,
		billingCountry: m.checkout_billing_country,
		company: m.checkout_company,
		vatNumber: m.checkout_vat_number,
		giftMessage: m.checkout_gift_message,
		paymentMethod: m.checkout_payment_title,
		terms: m.checkout_terms_label
	};
	return (labels[field] ?? m.checkout_error_field)();
}

/** DOM id of a checkout field (the error summary links to it). */
export const fieldId = (field: string) => `co-${field}`;
