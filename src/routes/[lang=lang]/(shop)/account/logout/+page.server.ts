/** Logout (P3-01): POST only (a GET link could be triggered cross-site); GET bounces to the account. */
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logout } from '#lib/server/services/customer-auth.ts';
import { localizeHref } from '#lib/i18n/paths.ts';

export const load: PageServerLoad = async ({ params }) => {
	redirect(303, localizeHref('/account', params.lang));
};

export const actions: Actions = {
	default: async ({ locals, cookies, params }) => {
		await logout(locals.db, cookies);
		redirect(303, `${localizeHref('/account/login', params.lang)}?out=1`);
	}
};
