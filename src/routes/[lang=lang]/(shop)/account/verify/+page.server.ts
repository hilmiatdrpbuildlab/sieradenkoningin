/**
 * Email verification (P3-01). The mailed link opens this page; the button POSTs the token, which is
 * consumed once, marks the email verified and logs the customer in (guest orders get linked).
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { completeLogin, consumeToken, findCustomerByEmail, markVerified, peekToken } from '#lib/server/services/customer-auth.ts';
import { localizeHref } from '#lib/i18n/paths.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const token = url.searchParams.get('token') ?? '';
	return { token, valid: !!(await peekToken(locals.db, token, 'verify')), noAlternates: true };
};

export const actions: Actions = {
	default: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const email = await consumeToken(locals.db, form.get('token'), 'verify');
		const customer = email ? await findCustomerByEmail(locals.db, email) : null;
		if (!customer) return fail(400, { expired: true });
		const verified = await markVerified(locals.db, customer);
		await completeLogin({ db: locals.db, cookies, ip: locals.ip, ua: request.headers.get('user-agent') }, verified);
		redirect(303, `${localizeHref('/account', params.lang)}?notice=verified`);
	}
};
