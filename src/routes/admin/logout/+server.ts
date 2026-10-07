import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/services/audit.ts';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (locals.admin) await audit(locals.db, locals, { action: 'logout', entity: 'admin_user', entityId: locals.admin.id });
	await destroySession(locals.db, cookies, 'admin');
	redirect(303, '/admin/login');
};
