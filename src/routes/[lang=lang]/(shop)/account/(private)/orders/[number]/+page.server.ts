/** Account: order detail (P3-02) — status timeline, tracking, lines, addresses, invoice link. */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { customerOrderDetail } from '#lib/server/services/account.ts';
import { ORDER_NUMBER_RE } from '#lib/schemas/account.ts';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!ORDER_NUMBER_RE.test(params.number)) error(404, 'Not found');
	const order = await customerOrderDetail(locals.db, locals.customer!.id, params.number, params.lang);
	if (!order) error(404, 'Not found');
	return { order };
};
