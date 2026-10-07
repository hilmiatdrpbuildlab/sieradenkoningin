/** Shared UI-facing types (client + server). DB row types live in #lib/server/db/schema.ts. */

export type Metal = 'gold' | 'rosegold' | 'silver';

export interface ImageData {
	src: string;
	alt: string;
	srcset?: string;
	width?: number;
	height?: number;
}

export interface ProductCardData {
	id: string;
	slug: string;
	href: string; // localized PDP url
	name: string;
	material?: string; // "18k verguld · granaat"
	price: number; // cents
	compareAtPrice?: number | null; // cents → shows sale
	images: ImageData[];
	badge?: 'new' | 'limited' | 'bestseller' | null;
	metals?: Metal[];
	inStock?: boolean;
	/** Single purchasable variant → quick add goes straight to the cart. */
	quickAddVariantId?: string | null;
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'open' | 'paid' | 'failed' | 'canceled' | 'expired' | 'partially_refunded' | 'refunded';

export type Column<R> = {
	key: keyof R & string;
	label: string;
	sortable?: boolean;
	align?: 'start' | 'end' | 'center';
	width?: string;
	hideBelow?: 'md' | 'lg'; // responsive column hiding
};

export interface UploadedImage {
	key: string; // object key in storage
	url: string; // public/CDN url for preview
	alt: string; // NL alt text — required before publish (a11y + SEO)
	altFr?: string;
	mediaId?: string;
	width?: number;
	height?: number;
}

export interface CartLineView {
	id: string;
	variantId: string;
	productId: string;
	slug: string;
	sku: string;
	name: string;
	variantLabel: string;
	metal: string;
	size: string | null;
	imageKey: string | null;
	imageAlt: string;
	unitPrice: number;
	compareAtPrice: number | null;
	quantity: number;
	maxQuantity: number;
	giftWrap: boolean;
	available: boolean;
}

export interface CartView {
	id: string | null;
	lines: CartLineView[];
	count: number;
	subtotal: number;
	discount: number;
	discountCode: string | null;
	discountError: string | null;
	freeShipping: boolean;
	shippingEstimate: number;
	freeShippingFrom: number;
	toFreeShipping: number;
	total: number;
}

export interface NavLink {
	label: string;
	href: string;
}

export interface CategoryNav {
	key: string;
	label: string;
	href: string;
	icon: string;
}

export interface Alternates {
	nl: string;
	fr: string;
}
