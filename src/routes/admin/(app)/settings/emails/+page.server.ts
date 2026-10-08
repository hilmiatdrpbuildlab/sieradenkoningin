import { fail } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { getSettings, setSetting } from '#lib/server/services/settings.ts';
import { audit } from '#lib/server/services/audit.ts';
import { emailLog } from '#lib/server/db/schema.ts';
import { checkbox, fieldErrors } from '#lib/schemas/common.ts';

const Schema = z.object({
	replyTo: z.union([z.literal(''), z.string().trim().email('Ongeldig e-mailadres')]),
	bccOrders: checkbox
});

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings');
	const { emails } = await getSettings(locals.db, ['emails']);
	const log = await locals.db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(50);
	return { emails, log, provider: locals.email.provider, crumbs: [{ label: 'Instellingen', href: '/admin/settings' }, { label: 'E-mails' }] };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const raw = Object.fromEntries(await request.formData());
		const parsed = Schema.safeParse(raw);
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values: raw });
		await setSetting(locals.db, 'emails', parsed.data);
		await audit(locals.db, locals, { action: 'update', entity: 'settings', entityId: 'emails', diff: parsed.data });
		return { saved: true };
	}
};
