import { error, isHttpError, redirect } from '@sveltejs/kit';
import { sequence, type Handle, type HandleServerError } from '@sveltejs/kit/hooks';
import { eq } from 'drizzle-orm';
import * as env from '$app/env/private';
import { PUBLIC_MEDIA_URL } from '$app/env/public';
import { createDb } from '#lib/server/db/index.ts';
import { adminUsers, customers, redirects } from '#lib/server/db/schema.ts';
import { createStorage } from '#lib/server/adapters/storage.ts';
import { createPayments } from '#lib/server/adapters/payments.ts';
import { createShipping } from '#lib/server/adapters/shipping.ts';
import { createEmail } from '#lib/server/adapters/email.ts';
import { createNewsletter } from '#lib/server/adapters/newsletter.ts';
import { readSession } from '#lib/server/auth/session.ts';
import { clientIp } from '#lib/server/auth/rate-limit.ts';
import { getSetting } from '#lib/server/services/settings.ts';
import { htmlLang, langFromPath, negotiateLang, isLang } from '#lib/i18n/paths.ts';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { defineCustomServerStrategy } from '#lib/paraglide/runtime.js';
import type { Role } from '#lib/permissions.ts';

// Locale = first path segment. Registered once at module load (stateless, no per-request data).
defineCustomServerStrategy('custom-path', {
	getLocale: (request) => (request ? langFromPath(new URL(request.url).pathname) : undefined)
});

export const LANG_COOKIE = 'sk_lang';

const isAdminPath = (p: string) => p === '/admin' || p.startsWith('/admin/');
const ADMIN_PUBLIC = ['/admin/login', '/admin/invite', '/admin/logout'];
const isAdminPublic = (p: string) => ADMIN_PUBLIC.some((x) => p === x || p.startsWith(x + '/'));

/** 1. Per-request services (Workers: no shared mutable module state between requests). */
const services: Handle = async ({ event, resolve }) => {
	const { db, close } = createDb(env.DATABASE_URL);
	event.locals.db = db;
	event.locals.ip = clientIp(event.request, event.getClientAddress?.() ?? 'unknown');
	event.locals.lang = langFromPath(event.url.pathname);
	event.locals.storage = createStorage({ ...env, PUBLIC_MEDIA_URL });
	event.locals.payments = createPayments(env.MOLLIE_API_KEY, db);
	event.locals.shipping = createShipping(env.SENDCLOUD_PUBLIC_KEY, env.SENDCLOUD_SECRET_KEY);
	event.locals.email = createEmail(env.POSTMARK_TOKEN, env.EMAIL_FROM);
	event.locals.newsletter = createNewsletter(env.BREVO_API_KEY, env.BREVO_LIST_ID);
	try {
		return await resolve(event);
	} finally {
		const done = close().catch(() => {});
		if (event.platform?.ctx) event.platform.ctx.waitUntil(done);
		else await done;
	}
};

/** 2. Locale: root redirect, Paraglide request context, <html lang>. */
const i18n: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/') {
		const remembered = event.cookies.get(LANG_COOKIE);
		const lang = isLang(remembered) ? remembered : negotiateLang(event.request.headers.get('accept-language'));
		return new Response(null, { status: 302, headers: { location: `/${lang}${event.url.search}`, vary: 'Accept-Language, Cookie' } });
	}
	const [, first] = event.url.pathname.split('/');
	if (isLang(first) && event.cookies.get(LANG_COOKIE) !== first && event.request.method === 'GET') {
		event.cookies.set(LANG_COOKIE, first, { path: '/', maxAge: 31536000, httpOnly: false, sameSite: 'lax' });
	}
	return paraglideMiddleware(event.request, () =>
		resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', htmlLang(event.locals.lang)),
			preload: ({ type, path }) => type === 'js' || type === 'css' || (type === 'font' && /(playfair|montserrat).*latin-wght-normal/.test(path))
		})
	);
};

