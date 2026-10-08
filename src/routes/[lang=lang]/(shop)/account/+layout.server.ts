/**
 * Every account page (auth screens included) is personal: never cached, never indexed.
 * Only this layout sets the headers (a page setting them too would throw "header already set").
 */
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	return {};
};
