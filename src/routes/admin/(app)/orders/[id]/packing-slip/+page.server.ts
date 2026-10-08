import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { orderLines, orders } from '#lib/server/db/schema.ts';
import { getSettings } from '#lib/server/services/settings.ts';
import { uuid } from '#lib/schemas/order-admin.ts';

/** Printable packing slip (no prices). Rendered outside the admin shell (+page@admin.svelte). */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'orders:read');
	if (!uuid.safeParse(params.id).success) error(404, 'Bestelling niet gevonden');
	const [order] = await locals.db.select().from(orders).where(eq(orders.id, params.id));
	if (!order) error(404, 'Bestelling niet gevonden');
	const lines = await locals.db
		.select()
		.from(orderLines)
		.where(eq(orderLines.orderId, order.id))
		.orderBy(asc(orderLines.sku));
	const { store } = await getSettings(locals.db, ['store']);
	return {
		store,
		order: {
			id: order.id,
			number: order.number,
			placedAt: order.placedAt,
			locale: order.locale,
			email: order.email,
			shippingAddress: order.shippingAddress,
			shippingMethod: order.shippingMethod,
			servicePoint: order.servicePoint,
			giftWrap: order.giftWrap,
			giftMessage: order.giftMessage
		},
		lines: lines.map((l) => ({
			id: l.id,
			sku: l.sku,
			name: (order.locale === 'fr' ? l.name.fr : l.name.nl) || l.name.nl,
			variant: (order.locale === 'fr' ? l.variantLabel?.fr : l.variantLabel?.nl) || l.variantLabel?.nl || '',
			qty: l.qty,
			giftWrap: l.giftWrap,
			engraving: l.engraving
		}))
	};
};
