/**
 * Reset password (P3-01). GET only checks the token (never consumes it, so link scanners can't burn
 * it); POST consumes it atomically, sets the password, ends every other session and logs in.
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resetSchema } from '#lib/schemas/account.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { destroyAllSessions } from '#lib/server/auth/session.ts';
import {
	completeLogin,
	consumeToken,
	findCustomerByEmail,
	markVerified,
	peekToken,
	setPassword
} from '#lib/server/services/customer-auth.ts';
import { localizeHref } from '#lib/i18n/paths.ts';

export const load: PageServerLoad = async ({ locals, params }) => {
	return { valid: !!(await peekToken(locals.db, params.token, 'reset')), noAlternates: true };
};

export const actions: Actions = {
	default: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const parsed = resetSchema.safeParse({ password: String(form.get('password') ?? ''), confirm: String(form.get('confirm') ?? '') });
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		const email = await consumeToken(locals.db, params.token, 'reset');
		const customer = email ? await findCustomerByEmail(locals.db, email) : null;
		if (!customer) return fail(400, { expired: true });
		await setPassword(locals.db, customer.id, parsed.data.password);
		await destroyAllSessions(locals.db, 'customer', customer.id);
		const verified = await markVerified(locals.db, customer);
		await completeLogin({ db: locals.db, cookies, ip: locals.ip, ua: request.headers.get('user-agent') }, verified);
		redirect(303, `${localizeHref('/account', params.lang)}?notice=password`);
	}
};
