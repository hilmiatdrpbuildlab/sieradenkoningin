import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { getSettings, setSetting } from '#lib/server/services/settings.ts';
import { audit, diffObjects } from '#lib/server/services/audit.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { generalSettingsSchema, storeSettingsSchema } from '#lib/schemas/settings.ts';
import { randomToken } from '#lib/server/crypto.ts';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings');
	const s = await getSettings(locals.db, ['store', 'return_days', 'maintenance']);
	return { ...s, crumbs: [{ label: 'Instellingen', href: '/admin/settings' }, { label: 'Winkel' }] };
};

export const actions: Actions = {
	store: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const raw = Object.fromEntries(await request.formData());
		const parsed = storeSettingsSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { form: 'store', errors: fieldErrors(parsed.error), values: raw });
		const before = (await getSettings(locals.db, ['store'])).store;
		await setSetting(locals.db, 'store', parsed.data);
		await audit(locals.db, locals, { action: 'update', entity: 'settings', entityId: 'store', diff: diffObjects(before as never, parsed.data) });
		return { form: 'store', saved: true };
	},
	general: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const raw = Object.fromEntries(await request.formData());
		const parsed = generalSettingsSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { form: 'general', errors: fieldErrors(parsed.error), values: raw });
		const f = parsed.data;
		const { maintenance: before, return_days } = await getSettings(locals.db, ['maintenance', 'return_days']);
		const maintenance = {
			enabled: f.maintenanceEnabled,
			message: f.maintenanceNl || f.maintenanceFr ? { nl: f.maintenanceNl, fr: f.maintenanceFr } : undefined,
			bypassToken: before.bypassToken ?? randomToken(12)
		};
		await setSetting(locals.db, 'return_days', f.returnDays);
		await setSetting(locals.db, 'maintenance', maintenance);
		await audit(locals.db, locals, {
			action: 'update',
			entity: 'settings',
			entityId: 'general',
			diff: { return_days: [return_days, f.returnDays], maintenance: [before.enabled, maintenance.enabled] }
		});
		return { form: 'general', saved: true };
	},
	rotateBypass: async ({ locals }) => {
		requirePermission(locals, 'settings');
		const { maintenance } = await getSettings(locals.db, ['maintenance']);
		await setSetting(locals.db, 'maintenance', { ...maintenance, bypassToken: randomToken(12) });
		await audit(locals.db, locals, { action: 'rotate_bypass_token', entity: 'settings', entityId: 'maintenance' });
		return { form: 'general', saved: true };
	}
};
