/**
 * Checkout form schema (P2-04), shared by client and server.
 * Messages are stable error CODES (not copy): the storefront maps them to `m.checkout_error_<code>()`
 * so one schema serves NL and FR.
 */
import { z } from 'zod';
import { checkbox } from './common.ts';

export const GIFT_MESSAGE_MAX = 200;

/** Error codes produced by this schema (→ m.checkout_error_<code>). */
export type CheckoutErrorCode =
	| 'required'
	| 'email'
	| 'postal'
	| 'country'
	| 'vat'
	| 'phone'
	| 'too_long'
	| 'terms'
	| 'method'
	| 'payment'
	| 'service_point';

const CODES = new Set<string>([
	'required',
	'email',
	'postal',
	'country',
	'vat',
	'phone',
	'too_long',
	'terms',
	'method',
	'payment',
	'service_point'
]);

/** Normalises "be 0123.456.749" → "BE0123456749". */
export const normalizeVat = (v: string) => v.replace(/[\s.\-/]/g, '').toUpperCase();

/**
 * Belgian VAT / enterprise number: BE + 10 digits, first digit 0 or 1, and
 * 97 − (first 8 digits mod 97) must equal the last 2 digits.
 */
export function isValidBeVat(input: string): boolean {
	const v = normalizeVat(input);
	const m = /^BE([01]\d{9})$/.exec(v);
	if (!m) return false;
	const digits = m[1];
	const base = Number(digits.slice(0, 8));
	const check = Number(digits.slice(8));
	return 97 - (base % 97) === check;
}

const POSTAL: Record<string, RegExp> = {
	BE: /^[1-9]\d{3}$/,
	NL: /^[1-9]\d{3}\s?[A-Za-z]{2}$/,
	LU: /^(L-)?\d{4}$/i
};
export const isValidPostal = (country: string, code: string) =>
	(POSTAL[country] ?? /^[A-Za-z0-9 -]{3,10}$/).test(code.trim());

const required = (max = 120) => z.string().trim().min(1, 'required').max(max, 'too_long');
const optional = (max = 120) =>
	z
		.string()
		.trim()
		.max(max, 'too_long')
		.optional()
		.transform((v) => v || undefined);

const phone = z
	.string()
	.trim()
	.max(30, 'too_long')
	.optional()
	.transform((v) => v || undefined)
	.refine((v) => !v || /^\+?[\d\s()./-]{6,}$/.test(v), 'phone');

const name = required(60);
/** Checkbox that may be absent from the form data (unchecked boxes are not submitted). */
const flag = checkbox.optional().transform((v) => v === true);

/** Builds the schema for the shop's current settings (ship-to countries, enabled payment methods). */
export function checkoutSchema(opts: CheckoutSchemaOptions) {
	const country = z
		.string()
		.trim()
		.toUpperCase()
		.refine((c) => opts.countries.includes(c), 'country');
	return z.object({
		email: z
			.string()
			.trim()
			.toLowerCase()
			.min(1, 'required')
			.pipe(z.email('email'))
			.pipe(z.string().max(254, 'too_long')),
		phone,
		firstName: name,
		lastName: name,
		line1: required(120),
		line2: optional(120),
		postalCode: required(12),
		city: required(80),
		country,
		shippingMethod: z.enum(['home', 'pickup'], { error: 'method' }),
		servicePointId: optional(40),
		spPostalCode: optional(12),
		billingSame: flag,
		billingFirstName: optional(60),
		billingLastName: optional(60),
		billingLine1: optional(120),
		billingLine2: optional(120),
		billingPostalCode: optional(12),
		billingCity: optional(80),
		billingCountry: optional(2),
		company: optional(120),
		vatNumber: optional(30).refine((v) => !v || isValidBeVat(v), 'vat'),
		giftWrap: flag,
		giftMessage: optional(GIFT_MESSAGE_MAX),
		paymentMethod: z
			.string()
			.trim()
			.refine((p) => opts.paymentMethods.includes(p), 'payment'),
		terms: flag.refine((v) => v, 'terms')
	});
}

export interface CheckoutSchemaOptions {
	countries: string[];
	paymentMethods: string[];
}

export type CheckoutData = z.output<ReturnType<typeof checkoutSchema>>;

export type CheckoutValidation =
	{ ok: true; data: CheckoutData } | { ok: false; errors: Record<string, CheckoutErrorCode[]> };

/**
 * Validates the checkout form in ONE pass: field rules (zod) plus the cross-field rules
 * (postal code per country, pickup point, billing address when it differs) so the customer
 * sees every problem after a single submit.
 */
export function validateCheckout(input: Record<string, unknown>, opts: CheckoutSchemaOptions): CheckoutValidation {
	const errors: Record<string, CheckoutErrorCode[]> = {};
	const add = (path: string, code: CheckoutErrorCode) => {
		const list = (errors[path] ??= []);
		if (!list.includes(code)) list.push(code);
	};
	const parsed = checkoutSchema(opts).safeParse(input);
	if (!parsed.success)
		for (const i of parsed.error.issues)
			add(
				String(i.path[0] ?? '_'),
				CODES.has(i.message) ? (i.message as CheckoutErrorCode) : i.path[0] === 'shippingMethod' ? 'method' : 'required'
			);

	const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
	const country = str('country').toUpperCase();
	if (opts.countries.includes(country) && str('postalCode') && !isValidPostal(country, str('postalCode')))
		add('postalCode', 'postal');
	if (str('shippingMethod') === 'pickup' && !str('servicePointId')) add('servicePointId', 'service_point');
	const billingSame = ['on', 'true', '1'].includes(str('billingSame'));
	if (!billingSame) {
		for (const k of [
			'billingFirstName',
			'billingLastName',
			'billingLine1',
			'billingPostalCode',
			'billingCity'
		] as const)
			if (!str(k)) add(k, 'required');
		const bc = str('billingCountry').toUpperCase();
		if (!opts.countries.includes(bc)) add('billingCountry', 'country');
		else if (str('billingPostalCode') && !isValidPostal(bc, str('billingPostalCode')))
			add('billingPostalCode', 'postal');
	}
	if (Object.keys(errors).length || !parsed.success) return { ok: false, errors };

	const d = parsed.data;
	return {
		ok: true,
		data: {
			...d,
			postalCode: d.postalCode.toUpperCase(),
			vatNumber: d.vatNumber ? normalizeVat(d.vatNumber) : undefined,
			billingCountry: d.billingCountry?.toUpperCase(),
			billingPostalCode: d.billingPostalCode?.toUpperCase()
		}
	};
}

/** The values echoed back into the form after a failed submit (never the terms checkbox). */
export function formValues(input: Record<string, unknown>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(input)) if (typeof v === 'string' && k !== 'terms') out[k] = v.slice(0, 300);
	return out;
}

/** Field order used by the error summary (matches the visual order of the form). */
export const CHECKOUT_FIELD_ORDER = [
	'email',
	'phone',
	'firstName',
	'lastName',
	'line1',
	'line2',
	'postalCode',
	'city',
	'country',
	'shippingMethod',
	'servicePointId',
	'billingFirstName',
	'billingLastName',
	'company',
	'vatNumber',
	'billingLine1',
	'billingLine2',
	'billingPostalCode',
	'billingCity',
	'billingCountry',
	'giftMessage',
	'paymentMethod',
	'terms'
] as const;