/** 3. Sessions (admin on /admin, customer on the storefront). */
const auth: Handle = async ({ event, resolve }) => {
	const { db } = event.locals;
	const path = event.url.pathname;
	if (isAdminPath(path) || event.cookies.get('sk_admin')) {
		const session = await readSession(db, event.cookies, 'admin');
		if (session) {
			const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.userId));
			if (user?.active && session.twoFactorVerified) {
				event.locals.admin = { id: user.id, name: user.name, email: user.email, role: user.role as Role, sessionId: session.id };
			}
		}
	}
	if (!isAdminPath(path) && event.cookies.get('sk_session')) {
		const session = await readSession(db, event.cookies, 'customer');
		if (session) {
			const [c] = await db.select().from(customers).where(eq(customers.id, session.userId));
			if (c && !c.deletedAt) {
				event.locals.customer = { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, locale: c.locale };
			}
		}
	}
	return resolve(event);
};

/** 4. Admin guard: every /admin route except login/invite needs a 2FA-verified session. */
const adminGuard: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (isAdminPath(path) && !isAdminPublic(path) && !event.locals.admin) {
		if (path.startsWith('/admin/api')) error(401, 'Niet aangemeld');
		redirect(303, `/admin/login?next=${encodeURIComponent(path + event.url.search)}`);
	}
	return resolve(event);
};

/** 5. Maintenance mode (settings.maintenance) — admins and the invite-list cookie bypass it. */
const maintenance: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (isAdminPath(path) || path.startsWith('/api/') || path.startsWith('/media/') || path.startsWith('/_app/')) return resolve(event);
	const m = await getSetting(event.locals.db, 'maintenance');
	if (!m.enabled || event.locals.admin) return resolve(event);
	const bypass = event.url.searchParams.get('preview');
	if (m.bypassToken && bypass === m.bypassToken) {
		event.cookies.set('sk_preview', m.bypassToken, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 14 * 86400 });
		return resolve(event);
	}
	if (m.bypassToken && event.cookies.get('sk_preview') === m.bypassToken) return resolve(event);
	const lang = event.locals.lang;
	const message = m.message?.[lang] || m.message?.nl;
	return new Response(maintenanceHtml(lang, message), {
		status: 503,
		headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '3600', 'cache-control': 'no-store' }
	});
};

/** 6. Redirects table (301/302) — consulted only when no route matched, so it costs nothing on hits. */
const redirectsHook: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	if (response.status === 404 && event.request.method === 'GET' && !isAdminPath(event.url.pathname)) {
		const [r] = await event.locals.db.select().from(redirects).where(eq(redirects.fromPath, event.url.pathname));
		if (r) {
			event.locals.db
				.update(redirects)
				.set({ hits: r.hits + 1 })
				.where(eq(redirects.fromPath, r.fromPath))
				.catch(() => {});
			return new Response(null, { status: r.code, headers: { location: r.toPath } });
		}
	}
	return response;
};

/** 7. Security headers (CSP itself is configured in vite.config.ts → sveltekit({ csp })). */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const h = response.headers;
	const set = (k: string, v: string) => {
		try {
			h.set(k, v);
		} catch {
			/* immutable headers (e.g. fetch passthrough) */
		}
	};
	set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
	set('referrer-policy', 'strict-origin-when-cross-origin');
	set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://*.mollie.com")');
	set('x-content-type-options', 'nosniff');
	set('x-frame-options', 'SAMEORIGIN');
	const p = event.url.pathname;
	if (isAdminPath(p)) {
		set('x-robots-tag', 'noindex, nofollow');
		set('cache-control', 'private, no-store');
	}
	return response;
};

export const handle = sequence(services, i18n, securityHeaders, auth, adminGuard, maintenance, redirectsHook);

export const handleError: HandleServerError = ({ error: err, event, kind }) => {
	if (kind === 'unknown') console.error(`[${event.request.method} ${event.url.pathname}]`, err);
	if (isHttpError(err)) return;
};

function maintenanceHtml(lang: 'nl' | 'fr', message?: string) {
	const title = lang === 'fr' ? 'Nous revenons bientôt' : 'We zijn zo terug';
	const body =
		message ?? (lang === 'fr' ? 'Notre boutique fait peau neuve. Revenez dans quelques instants.' : 'Onze winkel krijgt een nieuwe glans. Kom zo dadelijk terug.');
	return `<!doctype html><html lang="${htmlLang(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — Sieradenkoningin</title><link rel="stylesheet" href="/maintenance.css"></head><body><main><p class="crown" aria-hidden="true">♛</p><h1>${title}</h1><p>${body}</p><p class="mark">Sieradenkoningin</p></main></body></html>`;
}
