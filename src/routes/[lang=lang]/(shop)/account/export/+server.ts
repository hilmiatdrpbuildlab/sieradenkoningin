/**
 * GDPR export (P3-02, Art. 15/20): the logged-in customer's data as a JSON download
 * (profile, addresses, orders with lines, wishlist, newsletter status).
 */
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportCustomerData } from '#lib/server/services/customers.ts';
import { loginRedirect } from '#lib/server/services/customer-auth.ts';

export const GET: RequestHandler = async ({ locals, url, params }) => {
	if (!locals.customer) redirect(303, loginRedirect(url, params.lang));
	const data = await exportCustomerData(locals.db, locals.customer.id);
	if (!data) error(404, 'Not found');
	const day = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="sieradenkoningin-data-${day}.json"`,
			'cache-control': 'private, no-store',
			'x-robots-tag': 'noindex'
		}
	});
};
