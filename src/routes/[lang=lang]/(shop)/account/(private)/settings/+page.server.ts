/**
 * Account settings (P3-02): profile (name, phone, preferred language), password change, newsletter
 * preference (opt-in = double opt-in mail), GDPR export link and irreversible account deletion
 * (dialog + password + explicit confirmation → anonymisation in one transaction → logged out).
 */
import { fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';
import { deleteAccountSchema, passwordChangeSchema, profileSchema } from '#lib/schemas/account.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';
import { createSession, destroyAllSessions } from '#lib/server/auth/session.ts';
import {
	checkCurrentPassword,
	deleteAccount,
	getProfile,
	newsletterOptOut,
	updateProfile
} from '#lib/server/services/account.ts';
import { loginRedirect, logout, setPassword } from '#lib/server/services/customer-auth.ts';
import { subscribe } from '#lib/server/services/newsletter.ts';
import { localizeHref } from '#lib/i18n/paths.ts';

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const profile = await getProfile(locals.db, locals.customer!.id);
	if (!profile) redirect(303, loginRedirect(url, params.lang));
	return { profile, showDelete: url.searchParams.has('delete') };
};

function me(locals: App.Locals, url: URL, lang: 'nl' | 'fr') {
	if (!locals.customer) redirect(303, loginRedirect(url, lang));
	return locals.customer;
}

export const actions: Actions = {
	profile: async ({ request, locals, url, params }) => {
		const c = me(locals, url, params.lang);
		const form = await request.formData();
		const values = {
			firstName: String(form.get('firstName') ?? ''),
			lastName: String(form.get('lastName') ?? ''),
			phone: String(form.get('phone') ?? ''),
			locale: String(form.get('locale') ?? '')
		};
		const parsed = profileSchema.safeParse(values);
		if (!parsed.success) return fail(400, { section: 'profile' as const, errors: fieldErrors(parsed.error), values });
		await updateProfile(locals.db, c.id, parsed.data);
		return { section: 'profile' as const, saved: true };
	},

	password: async ({ request, locals, url, params, cookies }) => {
		const c = me(locals, url, params.lang);
		const form = await request.formData();
		const parsed = passwordChangeSchema.safeParse({
			current: String(form.get('current') ?? ''),
			password: String(form.get('password') ?? ''),
			confirm: String(form.get('confirm') ?? '')
		});
		if (!parsed.success) return fail(400, { section: 'password' as const, errors: fieldErrors(parsed.error) });
		if (!(await rateLimit(locals.db, `pwchange:${c.id}`, 5, 900)).allowed) {
			return fail(429, { section: 'password' as const, error: 'rate' as const });
		}
		if (!(await checkCurrentPassword(locals.db, c.id, parsed.data.current))) {
			return fail(400, { section: 'password' as const, errors: { current: ['wrong_password'] } });
		}
		await setPassword(locals.db, c.id, parsed.data.password);
		// Sign out every other device; this browser gets a fresh session.
		await destroyAllSessions(locals.db, 'customer', c.id);
		await createSession(locals.db, cookies, 'customer', c.id, { ip: locals.ip, ua: request.headers.get('user-agent') ?? undefined });
		return { section: 'password' as const, saved: true };
	},

	newsletter: async ({ request, locals, url, params }) => {
		const c = me(locals, url, params.lang);
		const want = String((await request.formData()).get('subscribe') ?? '') === '1';
		if (want) {
			const r = await subscribe(
				locals.db,
				{ email: locals.email, siteUrl: PUBLIC_SITE_URL || url.origin },
				{ email: c.email, lang: params.lang, source: 'account' }
			);
			if (r === 'failed') return fail(500, { section: 'newsletter' as const, error: 'send' as const });
			return { section: 'newsletter' as const, subscribed: r };
		}
		await newsletterOptOut(locals.db, locals.newsletter, c.id);
		return { section: 'newsletter' as const, unsubscribed: true };
	},

	delete: async ({ request, locals, url, params, cookies }) => {
		const c = me(locals, url, params.lang);
		const form = await request.formData();
		const parsed = deleteAccountSchema.safeParse({
			password: String(form.get('password') ?? ''),
			confirm: form.get('confirm') ?? undefined
		});
		if (!parsed.success) return fail(400, { section: 'delete' as const, errors: fieldErrors(parsed.error) });
		if (!(await rateLimit(locals.db, `delete:${c.id}`, 5, 3600)).allowed) {
			return fail(429, { section: 'delete' as const, error: 'rate' as const });
		}
		const r = await deleteAccount(locals.db, c.id, parsed.data.password);
		if (r === 'wrong_password') return fail(400, { section: 'delete' as const, errors: { password: ['wrong_password'] } });
		await logout(locals.db, cookies);
		redirect(303, `${localizeHref('/account/login', params.lang)}?deleted=1`);
	}
};
