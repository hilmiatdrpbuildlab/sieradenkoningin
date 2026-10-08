/**
 * `/nl/verlanglijst` · `/fr/liste-de-souhaits` (P1-10) — the visitor's own list (guest cookie `sk_wl`
 * or account) or, with `?share=<token>`, a read-only shared list. Personal → never cached.
 */
import type { Actions, PageServerLoad } from './$types';
import { cardsByIds, toCard } from '#lib/server/services/catalog.ts';
import { ownerFromShare, shareToken, wishlistOwner, wishlistProductIds } from '#lib/server/services/wishlist.ts';
import { localizeHref } from '#lib/i18n/paths.ts';
import { picture } from '#lib/utils/media.ts';

export const load: PageServerLoad = async ({ params, locals, cookies, url, setHeaders }) => {
	const { lang } = params;
	setHeaders({ 'cache-control': 'private, no-store' });
	const token = url.searchParams.get('share');
	const owner = token
		? await ownerFromShare(locals.db, token.slice(0, 64))
		: wishlistOwner(cookies, locals.customer?.id);
	const ids = owner ? await wishlistProductIds(locals.db, owner) : [];
	const rows = await cardsByIds(locals.db, ids);
	return {
		shared: !!token,
		invalidShare: !!token && !owner,
		loggedIn: !!locals.customer,
		products: rows.map((r) => toCard(r, lang, (key, alt) => picture(key, alt, 800))),
		noAlternates: !!token
	};
};

export const actions: Actions = {
	/** Create (or reuse) the read-only share token and return the public link. */
	share: async ({ locals, cookies, params, url }) => {
		const owner = wishlistOwner(cookies, locals.customer?.id, true)!;
		const token = await shareToken(locals.db, owner);
		return { shareUrl: `${url.origin}${localizeHref('/wishlist', params.lang)}?share=${token}` };
	}
};
