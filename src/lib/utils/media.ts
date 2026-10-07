/** Image helpers bound to PUBLIC_MEDIA_URL (usable on server and client). */
import { PUBLIC_MEDIA_URL } from '$app/env/public';
import { imageUrl as rawImageUrl, srcset as rawSrcset, DEFAULT_WIDTHS } from './images.ts';

export const img = (key: string, width?: number) => rawImageUrl(key, PUBLIC_MEDIA_URL, width);
export const imgSrcset = (key: string, widths: readonly number[] = DEFAULT_WIDTHS) => rawSrcset(key, PUBLIC_MEDIA_URL, widths);

/** Shape consumed by ProductCard / Hero / galleries. */
export function picture(key: string, alt: string, width = 800) {
	return { src: img(key, width), srcset: imgSrcset(key), alt };
}
