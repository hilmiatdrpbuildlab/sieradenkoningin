/**
 * Newsletter signup (P4-06). Action `subscribe` (posted by NewsletterForm with `email` + `source`):
 * pending row + double opt-in email. Without JS the result renders on this page.
 */
import { fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';
import { emailSchema } from '#lib/schemas/common.ts';
import { subscribe } from '#lib/server/services/newsletter.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' });
	return { alternates: { nl: '/nl/newsletter', fr: '/fr/newsletter' } };
};

export const actions: Actions = {
	subscribe: async ({ request, locals, params, url }) => {
		const form = await request.formData();
		const email = emailSchema.safeParse(String(form.get('email') ?? ''));
		if (!email.success) return fail(400, { reason: 'invalid' as const });
		const limit = await rateLimit(locals.db, `newsletter:${locals.ip}`, 10, 3600);
		if (!limit.allowed) return fail(429, { reason: 'rate' as const });
		const result = await subscribe(
			locals.db,
			{ email: locals.email, siteUrl: PUBLIC_SITE_URL || url.origin },
			{ email: email.data, lang: params.lang, source: String(form.get('source') ?? '') }
		);
		if (result === 'failed') return fail(500, { reason: 'error' as const });
		return { ok: true };
	}
};
