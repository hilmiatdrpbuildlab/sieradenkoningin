/**
 * Forgot password (P3-01): Turnstile + rate limits; a reset link is mailed only when an account
 * exists, but the visitor always sees the same confirmation.
 */
import { fail } from '@sveltejs/kit';
import * as env from '$app/env/private';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';
import { forgotSchema } from '#lib/schemas/account.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';
import { verifyTurnstile } from '#lib/server/adapters/turnstile.ts';
import { AUTH_LIMITS, authLink, findCustomerByEmail, issueToken, sendAccountEmail } from '#lib/server/services/customer-auth.ts';

export const load: PageServerLoad = async ({ url }) => ({ expired: url.searchParams.has('expired') });

export const actions: Actions = {
	default: async ({ request, locals, params, url }) => {
		const lang = params.lang;
		const form = await request.formData();
		const values = { email: String(form.get('email') ?? '') };
		const parsed = forgotSchema.safeParse(values);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });
		if (!(await verifyTurnstile(env.TURNSTILE_SECRET, form.get('cf-turnstile-response'), locals.ip))) {
			return fail(400, { error: 'captcha' as const, values });
		}
		const lim = AUTH_LIMITS.forgot;
		if (!(await rateLimit(locals.db, `forgot:ip:${locals.ip}`, lim.ip.max, lim.ip.windowSec)).allowed) {
			return fail(429, { error: 'rate' as const, values });
		}
		const byEmail = await rateLimit(locals.db, `forgot:email:${parsed.data.email}`, lim.email.max, lim.email.windowSec);
		const customer = byEmail.allowed ? await findCustomerByEmail(locals.db, parsed.data.email) : null;
		if (customer) {
			const siteUrl = PUBLIC_SITE_URL || url.origin;
			const token = await issueToken(locals.db, customer.email, 'reset');
			await sendAccountEmail(locals, {
				to: customer.email,
				kind: 'reset',
				lang,
				siteUrl,
				firstName: customer.firstName,
				url: authLink(siteUrl, lang, 'reset', token)
			});
		}
		return { sent: true, email: parsed.data.email };
	}
};
