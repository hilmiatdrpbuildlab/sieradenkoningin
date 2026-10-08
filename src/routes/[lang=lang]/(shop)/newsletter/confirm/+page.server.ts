/** Double opt-in confirmation (P4-06): /nl/nieuwsbrief/bevestigen?token=… → confirmed + provider sync. */
import type { PageServerLoad } from './$types';
import { confirmSubscription } from '#lib/server/services/newsletter.ts';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const result = await confirmSubscription(locals.db, locals.newsletter, url.searchParams.get('token'));
	return { ok: result.ok, noAlternates: true };
};
