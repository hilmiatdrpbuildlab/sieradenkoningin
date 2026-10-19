/** Data passed to order email templates (pre-formatted on the server; templates only lay it out). */
export interface OrderEmailData {
	number: string;
	firstName: string;
	placedAt: string;
	lines: { name: string; variantLabel: string; qty: number; lineTotalFormatted: string }[];
	subtotalFormatted: string;
	discountFormatted: string | null;
	discountCode: string | null;
	shippingFormatted: string | null;
	totalFormatted: string;
	vatFormatted: string;
	shippingMethod: 'home' | 'pickup';
	shippingAddress: {
		name: string;
		company?: string;
		line1: string;
		line2?: string;
		postalCode: string;
		city: string;
		country: string;
	};
	servicePoint: { name: string; street: string; postalCode: string; city: string } | null;
	giftWrap: boolean;
	giftMessage: string | null;
	deliveryEstimate: string;
	orderUrl: string;
	shopUrl: string;
	storeName: string;
	storeEmail: string | null;
	returnDays: number;
	/** order_shipped (P3-05). */
	tracking?: { number: string | null; url: string | null; carrier: string } | null;
	/** refund_issued (P3-06). */
	refund?: { amountFormatted: string; full: boolean } | null;
}

/**
 * Brand colours for email templates ONLY. Email clients cannot resolve CSS custom properties, so the
 * values of src/lib/styles/tokens.css are repeated here as hex (the one place hex is allowed).
 */
export const EMAIL_COLORS = {
	ivory: '#f8f2ea', // --sk-ivory
	surface: '#fcf9f5', // --sk-ivory-50
	burgundy: '#4b0e19', // --sk-burgundy
	espresso: '#211613', // --sk-espresso
	mocha: '#6e5a50', // --sk-mocha
	border: '#e8d5bc', // --sk-champagne
	gold: '#c5a16c', // --sk-gold
	danger: '#9b2c2c' // --sk-danger
} as const;
