/** Account overview (P3-02): recent orders, default address, quick links. */
import type { PageServerLoad } from './$types';
import { countCustomerOrders, getProfile, listAddresses, listCustomerOrders } from '#lib/server/services/account.ts';

const NOTICES = ['verified', 'password'] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	const id = locals.customer!.id;
	const [orders, count, addresses, profile] = await Promise.all([
		listCustomerOrders(locals.db, id, { limit: 3 }),
		countCustomerOrders(locals.db, id),
		listAddresses(locals.db, id),
		getProfile(locals.db, id)
	]);
	const n = url.searchParams.get('notice');
	return {
		orders,
		orderCount: count,
		defaultAddress: addresses.find((a) => a.isDefault) ?? null,
		addressCount: addresses.length,
		newsletter: profile?.newsletter ?? 'none',
		notice: (NOTICES as readonly string[]).includes(n ?? '') ? (n as (typeof NOTICES)[number]) : null
	};
};
