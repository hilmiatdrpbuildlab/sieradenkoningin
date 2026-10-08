/**
 * Thank-you / payment return page (P2-08). Access: `?t=<accessToken>` (guests) or the owning customer.
 * When the order is still pending (webhook late) the page asks the PROVIDER for the payment status
 * on every load; the client re-loads it a few times (polling) until it settles.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';
import {
	canViewOrder,
	estimateDelivery,
	findOrderByNumber,
	retryPayment,
	syncPayment
} from '#lib/server/services/orders.ts';
import { InsufficientStockError } from '#lib/server/services/inventory-reservations.ts';
import { getSettings } from '#lib/server/services/settings.ts';
import { PAYMENT_METHODS } from '#lib/server/adapters/payments.ts';
import { tr } from '#lib/i18n/index.ts';

const NUMBER_RE = /^SK-\d{4}-\d{6}$/;

async function access(locals: App.Locals, number: string, token: string | null) {
	if (!NUMBER_RE.test(number)) error(404, 'Not found');
	const found = await findOrderByNumber(locals.db, number);
	if (!found || !canViewOrder(found.order, token, locals.customer?.id)) error(404, 'Not found');
	return found;
}

export const load: PageServerLoad = async ({ locals, params, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const lang = params.lang;
	const token = url.searchParams.get('t');
	let found = await access(locals, params.number, token);
	if (found.order.status === 'pending' && found.payment && found.payment.status === 'open') {
		try {
			const r = await syncPayment(
				{ db: locals.db, payments: locals.payments, email: locals.email, siteUrl: PUBLIC_SITE_URL },
				found.payment.providerRef
			);
			if (r.outcome !== 'noop' && r.outcome !== 'unknown') found = await access(locals, params.number, token);
		} catch (err) {
			console.error('[thanks] payment sync failed', err);
		}
	}
	const { order, lines } = found;
	const s = await getSettings(locals.db, ['shipping', 'payments']);
	const state =
		order.paymentStatus === 'paid' || order.status === 'paid'
			? 'paid'
			: order.status === 'pending'
				? 'pending'
				: 'failed';
	return {
		order: {
			number: order.number,
			email: order.email,
			state,
			paymentStatus: order.paymentStatus,
			placedAt: order.placedAt.toISOString(),
			deliveryEstimate: estimateDelivery(order.paidAt ?? order.placedAt, s.shipping).toISOString(),
			shippingMethod: order.shippingMethod,
			shippingAddress: order.shippingAddress,
			servicePoint: order.servicePoint,
			giftWrap: order.giftWrap,
			giftMessage: order.giftMessage,
			discountCode: order.discountCode,
			paymentMethod: order.paymentMethod,
			totals: {
				subtotal: order.subtotal,
				discount: order.discountTotal,
				shipping: order.shippingTotal,
				total: order.total,
				vat: order.vatTotal
			}
		},
		lines: lines.map((l) => ({
			name: tr(l.name, lang),
			variantLabel: tr(l.variantLabel, lang),
			qty: l.qty,
			lineTotal: l.lineTotal,
			imageKey: l.imageKey,
			giftWrap: l.giftWrap
		})),
		paymentMethods: s.payments.methods.filter((x) => (PAYMENT_METHODS as readonly string[]).includes(x)),
		guest: !locals.customer,
		token: token && canViewOrder(order, token, null) ? token : null,
		noAlternates: true
	};
};

export const actions: Actions = {
	/** Retry a failed / cancelled / expired payment with a new provider payment. */
	retry: async ({ locals, params, url, request }) => {
		const { order } = await access(locals, params.number, url.searchParams.get('t'));
		const method = String((await request.formData()).get('paymentMethod') ?? '') || null;
		if (method && !(PAYMENT_METHODS as readonly string[]).includes(method)) return fail(400, { retryError: 'payment' });
		let checkoutUrl: string | null;
		try {
			const r = await retryPayment(
				{ db: locals.db, payments: locals.payments, siteUrl: PUBLIC_SITE_URL },
				order.id,
				method
			);
			checkoutUrl = r?.checkoutUrl ?? null;
		} catch (err) {
			if (err instanceof InsufficientStockError) return fail(409, { retryError: 'stock' });
			console.error('[thanks] retry failed', err);
			return fail(502, { retryError: 'provider' });
		}
		if (!checkoutUrl) return fail(409, { retryError: 'paid' });
		redirect(303, checkoutUrl);
	}
};
