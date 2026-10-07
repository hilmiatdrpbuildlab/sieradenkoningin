/**
 * Database sessions. The cookie holds a random 32-byte token; the DB stores only its SHA-256.
 * Admin: cookie `sk_admin`, SameSite=Strict, 12 h idle / 7 d absolute expiry.
 * Customer: cookie `sk_session`, SameSite=Lax, 14 d idle / 60 d absolute expiry.
 */
import type { Cookies } from '@sveltejs/kit';
import { and, eq, lt } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { sessions } from '../db/schema.ts';
import { randomToken, sha256Hex } from '../crypto.ts';

export type UserType = 'admin' | 'customer';

export const SESSION_POLICY = {
	admin: { cookie: 'sk_admin', idleMs: 12 * 3600_000, absoluteMs: 7 * 86400_000, sameSite: 'strict' },
	customer: { cookie: 'sk_session', idleMs: 14 * 86400_000, absoluteMs: 60 * 86400_000, sameSite: 'lax' }
} as const;

/** Idle expiry is refreshed at most this often (avoids a DB write on every request). */
const TOUCH_INTERVAL_MS = 5 * 60_000;

export interface SessionRow {
	id: string;
	userType: UserType;
	userId: string;
	expiresAt: Date;
	idleExpiresAt: Date;
	twoFactorVerified: boolean;
}

/** Pure expiry rule (unit-tested): valid while now < idle expiry AND now < absolute expiry. */
export function isSessionValid(s: Pick<SessionRow, 'expiresAt' | 'idleExpiresAt'>, now = Date.now()) {
	return now < s.expiresAt.getTime() && now < s.idleExpiresAt.getTime();
}

export async function createSession(
	db: Executor,
	cookies: Cookies,
	userType: UserType,
	userId: string,
	meta: { ip?: string; ua?: string; twoFactorVerified?: boolean } = {},
	now = Date.now()
) {
	const policy = SESSION_POLICY[userType];
	const token = randomToken(32);
	const expiresAt = new Date(now + policy.absoluteMs);
	const id = await sha256Hex(token);
	await db.insert(sessions).values({
		id,
		userType,
		userId,
		expiresAt,
		idleExpiresAt: new Date(Math.min(now + policy.idleMs, expiresAt.getTime())),
		twoFactorVerified: meta.twoFactorVerified ?? false,
		ip: meta.ip,
		ua: meta.ua?.slice(0, 300)
	});
	setSessionCookie(cookies, userType, token, expiresAt);
	return { token, id };
}

export function setSessionCookie(cookies: Cookies, userType: UserType, token: string, expiresAt: Date) {
	const policy = SESSION_POLICY[userType];
	cookies.set(policy.cookie, token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: policy.sameSite,
		expires: expiresAt
	});
}

/** Reads + validates the session cookie, sliding the idle expiry. Returns null when absent/expired. */
export async function readSession(
	db: Executor,
	cookies: Cookies,
	userType: UserType,
	now = Date.now()
): Promise<SessionRow | null> {
	const policy = SESSION_POLICY[userType];
	const token = cookies.get(policy.cookie);
	if (!token) return null;
	const id = await sha256Hex(token);
	const [row] = await db
		.select()
		.from(sessions)
		.where(and(eq(sessions.id, id), eq(sessions.userType, userType)));
	if (!row || !isSessionValid(row, now)) {
		if (row) await db.delete(sessions).where(eq(sessions.id, id));
		cookies.delete(policy.cookie, { path: '/' });
		return null;
	}
	const nextIdle = Math.min(now + policy.idleMs, row.expiresAt.getTime());
	if (nextIdle - row.idleExpiresAt.getTime() > TOUCH_INTERVAL_MS) {
		await db
			.update(sessions)
			.set({ idleExpiresAt: new Date(nextIdle) })
			.where(eq(sessions.id, id));
	}
	return row as SessionRow;
}

export async function markTwoFactorVerified(db: Executor, sessionId: string) {
	await db.update(sessions).set({ twoFactorVerified: true }).where(eq(sessions.id, sessionId));
}

export async function destroySession(db: Executor, cookies: Cookies, userType: UserType) {
	const policy = SESSION_POLICY[userType];
	const token = cookies.get(policy.cookie);
	if (token) await db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
	cookies.delete(policy.cookie, { path: '/' });
}

export async function destroyAllSessions(db: Executor, userType: UserType, userId: string) {
	await db.delete(sessions).where(and(eq(sessions.userType, userType), eq(sessions.userId, userId)));
}

export async function purgeExpiredSessions(db: Executor, now = new Date()) {
	await db.delete(sessions).where(lt(sessions.expiresAt, now));
}
