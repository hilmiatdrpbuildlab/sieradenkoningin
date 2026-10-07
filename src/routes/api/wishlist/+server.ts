/** /api/wishlist — GET product ids · POST { productId, on? } toggles (guest cookie or account). */
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { toggleWishlist, wishlistOwner, wishlistProductIds } from '#lib/server/services/wishlist.ts';

const headers = { 'cache-control': 'private, no-store' };

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const owner = wishlistOwner(cookies, locals.customer?.id);
	return json({ ids: await wishlistProductIds(locals.db, owner) }, { headers });
};

const Body = z.object({ productId: z.string().uuid(), on: z.boolean().optional() });

export const POST: RequestHandler = async ({ locals, cookies, request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ error: 'invalid' }, { status: 400 });
	const owner = wishlistOwner(cookies, locals.customer?.id, true)!;
	try {
		const on = await toggleWishlist(locals.db, owner, parsed.data.productId, parsed.data.on);
		return json({ on }, { headers });
	} catch {
		return json({ error: 'not_found' }, { status: 404 });
	}
};
