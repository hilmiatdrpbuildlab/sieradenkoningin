import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as env from '$app/env/private';
import { completeLogin, pendingAdmin, safeNext, verifySecondFactor } from '#lib/server/auth/admin.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';
import { audit } from '#lib/server/services/audit.ts';

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	const pending = await pendingAdmin(locals.db, cookies);
	if (!pending) redirect(303, '/admin/login');
	if (!pending.user.totpEnabledAt) redirect(303, `/admin/login/enrol?next=${encodeURIComponent(safeNext(url.searchParams.get('next')))}`);
	if (pending.session.twoFactorVerified) redirect(303, safeNext(url.searchParams.get('next')));
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		if (!env.TOTP_ENC_KEY) error(500, 'TOTP_ENC_KEY ontbreekt in de serverconfiguratie.');
		const pending = await pendingAdmin(locals.db, cookies);
		if (!pending) redirect(303, '/admin/login');
		const limit = await rateLimit(locals.db, `admin-2fa:${pending.user.id}`, 5, 15 * 60);
		if (!limit.allowed) return fail(429, { error: 'Te veel pogingen. Probeer het over 15 minuten opnieuw.' });
		const code = String((await request.formData()).get('code') ?? '');
		const how = await verifySecondFactor(locals.db, pending.user, code, env.TOTP_ENC_KEY);
		if (!how) return fail(400, { error: 'Deze code klopt niet.' });
		await completeLogin(locals.db, pending.session.id, pending.user.id);
		await audit(locals.db, { admin: { id: pending.user.id, name: pending.user.name, email: pending.user.email, role: pending.user.role, sessionId: pending.session.id }, ip: locals.ip }, { action: how === 'recovery' ? 'login_recovery_code' : 'login', entity: 'admin_user', entityId: pending.user.id });
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
