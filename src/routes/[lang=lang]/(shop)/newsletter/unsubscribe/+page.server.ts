/**
 * Newsletter unsubscribe (P4-06): GET shows a confirmation button (link scanners must not
 * unsubscribe anyone), POST performs it and tells the provider.
 */
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { tokenIsKnown, unsubscribeByToken } from '#lib/server/services/newsletter.ts';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const token = url.searchParams.get('token') ?? '';
	return { token, valid: await tokenIsKnown(locals.db, token), noAlternates: true };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const token = String((await request.formData()).get('token') ?? '');
		const result = await unsubscribeByToken(locals.db, locals.newsletter, token);
		if (!result.ok) return fail(400, { invalid: true });
		return { done: true };
	}
};
