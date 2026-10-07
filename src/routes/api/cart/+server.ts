/**
 * /api/cart (P2-01) — GET view · POST add {variantId, qty, giftWrap?} · PATCH {lineId, qty?, giftWrap?}
 * · DELETE {lineId} or ?code to remove the discount · PUT {code} to apply a discount code.
 * Every response is the full, server-computed CartView (prices never come from the client).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addToCartSchema, discountCodeSchema, updateLineSchema } from '#lib/schemas/cart.ts';
import { addToCart, findCart, getOrCreateCart, loadCart, setDiscountCode, setLineGiftWrap, setLineQty } from '#lib/server/services/cart.ts';
import { evaluateDiscount, lookupDiscount, normalizeCode } from '#lib/server/services/discounts.ts';
import { isLang } from '#lib/i18n/paths.ts';

const noStore = { 'cache-control': 'private, no-store' };

function langOf(url: URL, fallback: 'nl' | 'fr') {
	const l = url.searchParams.get('lang');
	return isLang(l) ? l : fallback;
}

export const GET: RequestHandler = async ({ locals, cookies, url }) => {
	const cart = await findCart(locals.db, cookies);
	return json(await loadCart(locals.db, cart?.id ?? null, langOf(url, locals.lang), { email: locals.customer?.email }), { headers: noStore });
};

export const POST: RequestHandler = async ({ locals, cookies, request, url }) => {
	const parsed = addToCartSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ error: 'invalid' }, { status: 400 });
	const lang = langOf(url, locals.lang);
	const cart = await getOrCreateCart(locals.db, cookies, lang, locals.customer?.id);
	const r = await addToCart(locals.db, cart.id, parsed.data);
	const view = await loadCart(locals.db, cart.id, lang, { email: locals.customer?.email });
	if (!r.ok) return json({ ...view, error: r.error }, { status: 409, headers: noStore });
	return json({ ...view, capped: r.capped, addedVariantId: parsed.data.variantId }, { headers: noStore });
};

export const PATCH: RequestHandler = async ({ locals, cookies, request, url }) => {
	const parsed = updateLineSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ error: 'invalid' }, { status: 400 });
	const cart = await findCart(locals.db, cookies);
	if (!cart) return json({ error: 'not_found' }, { status: 404 });
	if (parsed.data.qty !== undefined) await setLineQty(locals.db, cart.id, parsed.data.lineId, parsed.data.qty);
	if (parsed.data.giftWrap !== undefined) await setLineGiftWrap(locals.db, cart.id, parsed.data.lineId, parsed.data.giftWrap);
	return json(await loadCart(locals.db, cart.id, langOf(url, locals.lang), { email: locals.customer?.email }), { headers: noStore });
};

/** Apply a discount code (max one per cart; replaces the previous one). */
export const PUT: RequestHandler = async ({ locals, cookies, request, url }) => {
	const parsed = discountCodeSchema.safeParse(await request.json().catch(() => null));
	const lang = langOf(url, locals.lang);
	const cart = await getOrCreateCart(locals.db, cookies, lang, locals.customer?.id);
	if (!parsed.success) return json({ ...(await loadCart(locals.db, cart.id, lang)), codeError: 'not_found' }, { status: 400 });
	const code = normalizeCode(parsed.data.code);
	const before = await loadCart(locals.db, cart.id, lang, { email: locals.customer?.email });
	const { discount, totalUses, customerUses } = await lookupDiscount(locals.db, code, locals.customer?.email);
	const r = evaluateDiscount(discount, { subtotal: before.subtotal, totalUses, customerUses });
	if (!r.ok) return json({ ...before, codeError: r.reason, minSubtotal: r.minSubtotal ?? null }, { status: 422, headers: noStore });
	await setDiscountCode(locals.db, cart.id, code);
	return json(await loadCart(locals.db, cart.id, lang, { email: locals.customer?.email }), { headers: noStore });
};

export const DELETE: RequestHandler = async ({ locals, cookies, request, url }) => {
	const cart = await findCart(locals.db, cookies);
	const lang = langOf(url, locals.lang);
	if (!cart) return json(await loadCart(locals.db, null, lang));
	if (url.searchParams.has('code')) {
		await setDiscountCode(locals.db, cart.id, null);
	} else {
		const body = (await request.json().catch(() => null)) as { lineId?: string } | null;
		if (body?.lineId) await setLineQty(locals.db, cart.id, body.lineId, 0);
	}
	return json(await loadCart(locals.db, cart.id, lang, { email: locals.customer?.email }), { headers: noStore });
};
