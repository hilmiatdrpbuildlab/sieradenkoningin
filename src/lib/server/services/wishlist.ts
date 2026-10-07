/**
 * Wishlist (P1-10): works for guests via the `sk_wl` cookie (1 year) and for customers via
 * customer_id. On login the guest list is merged into the account (P3-01).
 * Share links use a separate random token, so sharing never exposes the guest cookie.
 */
import type { Cookies } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { wishlistShares, wishlists } from '../db/schema.ts';
import { randomToken } from '../crypto.ts';

export const WISHLIST_COOKIE = 'sk_wl';

export interface WishlistOwner {
	customerId: string | null;
	guestToken: string | null;
}

export function wishlistOwner(cookies: Cookies, customerId?: string | null, create = false): WishlistOwner | null {
	if (customerId) return { customerId, guestToken: null };
	let token = cookies.get(WISHLIST_COOKIE) ?? null;
	if (!token && create) {
		token = randomToken(24);
		cookies.set(WISHLIST_COOKIE, token, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 365 * 86400 });
	}
	return token ? { customerId: null, guestToken: token } : null;
}

const ownerWhere = (o: WishlistOwner) =>
	o.customerId ? eq(wishlists.customerId, o.customerId) : and(isNull(wishlists.customerId), eq(wishlists.guestToken, o.guestToken!));

export async function wishlistProductIds(db: Executor, owner: WishlistOwner | null): Promise<string[]> {
	if (!owner) return [];
	const rows = await db.select({ id: wishlists.productId }).from(wishlists).where(ownerWhere(owner));
	return rows.map((r) => r.id);
}

export async function toggleWishlist(db: Executor, owner: WishlistOwner, productId: string, on?: boolean): Promise<boolean> {
	const [existing] = await db.select().from(wishlists).where(and(ownerWhere(owner), eq(wishlists.productId, productId)));
	const want = on ?? !existing;
	if (want && !existing) {
		await db.insert(wishlists).values({ customerId: owner.customerId, guestToken: owner.customerId ? null : owner.guestToken, productId }).onConflictDoNothing();
	} else if (!want && existing) {
		await db.delete(wishlists).where(eq(wishlists.id, existing.id));
	}
	return want;
}

/** Merge the guest list into the customer's list (called on login). */
export async function mergeWishlist(db: Executor, guestToken: string, customerId: string) {
	const guest = await db.select().from(wishlists).where(and(isNull(wishlists.customerId), eq(wishlists.guestToken, guestToken)));
	if (!guest.length) return;
	const mine = new Set((await db.select({ p: wishlists.productId }).from(wishlists).where(eq(wishlists.customerId, customerId))).map((r) => r.p));
	const move = guest.filter((g) => !mine.has(g.productId)).map((g) => g.id);
	if (move.length) await db.update(wishlists).set({ customerId, guestToken: null }).where(inArray(wishlists.id, move));
	await db.delete(wishlists).where(and(isNull(wishlists.customerId), eq(wishlists.guestToken, guestToken)));
}

/** Read-only share token for the current list (created once, reused). */
export async function shareToken(db: Executor, owner: WishlistOwner) {
	const [existing] = await db
		.select()
		.from(wishlistShares)
		.where(owner.customerId ? eq(wishlistShares.customerId, owner.customerId) : eq(wishlistShares.guestToken, owner.guestToken!));
	if (existing) return existing.token;
	const token = randomToken(16);
	await db.insert(wishlistShares).values({ token, customerId: owner.customerId, guestToken: owner.guestToken });
	return token;
}

export async function ownerFromShare(db: Executor, token: string): Promise<WishlistOwner | null> {
	const [s] = await db.select().from(wishlistShares).where(eq(wishlistShares.token, token));
	return s ? { customerId: s.customerId, guestToken: s.guestToken } : null;
}

