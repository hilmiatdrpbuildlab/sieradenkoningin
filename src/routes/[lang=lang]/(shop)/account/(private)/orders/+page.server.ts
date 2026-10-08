/** Account: order history (P3-02). Guest orders with the verified email are linked at login. */
import type { PageServerLoad } from './$types';
import { listCustomerOrders } from '#lib/server/services/account.ts';

export const load: PageServerLoad = async ({ locals }) => {
	return { orders: await listCustomerOrders(locals.db, locals.customer!.id, { limit: 100 }) };
};
