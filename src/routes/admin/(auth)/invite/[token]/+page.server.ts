/** Invite acceptance (P3-10): set a password, then continue to mandatory 2FA enrolment. */
import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { adminUsers } from '#lib/server/db/schema.ts';
import { findInvite } from '#lib/server/services/admin-users.ts';
import { hashPassword, PASSWORD_MIN } from '#lib/server/auth/password.ts';
import { createSession, destroySession } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/services/audit.ts';

const Schema = z
	.object({ password: z.string().min(PASSWORD_MIN, `Minstens ${PASSWORD_MIN} tekens`).max(200), confirm: z.string() })
	.refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'De wachtwoorden komen niet overeen' });

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = await findInvite(locals.db, params.token);
	if (!user) error(404, 'Deze uitnodiging is ongeldig of verlopen. Vraag een nieuwe uitnodiging aan.');
	return { name: user.name, email: user.email };
};

export const actions: Actions = {
	default: async ({ params, locals, request, cookies }) => {
		const user = await findInvite(locals.db, params.token);
		if (!user) error(404, 'Deze uitnodiging is ongeldig of verlopen.');
		const parsed = Schema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		await locals.db
			.update(adminUsers)
			.set({ passwordHash: await hashPassword(parsed.data.password), inviteTokenHash: null, inviteExpiresAt: null, updatedAt: new Date() })
			.where(eq(adminUsers.id, user.id));
		await destroySession(locals.db, cookies, 'admin');
		await createSession(locals.db, cookies, 'admin', user.id, { ip: locals.ip, ua: request.headers.get('user-agent') ?? undefined });
		await audit(locals.db, { admin: { id: user.id, name: user.name, email: user.email, role: user.role, sessionId: '' }, ip: locals.ip }, { action: 'accept_invite', entity: 'admin_user', entityId: user.id });
		redirect(303, '/admin/login/enrol');
	}
};
