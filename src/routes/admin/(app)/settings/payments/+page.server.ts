import type { Actions, PageServerLoad } from './$types';
import * as env from '$app/env/private';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { getSettings, setSetting } from '#lib/server/services/settings.ts';
import { audit } from '#lib/server/services/audit.ts';
import { PAYMENT_METHODS } from '#lib/server/adapters/payments.ts';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings');
	const { payments } = await getSettings(locals.db, ['payments']);
	const key = env.MOLLIE_API_KEY;
	return {
		methods: payments.methods,
		all: PAYMENT_METHODS,
		mode: !key ? 'mock' : key.startsWith('live_') ? 'live' : 'test',
		crumbs: [{ label: 'Instellingen', href: '/admin/settings' }, { label: 'Betalingen' }]
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const fd = await request.formData();
		// Keep the canonical order (Bancontact first for Belgium) regardless of checkbox order.
		const methods = PAYMENT_METHODS.filter((m) => fd.getAll('methods').includes(m));
		const before = (await getSettings(locals.db, ['payments'])).payments;
		await setSetting(locals.db, 'payments', { methods });
		await audit(locals.db, locals, { action: 'update', entity: 'settings', entityId: 'payments', diff: { methods: [before.methods, methods] } });
		return { saved: true };
	}
};
