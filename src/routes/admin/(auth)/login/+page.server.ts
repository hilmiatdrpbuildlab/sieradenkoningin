import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { adminUsers } from '#lib/server/db/schema.ts';
import { verifyPassword } from '#lib/server/auth/password.ts';
import { createSession, destroySession } from '#lib/server/auth/session.ts';
import { rateLimit, resetRateLimit } from '#lib/server/auth/rate-limit.ts';
import { LOGIN_LIMIT, safeNext } from '#lib/server/auth/admin.ts';
import { audit } from '#lib/server/services/audit.ts';

const Login = z.object({ email: z.string().trim().toLowerCase().email('Vul een geldig e-mailadres in'), password: z.string().min(1, 'Vul je wachtwoord in') });

// Defence against user enumeration by timing: unknown emails still pay for one Argon2id verify.
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$egDQwXJVhCUMY8rua4chIA$liQoVDCC5WAhqWF+kdH2tuaeDXgAP1YyMyfonbNQLyY';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.admin) redirect(303, safeNext(url.searchParams.get('next')));
	return { next: url.searchParams.get('next') ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		const form = Object.fromEntries(await request.formData());
		const parsed = Login.safeParse(form);
		if (!parsed.success) return fail(400, { email: String(form.email ?? ''), error: parsed.error.issues[0].message });
		const { email, password } = parsed.data;

		const key = `admin-login:${locals.ip}:${email}`;
		const limit = await rateLimit(locals.db, key, LOGIN_LIMIT.attempts, LOGIN_LIMIT.windowSec);
		if (!limit.allowed) {
			const minutes = Math.ceil((limit.resetAt.getTime() - Date.now()) / 60000);
			return fail(429, { email, error: `Te veel pogingen. Probeer het over ${minutes} minuten opnieuw.` });
		}

		const [user] = await locals.db.select().from(adminUsers).where(eq(adminUsers.email, email));
		const ok = user?.active && user.passwordHash ? await verifyPassword(user.passwordHash, password) : (await verifyPassword(DUMMY_HASH, password), false);
		if (!ok || !user) return fail(400, { email, error: 'E-mailadres of wachtwoord klopt niet.' });

		await resetRateLimit(locals.db, key);
		await destroySession(locals.db, cookies, 'admin');
		await createSession(locals.db, cookies, 'admin', user.id, { ip: locals.ip, ua: request.headers.get('user-agent') ?? undefined });
		await audit(locals.db, { admin: { id: user.id, name: user.name, email: user.email, role: user.role, sessionId: '' }, ip: locals.ip }, { action: 'login_password', entity: 'admin_user', entityId: user.id });

		const next = encodeURIComponent(safeNext(url.searchParams.get('next')));
		redirect(303, user.totpEnabledAt ? `/admin/login/2fa?next=${next}` : `/admin/login/enrol?next=${next}`);
	}
};
