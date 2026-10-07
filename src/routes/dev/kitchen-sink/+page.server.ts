import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageServerLoad } from './$types';
import { emptyCart } from '#lib/server/services/cart.ts';

/** Dev-only component gallery (P0-02 / P0-11). Never available in production builds. */
export const load: PageServerLoad = async () => {
	if (!dev && process.env.KITCHEN_SINK !== '1') error(404);
	return { cart: emptyCart() };
};
