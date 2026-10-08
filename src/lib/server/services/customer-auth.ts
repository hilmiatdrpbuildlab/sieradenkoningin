/**
 * Customer authentication (P3-01).
 *
 * Tokens (verify / login / reset) live in `magic_links`: a random 256-bit token is mailed, only its
 * SHA-256 is stored, it expires after 30 minutes and is consumed with one atomic UPDATE … WHERE
 * used_at IS NULL AND expires_at > now — so a token works exactly once, even under concurrency.
 * Links in emails open a page with a button (POST): email scanners that pre-fetch links (GET) never
 * burn the token.
 *
 * Enumeration: register / forgot / magic always produce the same response; login failures are one
 * generic message, and an unknown email still runs a password verification (similar timing).
 *
 * On every successful login (`completeLogin`): new session, guest cart + guest wishlist merged into
 * the account, guest orders with the same VERIFIED email linked to the customer.
 */
import type { Cookies } from '@sveltejs/kit';
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { carts, customers, magicLinks, orders } from '../db/schema.ts';
import { randomToken, sha256Hex } from '../crypto.ts';
import { hashPassword, verifyPassword, PASSWORD_MIN } from '../auth/password.ts';
import { createSession, destroyAllSessions, destroySession } from '../auth/session.ts';
import { CART_COOKIE, findCart, mergeCarts } from './cart.ts';
import { WISHLIST_COOKIE, mergeWishlist } from './wishlist.ts';
import { localizeHref, type Lang } from '../../i18n/paths.ts';
import type { EmailAdapter } from '../adapters/email.ts';
import { sendEmail } from './email.ts';
import { getSettings } from './settings.ts';
import type { AccountEmailKind } from '../../components/email/account-types.ts';

export { PASSWORD_MIN };

export type TokenPurpose = 'login' | 'reset' | 'verify';
export const TOKEN_TTL_MS = 30 * 60_000;

/** Rate limits per action: `max` attempts per `windowSec`, keyed by IP and (where useful) by email. */
export const AUTH_LIMITS = {
	login: { ip: { max: 20, windowSec: 15 * 60 }, email: { max: 8, windowSec: 15 * 60 } },
	register: { ip: { max: 6, windowSec: 3600 } },
	forgot: { ip: { max: 6, windowSec: 3600 }, email: { max: 3, windowSec: 3600 } },
	magic: { ip: { max: 6, windowSec: 3600 }, email: { max: 3, windowSec: 3600 } },
	track: { ip: { max: 10, windowSec: 15 * 60 } }
} as const;

export type CustomerRow = typeof customers.$inferSelect;

export async function findCustomerByEmail(db: Executor, email: string): Promise<CustomerRow | null> {
	const [c] = await db
		.select()
		.from(customers)
		.where(and(eq(customers.email, email.trim().toLowerCase()), isNull(customers.deletedAt)));
	return c ?? null;
}

// ── Tokens ─────────────────────────────────────────────────────────────────────

/** Creates a single-use token for `email` (older unused tokens of the same purpose are revoked). */
export async function issueToken(db: Executor, email: string, purpose: TokenPurpose, now = new Date()): Promise<string> {
	const normalized = email.trim().toLowerCase();
	await db
		.update(magicLinks)
		.set({ usedAt: now })
		.where(and(eq(magicLinks.email, normalized), eq(magicLinks.purpose, purpose), isNull(magicLinks.usedAt)));
	const token = randomToken(32);
	await db.insert(magicLinks).values({
		tokenHash: await sha256Hex(token),
		email: normalized,
		purpose,
		expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
		createdAt: now
	});
	return token;
}

const plausibleToken = (t: unknown): t is string => typeof t === 'string' && t.length >= 20 && t.length <= 200;

/** Checks a token WITHOUT consuming it (to render the reset form). Returns the email or null. */
export async function peekToken(db: Executor, token: unknown, purpose: TokenPurpose, now = new Date()) {
	if (!plausibleToken(token)) return null;
	const [row] = await db
		.select({ email: magicLinks.email })
		.from(magicLinks)
		.where(
			and(
				eq(magicLinks.tokenHash, await sha256Hex(token)),
				eq(magicLinks.purpose, purpose),
				isNull(magicLinks.usedAt),
				gt(magicLinks.expiresAt, now)
			)
		);
	return row?.email ?? null;
}

