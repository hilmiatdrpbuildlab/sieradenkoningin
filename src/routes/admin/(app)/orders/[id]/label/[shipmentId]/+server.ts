/** Shipping label PDF of one shipment (private storage → streamed to the admin). */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { shipmentLabel } from '#lib/server/services/fulfilment.ts';
import { uuid } from '#lib/schemas/order-admin.ts';

export const GET: RequestHandler = async ({ locals, params }) => {
	requirePermission(locals, 'orders:read');
	if (!uuid.safeParse(params.id).success || !uuid.safeParse(params.shipmentId).success) error(404);
	const s = await shipmentLabel(locals.db, params.id, params.shipmentId);
	if (!s?.labelKey) error(404, 'Label niet gevonden');
	const obj = await locals.storage.get(s.labelKey);
	if (!obj) error(404, 'Label niet gevonden');
	return new Response(new Blob([new Uint8Array(obj.body)]), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="label-${s.trackingNumber ?? s.id}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
