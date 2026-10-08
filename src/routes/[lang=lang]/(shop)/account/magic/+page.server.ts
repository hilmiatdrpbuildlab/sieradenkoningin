/**
 * Magic-link login (P3-01). Consuming the mailed token also proves ownership of the email, so the
 * account is marked verified (and guest orders get linked by completeLogin).
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	completeLogin,
	consumeToken,
	findCustomerByEmail,
	markVerified,
	peekToken,
	safeNext
} from '#lib/server/services/customer-auth.ts';
import { localizeHref } from '#lib/i18n/paths.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const token = url.searchParams.get('token') ?? '';
	return {
		token,
		next: safeNext(url.searchParams.get('next')),
		valid: !!(await peekToken(locals.db, token, 'login')),
		noAlternates: true
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const email = await consumeToken(locals.db, form.get('token'), 'login');
		const customer = email ? await findCustomerByEmail(locals.db, email) : null;
		if (!customer) return fail(400, { expired: true });
		const verified = await markVerified(locals.db, customer);
		await completeLogin({ db: locals.db, cookies, ip: locals.ip, ua: request.headers.get('user-agent') }, verified);
		redirect(303, safeNext(form.get('next')) ?? localizeHref('/account', params.lang));
	}
};
