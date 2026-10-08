/**
 * Mollie webhook (P2-06). Mollie POSTs `id=tr_…` (form-encoded). We NEVER trust the body beyond the
 * id: the payment is fetched from the provider and the idempotent state machine applies it.
 * Unknown ids get a 200 without changes (no information leak); a 500 makes Mollie retry later.
 */
import { text } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { RequestHandler } from './$types';
import { syncPayment } from '#lib/server/services/orders.ts';

export const POST: RequestHandler = async ({ request, locals }) => {
	const form = await request.formData().catch(() => null);
	const id = form?.get('id');
	if (typeof id !== 'string' || !id || id.length > 64) return text('ok');
	try {
		await syncPayment({ db: locals.db, payments: locals.payments, email: locals.email, storage: locals.storage, siteUrl: PUBLIC_SITE_URL }, id);
	} catch (err) {
		console.error('[webhook mollie]', err);
		return text('retry', { status: 500 });
	}
	return text('ok');
};
