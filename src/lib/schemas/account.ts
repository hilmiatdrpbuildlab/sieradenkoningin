/**
 * Customer account schemas (P3-01 / P3-02 / P3-04 / P3-09), shared by client and server.
 * Messages are message KEYS resolved by the route (`authError()`), so the schemas stay locale-free.
 */
import { z } from 'zod';
import { checkbox } from './common.ts';

/** Same policy as `PASSWORD_MIN` in server/auth/password.ts (kept in sync by tests/unit/customer-auth.test.ts). */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export const accountEmail = z
	.string()
	.trim()
	.toLowerCase()
	.min(1, 'required')
	.pipe(z.email('email'))
	.pipe(z.string().max(254, 'email'));

export const newPassword = z.string().min(PASSWORD_MIN_LENGTH, 'password_short').max(PASSWORD_MAX_LENGTH, 'password_long');

const name = z.string().trim().min(1, 'required').max(80, 'too_long');
const optionalText = (max: number) => z.string().trim().max(max, 'too_long').optional().default('');

export const loginSchema = z.object({
	email: accountEmail,
	password: z.string().min(1, 'required').max(PASSWORD_MAX_LENGTH, 'password_long')
});

export const magicSchema = z.object({ email: accountEmail });
export const forgotSchema = magicSchema;

export const registerSchema = z.object({
	firstName: name,
	lastName: name,
	email: accountEmail,
	password: newPassword,
	newsletter: checkbox
});

export const resetSchema = z
	.object({ password: newPassword, confirm: z.string() })
	.refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'password_mismatch' });

export const profileSchema = z.object({
	firstName: name,
	lastName: name,
	phone: z
		.string()
		.trim()
		.max(30, 'too_long')
		.regex(/^[+0-9 ()./-]*$/, 'phone')
		.optional()
		.default(''),
	locale: z.enum(['nl', 'fr'])
});

export const passwordChangeSchema = z
	.object({ current: z.string().min(1, 'required').max(PASSWORD_MAX_LENGTH), password: newPassword, confirm: z.string() })
	.refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'password_mismatch' });

export const deleteAccountSchema = z.object({
	password: z.string().min(1, 'required').max(PASSWORD_MAX_LENGTH),
	confirm: z.literal('on', 'confirm_delete')
});

/** Shipping countries supported by the address book (zones table supports NL/LU later, D3). */
export const ADDRESS_COUNTRIES = ['BE', 'NL', 'LU'] as const;

export const addressSchema = z.object({
	id: z.uuid().optional().or(z.literal('').transform(() => undefined)),
	name: z.string().trim().min(1, 'required').max(120, 'too_long'),
	company: optionalText(120),
	line1: z.string().trim().min(1, 'required').max(160, 'too_long'),
	line2: optionalText(160),
	postalCode: z
		.string()
		.trim()
		.min(1, 'required')
		.max(10, 'too_long')
		.regex(/^[A-Za-z0-9 -]+$/, 'postal'),
	city: z.string().trim().min(1, 'required').max(80, 'too_long'),
	country: z.enum(ADDRESS_COUNTRIES, 'required'),
	phone: z
		.string()
		.trim()
		.max(30, 'too_long')
		.regex(/^[+0-9 ()./-]*$/, 'phone')
		.optional()
		.default(''),
	isDefault: checkbox
});

/** Order numbers look like SK-2026-000123 (lower case and spaces are tolerated in the form). */
export const ORDER_NUMBER_RE = /^SK-\d{4}-\d{6}$/;

export const trackSchema = z.object({
	number: z
		.string()
		.trim()
		.toUpperCase()
		.transform((v) => v.replace(/\s+/g, ''))
		.pipe(z.string().min(1, 'required').regex(ORDER_NUMBER_RE, 'order_number')),
	email: accountEmail
});

export const stockAlertSchema = z.object({
	email: accountEmail,
	variantId: z.uuid('required'),
	locale: z.enum(['nl', 'fr']).catch('nl')
});

export type AuthErrorKey =
	| 'required'
	| 'email'
	| 'password_short'
	| 'password_long'
	| 'password_mismatch'
	| 'too_long'
	| 'phone'
	| 'postal'
	| 'order_number'
	| 'confirm_delete';