/** Consumes a token atomically: returns the email exactly once while unexpired, otherwise null. */
export async function consumeToken(db: Executor, token: unknown, purpose: TokenPurpose, now = new Date()) {
	if (!plausibleToken(token)) return null;
	const rows = await db
		.update(magicLinks)
		.set({ usedAt: now })
		.where(
			and(
				eq(magicLinks.tokenHash, await sha256Hex(token)),
				eq(magicLinks.purpose, purpose),
				isNull(magicLinks.usedAt),
				gt(magicLinks.expiresAt, now)
			)
		)
		.returning({ email: magicLinks.email });
	return rows[0]?.email ?? null;
}

// ── Links ──────────────────────────────────────────────────────────────────────

export function authLink(siteUrl: string, lang: Lang, purpose: TokenPurpose, token: string, next?: string | null) {
	const site = siteUrl.replace(/\/$/, '');
	const t = encodeURIComponent(token);
	if (purpose === 'reset') return `${site}${localizeHref(`/account/reset/${t}`, lang)}`;
	const path = purpose === 'verify' ? '/account/verify' : '/account/magic';
	const n = next && safeNext(next) ? `&next=${encodeURIComponent(next)}` : '';
	return `${site}${localizeHref(path, lang)}?token=${t}${n}`;
}

/** Only same-site absolute paths are accepted as a post-login destination (no open redirects). */
export function safeNext(next: unknown): string | null {
	if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
	if (next.length > 500 || /[\r\n]/.test(next)) return null;
	if (next.startsWith('/admin') || next.startsWith('/api/')) return null;
	return next;
}

// ── Registration & password ────────────────────────────────────────────────────

export type RegisterOutcome = { kind: 'created'; customer: CustomerRow } | { kind: 'exists'; customer: CustomerRow };

/**
 * Creates an unverified account, or reports that the email is taken (the caller then emails the
 * existing owner instead — the visitor sees the same "check your inbox" page either way).
 */
export async function registerCustomer(
	db: Executor,
	input: { email: string; password: string; firstName: string; lastName: string; locale: Lang }
): Promise<RegisterOutcome> {
	const email = input.email.trim().toLowerCase();
	const existing = await findCustomerByEmail(db, email);
	if (existing) return { kind: 'exists', customer: existing };
	const passwordHash = await hashPassword(input.password);
	const [created] = await db
		.insert(customers)
		.values({ email, passwordHash, firstName: input.firstName, lastName: input.lastName, locale: input.locale })
		.onConflictDoNothing()
		.returning();
	if (!created) {
		const raced = await findCustomerByEmail(db, email);
		if (raced) return { kind: 'exists', customer: raced };
		throw new Error('registerCustomer: email is held by a deleted account');
	}
	return { kind: 'created', customer: created };
}

/** A fixed Argon2id hash used to spend comparable time when the email is unknown. */
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$VTtphf1q4AeZtZBNtfgZ0Q$3qFdtBpkrCpGdYU240paBimn2PKMaKacKnpwdu2ZT3w';

export type PasswordLoginResult =
	| { ok: true; customer: CustomerRow }
	| { ok: false; reason: 'invalid' }
	| { ok: false; reason: 'unverified'; customer: CustomerRow };

export async function checkPasswordLogin(db: Executor, email: string, password: string): Promise<PasswordLoginResult> {
	const c = await findCustomerByEmail(db, email);
	const valid = await verifyPassword(c?.passwordHash ?? DUMMY_HASH, password);
	if (!c || !c.passwordHash || !valid) return { ok: false, reason: 'invalid' };
	if (!c.emailVerifiedAt) return { ok: false, reason: 'unverified', customer: c };
	return { ok: true, customer: c };
}

export async function setPassword(db: Executor, customerId: string, password: string) {
	await db
		.update(customers)
		.set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
		.where(eq(customers.id, customerId));
}

/**
 * Marks the email as verified (it was just proven by a mailed token). When the account was not yet
 * verified, any existing sessions are dropped first: nobody keeps access to an account whose email
 * ownership was only now established.
 */
export async function markVerified(db: Executor, customer: CustomerRow, now = new Date()) {
	if (customer.emailVerifiedAt) return customer;
	await destroyAllSessions(db, 'customer', customer.id);
	const [c] = await db
		.update(customers)
		.set({ emailVerifiedAt: now, updatedAt: now })
		.where(eq(customers.id, customer.id))
		.returning();
	return c ?? customer;
}

