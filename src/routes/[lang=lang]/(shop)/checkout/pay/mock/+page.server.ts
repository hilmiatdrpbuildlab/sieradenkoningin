/**
 * Mock payment page (dev / e2e / previews, P2-06 fallback). Only exists while the MOCK payments
 * adapter is active. The buttons set the simulated provider state (`payments.raw.mock.status`) and
 * then run exactly what the webhook runs (syncPayment → applyPaymentStatus), then return to the
 * stored redirectUrl like Mollie would.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';
import { orders, payments } from '#lib/server/db/schema.ts';
import { syncPayment, thanksPath } from '#lib/server/services/orders.ts';

const STATUSES = ['paid', 'failed', 'canceled', 'expired'] as const;

async function find(locals: App.Locals, id: string | null) {
	if (locals.payments.provider !== 'mock' || !id || !/^mock_[a-z0-9]+$/.test(id)) error(404, 'Not found');
	const [row] = await locals.db
		.select({ payment: payments, number: orders.number, accessToken: orders.accessToken, locale: orders.locale })
		.from(payments)
		.innerJoin(orders, eq(orders.id, payments.orderId))
		.where(eq(payments.providerRef, id));
	if (!row || row.payment.provider !== 'mock') error(404, 'Not found');
	return row;
}

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const row = await find(locals, url.searchParams.get('id'));
	const raw = (row.payment.raw ?? {}) as { mock?: { status?: string } };
	return {
		id: row.payment.providerRef,
		number: row.number,
		amount: row.payment.amount,
		method: row.payment.method,
		status: raw.mock?.status ?? 'open',
		noAlternates: true
	};
};

export const actions: Actions = {
	default: async ({ locals, url, request }) => {
		const row = await find(locals, url.searchParams.get('id'));
		const status = String((await request.formData()).get('status') ?? '');
		if (!(STATUSES as readonly string[]).includes(status)) return fail(400, { error: 'status' });
		const raw = (row.payment.raw ?? {}) as { mock?: { status?: string; refunded?: number }; redirectUrl?: string };
		const mockState = raw.mock?.status ?? 'open';
		// Like a real provider, a payment that reached a final state cannot change any more.
		if (mockState === 'open') {
			await locals.db
				.update(payments)
				.set({ raw: { ...raw, mock: { ...raw.mock, status } } })
				.where(eq(payments.id, row.payment.id));
		}
		await syncPayment(
			{ db: locals.db, payments: locals.payments, email: locals.email, storage: locals.storage, siteUrl: PUBLIC_SITE_URL },
			row.payment.providerRef
		);
		redirect(303, raw.redirectUrl ?? thanksPath(row));
	}
};
