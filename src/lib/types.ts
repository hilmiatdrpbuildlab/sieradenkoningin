/** Shared UI-facing types (keep DB row types in $lib/server/db/schema.ts). */

export interface ProductCardData {
	slug: string;
	name: string;
	material?: string;            // "18k verguld · granaat"
	price: number;                // cents
	compareAtPrice?: number;      // cents → shows sale
	images: { src: string; alt: string; srcset?: string }[];
	badge?: 'new' | 'limited' | 'bestseller';
	metals?: ('gold' | 'rosegold' | 'silver')[];
	inStock?: boolean;
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export type Column<R> = {
	key: keyof R & string;
	label: string;
	sortable?: boolean;
	align?: 'start' | 'end' | 'center';
	width?: string;
	hideBelow?: 'md' | 'lg'; // responsive column hiding
};

export interface UploadedImage {
	key: string;          // object key in storage
	url: string;          // public/CDN url for preview
	alt: string;          // required before publish (a11y + SEO)
	width?: number;
	height?: number;
}
