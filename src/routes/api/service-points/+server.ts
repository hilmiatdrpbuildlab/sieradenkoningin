/** GET /api/service-points?postalCode=1000&country=BE → pickup points for the checkout picker (P2-04). */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSetting } from '#lib/server/services/settings.ts';

export const GET: RequestHandler = async ({ url, locals }) => {
	const postalCode = (url.searchParams.get('postalCode') ?? '').trim();
	const country = (url.searchParams.get('country') ?? 'BE').trim().toUpperCase();
	const allowed = (await getSetting(locals.db, 'shipping')).shipToCountries;
	if (!/^[A-Za-z0-9 -]{4,10}$/.test(postalCode) || !allowed.includes(country)) {
		return json({ points: [], error: 'invalid' }, { status: 400, headers: { 'cache-control': 'no-store' } });
	}
	try {
		const points = await locals.shipping.servicePoints(postalCode, country);
		return json({ points }, { headers: { 'cache-control': 'private, max-age=300' } });
	} catch (err) {
		console.error('[service-points]', err);
		return json({ points: [], error: 'unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } });
	}
};
