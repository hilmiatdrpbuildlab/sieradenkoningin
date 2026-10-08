<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Seo from '#lib/components/storefront/Seo.svelte';
	import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
	import PdpGallery from '#lib/components/storefront/PdpGallery.svelte';
	import BuyBox from '#lib/components/storefront/BuyBox.svelte';
	import PdpAccordions from '#lib/components/storefront/PdpAccordions.svelte';
	import ProductRail from '#lib/components/storefront/ProductRail.svelte';
	import RecentlyViewed from '#lib/components/storefront/RecentlyViewed.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { data, form } = $props();

	// Selected variant: server picks it from ?variant= (or the first in stock); switching updates
	// price, stock and the URL without a reload (shallow + replace history entry, no load re-run).
	let variantId = $derived(data.initialVariantId);
	const variant = $derived(data.variants.find((v) => v.id === variantId) ?? null);
	const sizeKind = $derived(
		data.category?.key === 'rings' ? 'ring' : data.category?.key === 'bracelets' ? 'bracelet' : null
	);

	function selectVariant(id: string) {
		variantId = id;
		const url = new URL(page.url.href);
		url.searchParams.set('variant', id);
		goto(url, { state: page.state, shallow: true, replace: true });
	}

	const crumbs = $derived([
		{ label: m.breadcrumb_home(), href: `/${data.lang}` },
		...(data.category ? [{ label: data.category.name, href: data.category.href }] : []),
		{ label: data.product.name }
	]);
</script>

<Seo
	title={data.product.seoTitle}
	description={data.product.seoDescription}
	image={data.gallery[0]?.src}
	canonical={data.canonical}
	type="product"
	jsonLd={data.jsonLd}
/>
<svelte:head>
	<link
		rel="preload"
		as="image"
		href={data.gallery[0].src}
		imagesrcset={data.gallery[0].srcset}
		imagesizes="(min-width: 64rem) 50vw, 100vw"
		fetchpriority="high"
	/>
</svelte:head>

<div class="pdp container-lux">
	<div class="crumbs"><Breadcrumbs items={crumbs} /></div>
	<div class="grid">
		<div class="media"><PdpGallery images={data.gallery} /></div>
		<div class="info">
			<div class="sticky">
				<BuyBox
					lang={data.lang}
					product={data.product}
					variants={data.variants}
					{variantId}
					{sizeKind}
					shipping={data.shipping}
					returnDays={data.returnDays}
					image={data.gallery[0]?.src}
					error={form && 'error' in form ? form.error : null}
					onvariant={selectVariant}
				/>
				<PdpAccordions
					lang={data.lang}
					descriptionHtml={data.product.descriptionHtml}
					meaningHtml={data.product.meaningHtml}
					careHtml={data.product.careHtml}
					material={data.product.material}
					sku={variant?.sku ?? null}
					freeFrom={data.shipping.freeFrom}
					returnDays={data.returnDays}
					shippingHref={data.shippingHref}
				/>
			</div>
		</div>
	</div>
</div>

<ProductRail eyebrow={m.pdp_meaning()} title={m.pdp_complete_set()} products={data.completeSet} />
<ProductRail title={m.pdp_related()} products={data.related} />
{#key data.product.id}<RecentlyViewed productId={data.product.id} lang={data.lang} />{/key}

<style>
	.pdp {
		padding-top: var(--space-4);
		padding-bottom: var(--section-y-sm);
	}
	.crumbs {
		margin-bottom: var(--space-4);
	}
	.grid {
		display: grid;
		gap: var(--space-8);
	}
	.media {
		margin-inline: calc(-1 * var(--gutter));
	}
	.sticky {
		display: grid;
		gap: var(--space-10);
	}
	@media (min-width: 48rem) {
		.media {
			margin-inline: 0;
		}
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			gap: var(--space-16);
			align-items: start;
		}
		.sticky {
			position: sticky;
			top: calc(var(--header-h) + var(--space-8));
		}
	}
</style>
