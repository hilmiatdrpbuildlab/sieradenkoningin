/**
 * Checkout (P2-04). One page, one form action. Works without JavaScript up to the payment redirect:
 * the pickup-point search has its own action (`?/servicePoints`) that re-renders the page with the
 * entered values. Everything is validated (zod) and recomputed on the server.
 */
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { PUBLIC_SITE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';
import { findCart, loadCart } from '#lib/server/services/cart.ts';
import { buildQuote, placeOrder } from '#lib/server/services/checkout.ts';
import { getSettings } from '#lib/server/services/settings.ts';
import { PAYMENT_METHODS } from '#lib/server/adapters/payments.ts';
import { pages } from '#lib/server/db/schema.ts';
import { validateCheckout, formValues } from '#lib/schemas/checkout.ts';
import { localizeHref, type Lang } from '#lib/i18n/paths.ts';
import { intlLocale } from '#lib/i18n/index.ts';

const NO_STORE = { 'cache-control': 'private, no-store' };

async function shopOptions(locals: App.Locals, lang: Lang) {
	const s = await getSettings(locals.db, ['shipping', 'payments']);
	const countries = s.shipping.shipToCountries.length ? s.shipping.shipToCountries : ['BE'];
	// Bancontact first (Belgium), then the configured order; only methods the adapter knows.
	const enabled = s.payments.methods.filter((x) => (PAYMENT_METHODS as readonly string[]).includes(x));
	const paymentMethods = [...enabled].sort((a, b) => (a === 'bancontact' ? -1 : b === 'bancontact' ? 1 : 0));
	const names = new Intl.DisplayNames([intlLocale(lang)], { type: 'region' });
	return {
		countries,
		countryOptions: countries.map((c) => ({ value: c, label: names.of(c) ?? c })),
		paymentMethods,
		shipping: s.shipping
	};
}

export const load: PageServerLoad = async ({ locals, cookies, params, setHeaders }) => {
	setHeaders(NO_STORE);
	const lang = params.lang;
	const db = locals.db;
	const existing = await findCart(db, cookies);
	const cart = await loadCart(db, existing?.id ?? null, lang, { email: locals.customer?.email });
	if (!existing || !cart.lines.length) redirect(303, localizeHref('/cart', lang));

	const opts = await shopOptions(locals, lang);
	const [home, pickup, [terms]] = await Promise.all([
		buildQuote(db, { cartId: existing.id, email: locals.customer?.email, country: opts.countries[0], method: 'home' }),
		buildQuote(db, {
			cartId: existing.id,
			email: locals.customer?.email,
			country: opts.countries[0],
			method: 'pickup'
		}),
		db.select({ slugs: pages.slugs }).from(pages).where(eq(pages.key, 'terms'))
	]);
	const summary = (q: typeof home) => ({ ...q.totals, available: q.shippingAvailable });
	return {
		cart,
		quotes: { home: summary(home), pickup: summary(pickup) },
		discountCode: home.discountCode,
		countryOptions: opts.countryOptions,
		paymentMethods: opts.paymentMethods,
		termsHref: `/${lang}/${terms?.slugs[lang] ?? (lang === 'fr' ? 'conditions' : 'voorwaarden')}`,
		prefill: {
			email: locals.customer?.email ?? '',
			firstName: locals.customer?.firstName ?? '',
			lastName: locals.customer?.lastName ?? ''
		},
		loggedIn: !!locals.customer,
		alternates: { nl: localizeHref('/checkout', 'nl'), fr: localizeHref('/checkout', 'fr') }
	};
};

const entries = (f: FormData) =>
	Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;

export const actions: Actions = {
	/** No-JS pickup-point search: re-render with the points for the entered postal code. */
	servicePoints: async ({ request, locals }) => {
		const input = entries(await request.formData());
		const postal = (input.spPostalCode || input.postalCode || '').trim();
		const values = { ...formValues(input), shippingMethod: 'pickup', spPostalCode: postal };
		if (!/^[A-Za-z0-9 -]{4,10}$/.test(postal))
			return fail(400, { values, points: [], errors: { spPostalCode: ['postal'] } });
		const points = await locals.shipping.servicePoints(postal, (input.country || 'BE').toUpperCase()).catch(() => []);
		return { values, points, searched: true };
	},

	place: async ({ request, locals, cookies, params }) => {
		const lang = params.lang;
		const input = entries(await request.formData());
		const values = formValues(input);
		const opts = await shopOptions(locals, lang);
		const v = validateCheckout(input, { countries: opts.countries, paymentMethods: opts.paymentMethods });
		if (!v.ok) return fail(400, { values, errors: v.errors });

		const cart = await findCart(locals.db, cookies);
		if (!cart) redirect(303, localizeHref('/cart', lang));
		const r = await placeOrder(
			{ db: locals.db, payments: locals.payments, shipping: locals.shipping, siteUrl: PUBLIC_SITE_URL },
			{ cartId: cart.id, lang, customerId: locals.customer?.id ?? null, data: v.data }
		);
		if (r.ok) redirect(303, r.checkoutUrl);
		if (r.error === 'empty') redirect(303, localizeHref('/cart', lang));
		switch (r.error) {
			case 'stock':
				return fail(409, {
					values,
					formError: 'stock',
					shortages: r.shortages.map((s) => ({ name: s.name, available: s.available }))
				});
			case 'unavailable':
				return fail(409, { values, formError: 'unavailable' });
			case 'discount':
				return fail(409, { values, formError: 'discount', discountReason: r.reason });
			case 'service_point':
				return fail(400, { values, errors: { servicePointId: ['service_point'] } });
			case 'shipping':
				return fail(409, { values, formError: 'shipping' });
			default:
				return fail(502, { values, formError: 'payment' });
		}
	}
};
