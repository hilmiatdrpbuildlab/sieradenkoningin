/**
 * Admin login flow (P0-09): password → (enrol TOTP on first login) → TOTP challenge → session
 * marked two_factor_verified. Rate limit: 5 attempts / 15 min per IP + email.
 */
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { adminUsers, sessions } from '../db/schema.ts';
import { decrypt, encrypt, sha256Hex } from '../crypto.ts';
import { readSession } from './session.ts';
import { verifyTotp } from './totp.ts';

export const LOGIN_LIMIT = { attempts: 5, windowSec: 15 * 60 };

/** Session that passed the password step but not (yet) 2FA. */
export async function pendingAdmin(db: Executor, cookies: Cookies) {
	const session = await readSession(db, cookies, 'admin');
	if (!session) return null;
	const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.userId));
	if (!user?.active) return null;
	return { session, user };
}

export async function storeTotpSecret(db: Executor, userId: string, secret: string, key: string) {
	await db
		.update(adminUsers)
		.set({ totpSecret: await encrypt(secret, key), totpEnabledAt: null, updatedAt: new Date() })
		.where(eq(adminUsers.id, userId));
}

export async function readTotpSecret(encrypted: string | null, key: string) {
	if (!encrypted) return null;
	try {
		return await decrypt(encrypted, key);
	} catch {
		return null;
	}
}

/** Verifies a 6-digit TOTP code or a single-use recovery code (which is then consumed). */
export async function verifySecondFactor(db: Executor, user: typeof adminUsers.$inferSelect, code: string, key: string) {
	const clean = code.replace(/\s/g, '');
	const secret = await readTotpSecret(user.totpSecret, key);
	if (secret && (await verifyTotp(secret, clean))) return 'totp' as const;
	if (/^[a-z0-9]{8}$/i.test(clean) && user.recoveryCodes?.length) {
		const hash = await sha256Hex(clean.toLowerCase());
		if (user.recoveryCodes.includes(hash)) {
			await db
				.update(adminUsers)
				.set({ recoveryCodes: user.recoveryCodes.filter((h) => h !== hash) })
				.where(eq(adminUsers.id, user.id));
			return 'recovery' as const;
		}
	}
	return null;
}

export async function completeLogin(db: Executor, sessionId: string, userId: string) {
	await db.update(sessions).set({ twoFactorVerified: true }).where(eq(sessions.id, sessionId));
	await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, userId));
}

/** Only allow same-site admin paths as post-login redirect targets. */
export function safeNext(next: string | null) {
	return next && next.startsWith('/admin') && !next.startsWith('//') && !next.startsWith('/admin/login') ? next : '/admin';
}
