/**
 * Image delivery (P1-05). Masters are uploaded once; Cloudflare Image Transformations resize at the
 * edge: /cdn-cgi/image/width=…,format=auto,quality=82/<PUBLIC_MEDIA_URL>/<key>.
 * Without a media CDN (dev / mock storage) originals are served from /media/<key> and no srcset is
 * emitted. Vector images (SVG) are never transformed.
 */
export const DEFAULT_WIDTHS = [400, 800, 1200, 1600] as const;

const isVector = (key: string) => key.toLowerCase().endsWith('.svg');

export function mediaUrl(key: string, mediaBase: string): string {
	if (/^https?:\/\//.test(key) || key.startsWith('/')) return key;
	return `${mediaBase || '/media'}/${key}`;
}

/** URL of the image at a given width. */
export function imageUrl(key: string, mediaBase: string, width?: number): string {
	const original = mediaUrl(key, mediaBase);
	if (!width || !mediaBase || isVector(key) || !/^https?:\/\//.test(original)) return original;
	return `/cdn-cgi/image/width=${width},format=auto,quality=82/${original}`;
}

/** `srcset` string, or undefined when transformations are unavailable (dev) or the image is a vector. */
export function srcset(key: string, mediaBase: string, widths: readonly number[] = DEFAULT_WIDTHS): string | undefined {
	if (!mediaBase || isVector(key)) return undefined;
	return widths.map((w) => `${imageUrl(key, mediaBase, w)} ${w}w`).join(', ');
}
