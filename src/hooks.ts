import type { Reroute } from '@sveltejs/kit/hooks';
import { delocalizePath } from '#lib/i18n/paths.ts';

/** Map localized public paths (/nl/winkelmand) to internal routes (/nl/cart). Runs on server and client. */
export const reroute: Reroute = ({ url }) => {
	const internal = delocalizePath(url.pathname);
	if (internal !== url.pathname) return internal;
};
