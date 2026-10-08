/**
 * Cart page (P2-02) — same server-computed CartView as the drawer, rendered server-side so it works
 * without JavaScript (form actions below); with JS the page drives the shared cart store instead.
 */
import { fail } from '@sveltejs/kit';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import {
	findCart,
	getOrCreateCart,
	loadCart,
	setDiscountCode,
	setLineGiftWrap,
	setLineQty
} from '#lib/server/services/cart.ts';
import { evaluateDiscount, lookupDiscount, normalizeCode } from '#lib/server/services/discounts.ts';
import { cardsByIds, cardsWhere, toCard } from '#lib/server/services/catalog.ts';
import { getSetting } from '#lib/server/services/settings.ts';
import { productRelations, products } from '#lib/server/db/schema.ts';
import { picture } from '#lib/utils/media.ts';

const NO_STORE = { 'cache-control': 'private, no-store' };

export const load: PageServerLoad = async ({ locals, cookies, params, setHeaders }) => {
	setHeaders(NO_STORE);
	const lang = params.lang;
	const db = locals.db;
	const existing = await findCart(db, cookies);
	const [cart, payments] = await Promise.all([
		loadCart(db, existing?.id ?? null, lang, { email: locals.customer?.email }),
		getSetting(db, 'payments')
	]);

	// Upsell: "complete the set" relations of what's in the cart, topped up with featured pieces.
	const inCart = [...new Set(cart.lines.map((l) => l.productId))];
	const related = inCart.length
		? await db
				.select({ id: productRelations.relatedId })
				.from(productRelations)
				.where(and(inArray(productRelations.productId, inCart), notInArray(productRelations.relatedId, inCart)))
				.orderBy(productRelations.kind, productRelations.position)
				.limit(8)
		: [];
	let rows = await cardsByIds(db, [...new Set(related.map((r) => r.id))]);
	if (rows.length < 4) {
		const exclude = [...inCart, ...rows.map((r) => r.id)];
		rows = [
			...rows,
			...(await cardsWhere(
				db,
				exclude.length
					? and(eq(products.featured, true), notInArray(products.id, exclude))
					: eq(products.featured, true),
				{ limit: 8 - rows.length }
			))
		];
	}
	return {
		cart,
		upsell: rows.map((r) => toCard(r, lang, picture)),
		paymentMethods: payments.methods
	};
};

async function cartOf(locals: App.Locals, cookies: import('@sveltejs/kit').Cookies) {
	return findCart(locals.db, cookies);
}

export const actions: Actions = {
	qty: async ({ request, locals, cookies }) => {
		const f = await request.formData();
		const cart = await cartOf(locals, cookies);
		const lineId = String(f.get('lineId') ?? '');
		const qty = Number(f.get('qty'));
		if (!cart || !/^[0-9a-f-]{36}$/.test(lineId) || !Number.isInteger(qty) || qty < 0 || qty > 10)
			return fail(400, { action: 'qty' });
		await setLineQty(locals.db, cart.id, lineId, qty);
		return { action: 'qty' };
	},
	remove: async ({ request, locals, cookies }) => {
		const f = await request.formData();
		const cart = await cartOf(locals, cookies);
		const lineId = String(f.get('lineId') ?? '');
		if (!cart || !/^[0-9a-f-]{36}$/.test(lineId)) return fail(400, { action: 'remove' });
		await setLineQty(locals.db, cart.id, lineId, 0);
		return { action: 'remove' };
	},
	gift: async ({ request, locals, cookies }) => {
		const f = await request.formData();
		const cart = await cartOf(locals, cookies);
		const lineId = String(f.get('lineId') ?? '');
		if (!cart || !/^[0-9a-f-]{36}$/.test(lineId)) return fail(400, { action: 'gift' });
		await setLineGiftWrap(locals.db, cart.id, lineId, f.get('giftWrap') === 'on' || f.get('giftWrap') === 'true');
		return { action: 'gift' };
	},
	code: async ({ request, locals, cookies, params }) => {
		const f = await request.formData();
		const raw = String(f.get('code') ?? '').trim();
		if (raw.length < 2 || raw.length > 40)
			return fail(400, { action: 'code', codeError: 'not_found', minSubtotal: null });
		const cart = await getOrCreateCart(locals.db, cookies, params.lang, locals.customer?.id);
		const view = await loadCart(locals.db, cart.id, params.lang, { email: locals.customer?.email });
		const code = normalizeCode(raw);
		const { discount, totalUses, customerUses } = await lookupDiscount(locals.db, code, locals.customer?.email);
		const r = evaluateDiscount(discount, { subtotal: view.subtotal, totalUses, customerUses });
		if (!r.ok) return fail(422, { action: 'code', codeError: r.reason, minSubtotal: r.minSubtotal ?? null });
		await setDiscountCode(locals.db, cart.id, code);
		return { action: 'code' };
	},
	removeCode: async ({ locals, cookies }) => {
		const cart = await cartOf(locals, cookies);
		if (cart) await setDiscountCode(locals.db, cart.id, null);
		return { action: 'removeCode' };
	}
};
