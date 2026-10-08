/**
 * Registration (P3-01): zod → Turnstile → rate limit → account (unverified) + verification email.
 * When the email already has an account, that owner gets an "you already have an account" email
 * instead — the visitor sees the same "check your inbox" page in both cases.
 * Newsletter opt-in goes through the normal double opt-in (services/newsletter.ts).
 */
import { fail, redirect } from '@sveltejs/kit';
import * as env from '$app/env/private';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';
import { registerSchema } from '#lib/schemas/account.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';
import { verifyTurnstile } from '#lib/server/adapters/turnstile.ts';
import {
	AUTH_LIMITS,
	authLink,
	issueToken,
	registerCustomer,
	safeNext,
	sendAccountEmail
} from '#lib/server/services/customer-auth.ts';
import { subscribe } from '#lib/server/services/newsletter.ts';
import { localizeHref } from '#lib/i18n/paths.ts';

export const load: PageServerLoad = async ({ locals, url, params }) => {
	if (locals.customer) redirect(303, localizeHref('/account', params.lang));
	return { next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
	default: async ({ request, locals, params, url }) => {
		const lang = params.lang;
		const form = await request.formData();
		const values = {
			firstName: String(form.get('firstName') ?? ''),
			lastName: String(form.get('lastName') ?? ''),
			email: String(form.get('email') ?? ''),
			newsletter: form.get('newsletter') === 'on'
		};
		const parsed = registerSchema.safeParse({
			...values,
			newsletter: form.get('newsletter') ?? undefined,
			password: String(form.get('password') ?? '')
		});
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });
		if (!(await verifyTurnstile(env.TURNSTILE_SECRET, form.get('cf-turnstile-response'), locals.ip))) {
			return fail(400, { error: 'captcha' as const, values });
		}
		const lim = AUTH_LIMITS.register.ip;
		if (!(await rateLimit(locals.db, `register:ip:${locals.ip}`, lim.max, lim.windowSec)).allowed) {
			return fail(429, { error: 'rate' as const, values });
		}

		const d = parsed.data;
		const siteUrl = PUBLIC_SITE_URL || url.origin;
		const outcome = await registerCustomer(locals.db, { ...d, locale: lang });
		if (outcome.kind === 'created') {
			const token = await issueToken(locals.db, d.email, 'verify');
			await sendAccountEmail(locals, {
				to: d.email,
				kind: 'verify',
				lang,
				siteUrl,
				firstName: d.firstName,
				url: authLink(siteUrl, lang, 'verify', token)
			});
		} else {
			const site = siteUrl.replace(/\/$/, '');
			await sendAccountEmail(locals, {
				to: outcome.customer.email,
				kind: 'exists',
				lang,
				siteUrl,
				firstName: outcome.customer.firstName,
				url: `${site}${localizeHref('/account/login', lang)}`,
				secondaryUrl: `${site}${localizeHref('/account/forgot', lang)}`
			});
		}
		if (d.newsletter) {
			await subscribe(locals.db, { email: locals.email, siteUrl }, { email: d.email, lang, source: 'register' }).catch((e) =>
				console.error('[register] newsletter', e)
			);
		}
		return { registered: true, email: d.email };
	}
};
