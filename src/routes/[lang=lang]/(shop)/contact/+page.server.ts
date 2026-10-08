/**
 * Contact page (P4-02). Action `send`: zod validation → Turnstile → rate limit (5/hour per IP) →
 * email to SHOP_INBOX (reply-to = customer) + email_log. The GET page stays cacheable.
 */
import { fail } from '@sveltejs/kit';
import * as env from '$app/env/private';
import type { Actions, PageServerLoad } from './$types';
import { getSetting } from '#lib/server/services/settings.ts';
import { CONTACT_LIMIT, contactSchema, sendContactMessage } from '#lib/server/services/contact.ts';
import { verifyTurnstile } from '#lib/server/adapters/turnstile.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const store = await getSetting(locals.db, 'store');
	setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' });
	return { store: { email: store.email, phone: store.phone }, alternates: { nl: '/nl/contact', fr: '/fr/contact' } };
};

export const actions: Actions = {
	send: async ({ request, locals, params }) => {
		const lang = params.lang;
		const form = await request.formData();
		const raw = Object.fromEntries([...form.entries()].filter(([k]) => k !== 'cf-turnstile-response')) as Record<
			string,
			string
		>;
		const parsed = contactSchema(lang).safeParse(raw);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values: raw });

		if (!(await verifyTurnstile(env.TURNSTILE_SECRET, form.get('cf-turnstile-response'), locals.ip))) {
			return fail(400, { errors: { _: [m.contact_err_captcha({}, { locale: lang })] }, values: raw });
		}
		const limit = await rateLimit(locals.db, `contact:${locals.ip}`, CONTACT_LIMIT.max, CONTACT_LIMIT.windowSec);
		if (!limit.allowed) return fail(429, { errors: {}, rate: true, values: raw });

		const ok = await sendContactMessage(locals.db, locals.email, env.SHOP_INBOX, parsed.data, lang);
		if (!ok) return fail(500, { errors: {}, values: raw });
		return { sent: true };
	}
};
