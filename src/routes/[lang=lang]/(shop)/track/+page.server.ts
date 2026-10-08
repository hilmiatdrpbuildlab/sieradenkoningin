/**
 * Public order tracking (P3-04): order number + email → status timeline + tracking link.
 * Turnstile + rate limit. A wrong email and an unknown order number give the IDENTICAL response
 * (same status, same data) — nothing reveals that an order number exists.
 */
import { fail } from '@sveltejs/kit';
import * as env from '$app/env/private';
import type { Actions, PageServerLoad } from './$types';
import { trackSchema } from '#lib/schemas/account.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';
import { verifyTurnstile } from '#lib/server/adapters/turnstile.ts';
import { AUTH_LIMITS } from '#lib/server/services/customer-auth.ts';
import { lookupOrderForTracking } from '#lib/server/services/tracking.ts';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	return { alternates: { nl: '/nl/bestelling-volgen', fr: '/fr/suivi-commande' } };
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		const form = await request.formData();
		const values = { number: String(form.get('number') ?? ''), email: String(form.get('email') ?? '') };
		const parsed = trackSchema.safeParse(values);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values });
		if (!(await verifyTurnstile(env.TURNSTILE_SECRET, form.get('cf-turnstile-response'), locals.ip))) {
			return fail(400, { error: 'captcha' as const, values });
		}
		const lim = AUTH_LIMITS.track.ip;
		if (!(await rateLimit(locals.db, `track:ip:${locals.ip}`, lim.max, lim.windowSec)).allowed) {
			return fail(429, { error: 'rate' as const, values });
		}
		const order = await lookupOrderForTracking(locals.db, parsed.data.number, parsed.data.email, params.lang);
		if (!order) return fail(404, { error: 'not_found' as const, values });
		return { order };
	}
};
