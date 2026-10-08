/**
 * Customer login (P3-01): password (`?/password`) or magic link by email (`?/magic`).
 * One generic error for unknown email / wrong password; the magic-link form always answers
 * "if an account exists, we sent a link". Rate-limited per IP and per email.
 */
import { fail, redirect } from '@sveltejs/kit';
import * as env from '$app/env/private';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';
import { loginSchema, magicSchema } from '#lib/schemas/account.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { rateLimit, resetRateLimit } from '#lib/server/auth/rate-limit.ts';
import { verifyTurnstile } from '#lib/server/adapters/turnstile.ts';
import {
	AUTH_LIMITS,
	authLink,
	checkPasswordLogin,
	completeLogin,
	findCustomerByEmail,
	issueToken,
	safeNext,
	sendAccountEmail
} from '#lib/server/services/customer-auth.ts';
import { localizeHref } from '#lib/i18n/paths.ts';

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (locals.customer) redirect(303, next ?? localizeHref('/account', params.lang));
	return { next, deleted: url.searchParams.has('deleted'), loggedOut: url.searchParams.has('out') };
};

export const actions: Actions = {
	password: async ({ request, locals, params, url, cookies }) => {
		const lang = params.lang;
		const form = await request.formData();
		const values = { email: String(form.get('email') ?? '') };
		const next = safeNext(form.get('next'));
		const parsed = loginSchema.safeParse({ email: values.email, password: String(form.get('password') ?? '') });
		if (!parsed.success) return fail(400, { form: 'password' as const, errors: fieldErrors(parsed.error), values });

		const { ip: ipLimit, email: emailLimit } = AUTH_LIMITS.login;
		const byIp = await rateLimit(locals.db, `login:ip:${locals.ip}`, ipLimit.max, ipLimit.windowSec);
		const emailKey = `login:email:${parsed.data.email}`;
		const byEmail = await rateLimit(locals.db, emailKey, emailLimit.max, emailLimit.windowSec);
		if (!byIp.allowed || !byEmail.allowed) return fail(429, { form: 'password' as const, error: 'rate' as const, values });

		const result = await checkPasswordLogin(locals.db, parsed.data.email, parsed.data.password);
		if (!result.ok && result.reason === 'invalid') return fail(400, { form: 'password' as const, error: 'invalid' as const, values });
		if (!result.ok) {
			// Correct password but unverified email: (re)send the verification link.
			const siteUrl = PUBLIC_SITE_URL || url.origin;
			const token = await issueToken(locals.db, result.customer.email, 'verify');
			await sendAccountEmail(locals, {
				to: result.customer.email,
				kind: 'verify',
				lang,
				siteUrl,
				firstName: result.customer.firstName,
				url: authLink(siteUrl, lang, 'verify', token)
			});
			return fail(403, { form: 'password' as const, error: 'unverified' as const, values });
		}
		await completeLogin({ db: locals.db, cookies, ip: locals.ip, ua: request.headers.get('user-agent') }, result.customer);
		await resetRateLimit(locals.db, emailKey);
		redirect(303, next ?? localizeHref('/account', lang));
	},

	magic: async ({ request, locals, params, url }) => {
		const lang = params.lang;
		const form = await request.formData();
		const values = { email: String(form.get('email') ?? '') };
		const parsed = magicSchema.safeParse(values);
		if (!parsed.success) return fail(400, { form: 'magic' as const, errors: fieldErrors(parsed.error), values });
		if (!(await verifyTurnstile(env.TURNSTILE_SECRET, form.get('cf-turnstile-response'), locals.ip))) {
			return fail(400, { form: 'magic' as const, error: 'captcha' as const, values });
		}
		const lim = AUTH_LIMITS.magic;
		const byIp = await rateLimit(locals.db, `magic:ip:${locals.ip}`, lim.ip.max, lim.ip.windowSec);
		if (!byIp.allowed) return fail(429, { form: 'magic' as const, error: 'rate' as const, values });
		const byEmail = await rateLimit(locals.db, `magic:email:${parsed.data.email}`, lim.email.max, lim.email.windowSec);

		const customer = byEmail.allowed ? await findCustomerByEmail(locals.db, parsed.data.email) : null;
		if (customer) {
			const siteUrl = PUBLIC_SITE_URL || url.origin;
			const token = await issueToken(locals.db, customer.email, 'login');
			await sendAccountEmail(locals, {
				to: customer.email,
				kind: 'login',
				lang,
				siteUrl,
				firstName: customer.firstName,
				url: authLink(siteUrl, lang, 'login', token, safeNext(form.get('next')))
			});
		}
		// Identical answer whether or not the address has an account.
		return { form: 'magic' as const, sent: true, values };
	}
};
