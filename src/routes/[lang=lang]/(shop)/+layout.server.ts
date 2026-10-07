/**
 * Shop layout data — PUBLIC data only (announcement, navigation, footer menus), so storefront HTML
 * can be cached at the edge. Visitor-specific state (cart, wishlist, account) is fetched client-side
 * after hydration from /api/cart and /api/wishlist.
 */
import type { LayoutServerLoad } from './$types';
import { getSettings, isWithinWindow } from '#lib/server/services/settings.ts';
import { getMenus, menuLinks } from '#lib/server/services/content.ts';
import { categoryNav } from '#lib/server/services/catalog.ts';
import { tr } from '#lib/i18n/index.ts';
import { emptyCart } from '#lib/server/services/cart.ts';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const lang = params.lang;
	const db = locals.db;
	const [s, menus, nav] = await Promise.all([
		getSettings(db, ['announcement', 'shipping', 'payments', 'analytics']),
		getMenus(db, ['main', 'footer_shop', 'footer_help', 'footer_about', 'footer_legal']),
		categoryNav(db, lang)
	]);
	const a = s.announcement;
	return {
		lang,
		announcement: a && isWithinWindow(a.from, a.until) && tr(a.text, lang) ? { text: tr(a.text, lang), href: a.href || null } : null,
		categories: nav.map(({ key, label, href, icon }) => ({ key, label, href, icon })),
		mainMenu: menuLinks(menus.main, lang),
		footer: {
			shop: menuLinks(menus.footer_shop, lang),
			help: menuLinks(menus.footer_help, lang),
			about: menuLinks(menus.footer_about, lang),
			legal: menuLinks(menus.footer_legal, lang)
		},
		paymentMethods: s.payments.methods,
		emptyCart: emptyCart(s.shipping.freeFrom),
		analytics: s.analytics
	};
};
