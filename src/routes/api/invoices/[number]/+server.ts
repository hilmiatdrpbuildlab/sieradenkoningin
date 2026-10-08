/**
 * Invoice PDF download (P3-03): GET /api/invoices/<invoice number | order number>[?t=<access token>]
 * Allowed for: an admin with `orders:read`, the logged-in customer who owns the order, or a guest
 * presenting the order's access token. Anything else gets the same 404 (no information leak).
 * The PDF lives in private storage (`invoices/…`); when the queued job has not produced it yet it
 * is generated on the fly.
 */
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { orders } from '#lib/server/db/schema.ts';
import { can } from '#lib/permissions.ts';
import { canViewOrder } from '#lib/server/services/orders.ts';
import { generateInvoice } from '#lib/server/services/invoices.ts';

const NUMBER = /^SK-(INV-)?\d{4}-\d{6}$/;

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const number = params.number.replace(/\.pdf$/i, '');
	if (!NUMBER.test(number)) error(404, 'Not found');
	const col = number.startsWith('SK-INV-') ? orders.invoiceNumber : orders.number;
	const [order] = await locals.db
		.select({
			id: orders.id,
			accessToken: orders.accessToken,
			customerId: orders.customerId,
			invoiceNumber: orders.invoiceNumber,
			invoiceKey: orders.invoiceKey
		})
		.from(orders)
		.where(eq(col, number));
	const allowed =
		!!order &&
		((locals.admin && can(locals.admin.role, 'orders:read')) ||
			canViewOrder(order, url.searchParams.get('t'), locals.customer?.id));
	if (!order || !allowed || !order.invoiceNumber) error(404, 'Not found');

	let pdf = order.invoiceKey ? (await locals.storage.get(order.invoiceKey))?.body : undefined;
	if (!pdf) pdf = (await generateInvoice({ db: locals.db, storage: locals.storage }, order.id)).pdf;

	return new Response(new Blob([new Uint8Array(pdf)]), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `${url.searchParams.has('inline') ? 'inline' : 'attachment'}; filename="${order.invoiceNumber}.pdf"`,
			'cache-control': 'private, no-store',
			'x-content-type-options': 'nosniff',
			'x-robots-tag': 'noindex'
		}
	});
};
