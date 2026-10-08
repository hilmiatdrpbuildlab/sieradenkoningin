/** Account area guard (P3-02): not logged in → localized login with ?next=. Actions check again. */
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { loginRedirect } from '#lib/server/services/customer-auth.ts';

export const load: LayoutServerLoad = async ({ locals, url, params }) => {
	if (!locals.customer) redirect(303, loginRedirect(url, params.lang));
	return { me: { firstName: locals.customer.firstName, email: locals.customer.email } };
};