// ── Login / logout ─────────────────────────────────────────────────────────────

/** Links guest orders (no customer) placed with this customer's email — only once the email is verified. */
export async function linkGuestOrders(db: Executor, customer: Pick<CustomerRow, 'id' | 'email' | 'emailVerifiedAt'>) {
	if (!customer.emailVerifiedAt) return 0;
	const rows = await db
		.update(orders)
		.set({ customerId: customer.id, updatedAt: new Date() })
		.where(and(isNull(orders.customerId), eq(orders.email, customer.email)))
		.returning({ id: orders.id });
	return rows.length;
}

/** Guest cart → account (or restore the account's cart on a new device). */
async function adoptCart(db: Executor, cookies: Cookies, customerId: string) {
	const guest = await findCart(db, cookies);
	if (guest && (guest.customerId === null || guest.customerId === customerId)) {
		await mergeCarts(db, guest.id, customerId);
		return;
	}
	// No usable guest cart (none, or one left behind by someone else on a shared device).
	const [own] = await db
		.select()
		.from(carts)
		.where(and(eq(carts.customerId, customerId), guest ? ne(carts.id, guest.id) : sql`true`))
		.orderBy(sql`${carts.updatedAt} desc`)
		.limit(1);
	if (own) cookies.set(CART_COOKIE, own.token, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 86400 });
	else if (guest) cookies.delete(CART_COOKIE, { path: '/' });
}

export interface LoginContext {
	db: Executor;
	cookies: Cookies;
	ip?: string;
	ua?: string | null;
}

/** Starts a customer session and runs the on-login merges. */
export async function completeLogin(ctx: LoginContext, customer: CustomerRow) {
	const { db, cookies } = ctx;
	// Never reuse a pre-login session id (fixation): drop whatever session this browser had.
	await destroySession(db, cookies, 'customer');
	await createSession(db, cookies, 'customer', customer.id, { ip: ctx.ip, ua: ctx.ua ?? undefined });
	await adoptCart(db, cookies, customer.id);
	const wl = cookies.get(WISHLIST_COOKIE);
	if (wl) {
		await mergeWishlist(db, wl, customer.id);
		cookies.delete(WISHLIST_COOKIE, { path: '/' });
	}
	await linkGuestOrders(db, customer);
}

/** Logout: ends the session and forgets the visitor cart/wishlist cookies (shared devices). */
export async function logout(db: Executor, cookies: Cookies) {
	await destroySession(db, cookies, 'customer');
	cookies.delete(CART_COOKIE, { path: '/' });
	cookies.delete(WISHLIST_COOKIE, { path: '/' });
}

// ── Emails & redirects ─────────────────────────────────────────────────────────

const TEMPLATE_BY_KIND = {
	verify: 'account_verify',
	login: 'account_login_link',
	reset: 'account_reset',
	exists: 'account_exists'
} as const;

/**
 * Sends one account email. Failures are logged (email_log) but never surface to the visitor, so the
 * response stays identical whether or not the address is known.
 */
export async function sendAccountEmail(
	deps: { db: Executor; email: EmailAdapter },
	input: { to: string; kind: AccountEmailKind; lang: Lang; siteUrl: string; firstName?: string | null; url: string; secondaryUrl?: string | null }
) {
	const { store, emails } = await getSettings(deps.db, ['store', 'emails']);
	try {
		await sendEmail(deps, {
			to: input.to,
			template: TEMPLATE_BY_KIND[input.kind],
			locale: input.lang,
			data: {
				kind: input.kind,
				firstName: input.firstName ?? null,
				url: input.url,
				secondaryUrl: input.secondaryUrl ?? null,
				shopUrl: `${input.siteUrl.replace(/\/$/, '')}/${input.lang}`,
				storeName: store.name || 'Sieradenkoningin',
				storeEmail: store.email || null
			},
			replyTo: emails.replyTo
		});
		return true;
	} catch (err) {
		console.error('[customer-auth] email failed', err);
		return false;
	}
}

/** Localized login URL that brings the visitor back to `url` afterwards. */
export function loginRedirect(url: URL, lang: Lang) {
	// A form action URL (`?/save`) is not a page to come back to.
	const search = url.search.startsWith('?/') ? '' : url.search;
	return `${localizeHref('/account/login', lang)}?next=${encodeURIComponent(url.pathname + search)}`;
}
