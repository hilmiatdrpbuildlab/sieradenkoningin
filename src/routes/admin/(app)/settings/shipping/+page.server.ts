import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { shippingRates, shippingZones } from '#lib/server/db/schema.ts';
import { getSettings, setSetting } from '#lib/server/services/settings.ts';
import { audit } from '#lib/server/services/audit.ts';
import { euroToCents, fieldErrors } from '#lib/schemas/common.ts';

const General = z.object({
	freeFrom: euroToCents.pipe(z.number({ message: 'Bedrag is verplicht' }).int().min(0)),
	cutoffHour: z.coerce.number().int().min(0).max(23),
	deliveryDays: z.coerce.number().int().min(1).max(10)
});

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings');
	const [{ shipping }, zones, rates] = await Promise.all([
		getSettings(locals.db, ['shipping']),
		locals.db.select().from(shippingZones).orderBy(asc(shippingZones.name)),
		locals.db.select().from(shippingRates)
	]);
	return {
		shipping,
		zones: zones.map((z) => ({ ...z, rates: rates.filter((r) => r.zoneId === z.id).sort((a, b) => a.method.localeCompare(b.method)) })),
		crumbs: [{ label: 'Instellingen', href: '/admin/settings' }, { label: 'Verzending' }]
	};
};

/** Ship-to countries = countries of active zones (decision D3: BE only until NL/LU are enabled). */
async function syncShipTo(db: App.Locals['db']) {
	const zones = await db.select().from(shippingZones).where(eq(shippingZones.active, true));
	const { shipping } = await getSettings(db, ['shipping']);
	await setSetting(db, 'shipping', { ...shipping, shipToCountries: [...new Set(zones.flatMap((z) => z.countries))].sort() });
}

export const actions: Actions = {
	general: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const raw = Object.fromEntries(await request.formData());
		const parsed = General.safeParse(raw);
		if (!parsed.success) return fail(400, { form: 'general', errors: fieldErrors(parsed.error) });
		const { shipping } = await getSettings(locals.db, ['shipping']);
		const next = { ...shipping, ...parsed.data };
		await setSetting(locals.db, 'shipping', next);
		await audit(locals.db, locals, { action: 'update', entity: 'settings', entityId: 'shipping', diff: { before: shipping, after: next } });
		return { form: 'general', saved: true };
	},
	rate: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const fd = await request.formData();
		const id = String(fd.get('id'));
		const price = euroToCents.safeParse(String(fd.get('price') ?? ''));
		const freeFrom = euroToCents.safeParse(String(fd.get('freeFrom') ?? ''));
		if (!price.success || price.data === undefined || !freeFrom.success) return fail(400, { form: id, error: 'Ongeldig bedrag' });
		const values = { price: price.data, freeFrom: freeFrom.data ?? null, active: fd.get('active') === 'on', carrier: String(fd.get('carrier') || 'bpost').slice(0, 40) };
		const [before] = await locals.db.select().from(shippingRates).where(eq(shippingRates.id, id));
		if (!before) return fail(404, { form: id, error: 'Tarief niet gevonden' });
		await locals.db.update(shippingRates).set(values).where(eq(shippingRates.id, id));
		await audit(locals.db, locals, { action: 'update', entity: 'shipping_rate', entityId: id, diff: { before: { price: before.price, freeFrom: before.freeFrom, active: before.active }, after: values } });
		return { form: id, saved: true };
	},
	zone: async ({ request, locals }) => {
		requirePermission(locals, 'settings');
		const id = String((await request.formData()).get('id'));
		const [z] = await locals.db.select().from(shippingZones).where(eq(shippingZones.id, id));
		if (!z) return fail(404, { form: id, error: 'Zone niet gevonden' });
		await locals.db.update(shippingZones).set({ active: !z.active }).where(eq(shippingZones.id, id));
		await syncShipTo(locals.db);
		await audit(locals.db, locals, { action: z.active ? 'deactivate' : 'activate', entity: 'shipping_zone', entityId: id, diff: { countries: z.countries } });
		return { form: id, saved: true };
	}
};
