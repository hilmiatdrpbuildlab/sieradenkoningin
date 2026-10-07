/**
 * Mandatory TOTP enrolment on first login (P0-09). A fresh secret is generated, stored encrypted,
 * and only activated once the admin proves possession with a valid code. Recovery codes are shown once.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import type { Actions, PageServerLoad } from './$types';
import * as env from '$app/env/private';
import { adminUsers } from '#lib/server/db/schema.ts';
import { generateRecoveryCodes, generateTotpSecret, otpauthUrl, verifyTotp } from '#lib/server/auth/totp.ts';
import { completeLogin, pendingAdmin, readTotpSecret, safeNext, storeTotpSecret } from '#lib/server/auth/admin.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';
import { audit } from '#lib/server/services/audit.ts';

function requireKey() {
	if (!env.TOTP_ENC_KEY) error(500, 'TOTP_ENC_KEY ontbreekt in de serverconfiguratie.');
	return env.TOTP_ENC_KEY;
}

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	const pending = await pendingAdmin(locals.db, cookies);
	if (!pending) redirect(303, '/admin/login');
	// Just enrolled in this request (form action ran first): let the page show the recovery codes.
	if (pending.user.totpEnabledAt && pending.session.twoFactorVerified) return { done: true as const, next: safeNext(url.searchParams.get('next')) };
	if (pending.user.totpEnabledAt) redirect(303, `/admin/login/2fa?next=${encodeURIComponent(safeNext(url.searchParams.get('next')))}`);
	const key = requireKey();
	let secret = await readTotpSecret(pending.user.totpSecret, key);
	if (!secret) {
		secret = generateTotpSecret();
		await storeTotpSecret(locals.db, pending.user.id, secret, key);
	}
	const uri = otpauthUrl(secret, pending.user.email);
	const qr = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
	return { done: false as const, qr, secret: secret.replace(/(.{4})/g, '$1 ').trim(), email: pending.user.email, next: url.searchParams.get('next') ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const pending = await pendingAdmin(locals.db, cookies);
		if (!pending) redirect(303, '/admin/login');
		const limit = await rateLimit(locals.db, `admin-2fa:${pending.user.id}`, 10, 15 * 60);
		if (!limit.allowed) return fail(429, { error: 'Te veel pogingen. Probeer het later opnieuw.' });
		const code = String((await request.formData()).get('code') ?? '');
		const secret = await readTotpSecret(pending.user.totpSecret, requireKey());
		if (!secret || !(await verifyTotp(secret, code))) return fail(400, { error: 'Deze code klopt niet. Controleer de tijd op je toestel en probeer opnieuw.' });

		const { plain, hashes } = await generateRecoveryCodes();
		await locals.db.update(adminUsers).set({ totpEnabledAt: new Date(), recoveryCodes: hashes }).where(eq(adminUsers.id, pending.user.id));
		await completeLogin(locals.db, pending.session.id, pending.user.id);
		await audit(locals.db, { admin: { id: pending.user.id, name: pending.user.name, email: pending.user.email, role: pending.user.role, sessionId: pending.session.id }, ip: locals.ip }, { action: 'totp_enrolled', entity: 'admin_user', entityId: pending.user.id });
		return { recoveryCodes: plain };
	}
};
