/**
 * PDP (P1-08). Public + edge-cacheable; the selected variant comes from `?variant=` (shallow-updated
 * client-side). The `add` action is the no-JS fallback for add-to-cart.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PUBLIC_SITE_URL } from '$app/env/public';
import { productBySlug, relationCards, toCard } from '#lib/server/services/catalog.ts';
import { getSettings } from '#lib/server/services/settings.ts';
import { getPageByKey } from '#lib/server/services/content.ts';
import { addToCart, getOrCreateCart } from '#lib/server/services/cart.ts';
import { addToCartSchema } from '#lib/schemas/cart.ts';
import { tr } from '#lib/i18n/index.ts';
import { localizeHref } from '#lib/i18n/paths.ts';
import { img, picture } from '#lib/utils/media.ts';
import { markdownToHtml } from '#lib/utils/markdown.ts';
import type { JsonLdBreadcrumbList, JsonLdProduct, PdpVariant } from '#lib/types.ts';

export const load: PageServerLoad = async ({ params, locals, url, setHeaders }) => {
	const { lang, slug } = params;
	const db = locals.db;
	const found = await productBySlug(db, slug);
	if (!found) error(404, 'Not found');
	const { product: p, category, images, lowest30 } = found;

	const [settings, completeSet, related, shippingPage] = await Promise.all([
		getSettings(db, ['shipping', 'return_days']),
		relationCards(db, p, 'complete_set'),
		relationCards(db, p, 'related'),
		getPageByKey(db, 'shipping')
	]);
	const card = (rows: typeof related) => rows.map((r) => toCard(r, lang, (key, alt) => picture(key, alt, 800)));

	const name = tr(p.name, lang);
	const variants: PdpVariant[] = found.variants.map((v) => {
		const price = v.priceOverride ?? p.price;
		return {
			id: v.id,
			sku: v.sku,
			metal: v.metal,
			size: v.size,
			price,
			compareAtPrice: p.compareAtPrice && p.compareAtPrice > price ? p.compareAtPrice : null,
			stock: v.stock,
			lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold
		};
	});
	const requested = variants.find((v) => v.id === url.searchParams.get('variant'));
	const initial = requested ?? variants.find((v) => v.stock > 0) ?? variants[0] ?? null;

	const gallery = images.length
		? images.map((i) => ({
				...picture(i.key, tr(i.alt, lang) || name, 1200),
				zoom: img(i.key, 2400),
				width: i.width ?? 1200,
				height: i.height ?? 1500
			}))
		: [
				{
					src: '/brand/placeholder.svg',
					srcset: undefined as string | undefined,
					alt: name,
					zoom: '/brand/placeholder.svg',
					width: 1200,
					height: 1500
				}
			];

	const site = PUBLIC_SITE_URL.replace(/\/$/, '');
	const path = localizeHref(`/p/${p.slug}`, lang);
	const categoryHref = category ? `/${lang}/${category.slugs[lang]}` : null;
	const description = tr(p.description, lang);
	const plain = description
		.replace(/[#*_[\]()]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	// schema.org Product / Offer / BreadcrumbList (typed in #lib/types.ts, no runtime dependency)
	const jsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'Product',
			name,
			description: plain || undefined,
			image: gallery.map((g) => (g.src.startsWith('http') ? g.src : `${site}${g.src}`)),
			sku: initial?.sku,
			brand: { '@type': 'Brand', name: 'Sieradenkoningin' },
			category: category ? tr(category.name, lang) : undefined,
			offers: variants.map((v) => ({
				'@type': 'Offer',
				sku: v.sku,
				url: `${site}${path}?variant=${v.id}`,
				price: (v.price / 100).toFixed(2),
				priceCurrency: 'EUR',
				availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
				itemCondition: 'https://schema.org/NewCondition'
			}))
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Sieradenkoningin', item: `${site}/${lang}` },
				...(category && categoryHref
					? [
							{
								'@type': 'ListItem' as const,
								position: 2,
								name: tr(category.name, lang),
								item: `${site}${categoryHref}`
							}
						]
					: []),
				{ '@type': 'ListItem', position: category ? 3 : 2, name }
			]
		}
	] satisfies [JsonLdProduct, JsonLdBreadcrumbList];

	setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' });
	return {
		product: {
			id: p.id,
			slug: p.slug,
			name,
			material: tr(p.material, lang),
			badge: p.badge,
			descriptionHtml: markdownToHtml(description),
			meaningHtml: markdownToHtml(tr(p.meaning, lang)),
			careHtml: markdownToHtml(tr(p.care, lang)),
			seoTitle: tr(p.seo?.title, lang) || name,
			seoDescription: tr(p.seo?.description, lang) || plain.slice(0, 160),
			lowest30
		},
		category: category ? { key: category.key, name: tr(category.name, lang), href: categoryHref! } : null,
		gallery,
		variants,
		initialVariantId: initial?.id ?? null,
		shipping: {
			cutoffHour: settings.shipping.cutoffHour,
			deliveryDays: settings.shipping.deliveryDays,
			freeFrom: settings.shipping.freeFrom
		},
		returnDays: settings.return_days,
		shippingHref: shippingPage ? `/${lang}/${shippingPage.slugs[lang]}` : null,
		completeSet: card(completeSet),
		related: card(related),
		jsonLd,
		canonical: path
	};
};

export const actions: Actions = {
	/** No-JS add-to-cart: adds via the cart service and redirects to the cart page. */
	add: async ({ request, locals, cookies, params }) => {
		const form = await request.formData();
		const str = (k: string) => (typeof form.get(k) === 'string' ? (form.get(k) as string) : '');
		// The form posts metal + size (the picker's own fields); resolve the matching variant here.
		const found = await productBySlug(locals.db, params.slug);
		const variant =
			found?.variants.find((v) =>
				str('variantId')
					? v.id === str('variantId')
					: (!str('metal') || v.metal === str('metal')) && (v.size ?? '') === str('size')
			) ?? (found && !str('variantId') && found.variants.length === 1 ? found.variants[0] : undefined);
		const parsed = addToCartSchema.safeParse({ variantId: variant?.id, qty: str('qty') || 1 });
		if (!parsed.success) return fail(400, { error: 'invalid' as const });
		const cart = await getOrCreateCart(locals.db, cookies, params.lang, locals.customer?.id);
		const r = await addToCart(locals.db, cart.id, parsed.data);
		if (!r.ok) return fail(409, { error: r.error });
		redirect(303, localizeHref('/cart', params.lang));
	}
};
