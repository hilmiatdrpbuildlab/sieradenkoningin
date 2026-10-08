/**
 * Back-in-stock subscription (P3-09). POST form-data { email, variantId, locale, return,
 * cf-turnstile-response }. With `accept: application/json` (BackInStockForm with JS) it answers JSON;
 * a plain form post (no JS) is redirected back to the product page with `?alert=<result>`.
 */
import { json, redirect } from '@sveltejs/kit';
import * as env from '$app/env/private';
import type { RequestHandler } from './$types';
import { stockAlertSchema } from '#lib/schemas/account.ts';
import { rateLimit } from '#lib/server/auth/rate-limit.ts';
import { verifyTurnstile } from '#lib/server/adapters/turnstile.ts';
import { STOCK_ALERT_LIMIT, subscribeStockAlert } from '#lib/server/services/stock-alerts.ts';
import { safeNext } from '#lib/server/services/customer-auth.ts';

type Result = 'ok' | 'in_stock' | 'invalid' | 'captcha' | 'rate' | 'not_found';
const STATUS: Record<Result, number> = { ok: 200, in_stock: 409, invalid: 400, captcha: 400, rate: 429, not_found: 404 };

export const POST: RequestHandler = async ({ request, locals }) => {
	const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ result: 'invalid' }, { status: 400 });
	}
	const back = safeNext(form.get('return'));

	const respond = (result: Result) => {
		if (wantsJson || !back) return json({ result }, { status: STATUS[result], headers: { 'cache-control': 'no-store' } });
		const u = new URL(back, 'http://x');
		u.searchParams.set('alert', result);
		redirect(303, u.pathname + u.search);
	};

	const parsed = stockAlertSchema.safeParse({
		email: String(form.get('email') ?? ''),
		variantId: String(form.get('variantId') ?? ''),
		locale: String(form.get('locale') ?? '')
	});
	if (!parsed.success) return respond('invalid');
	if (!(await verifyTurnstile(env.TURNSTILE_SECRET, form.get('cf-turnstile-response'), locals.ip))) return respond('captcha');
	if (!(await rateLimit(locals.db, `stockalert:ip:${locals.ip}`, STOCK_ALERT_LIMIT.max, STOCK_ALERT_LIMIT.windowSec)).allowed) {
		return respond('rate');
	}
	return respond(await subscribeStockAlert(locals.db, parsed.data));
};
