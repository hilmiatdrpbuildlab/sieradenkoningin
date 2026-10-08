/**
 * Admin user management (P3-10): invite, change role, (de)activate, reset 2FA.
 * Invariant: there is always at least one ACTIVE owner (checked inside the transaction).
 */
import { and, eq, ne, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { adminUsers, sessions } from '../db/schema.ts';
import { randomToken, sha256Hex } from '../crypto.ts';
import type { Role } from '../../permissions.ts';

export const INVITE_TTL_MS = 7 * 86400_000;

/** Pure rule (unit-tested): would this change leave the shop without an active owner? */
export function wouldRemoveLastOwner(
	target: { role: Role; active: boolean },
	change: { role?: Role; active?: boolean },
	otherActiveOwners: number
): boolean {
	const isActiveOwner = target.role === 'owner' && target.active;
	if (!isActiveOwner) return false;
	const staysActiveOwner = (change.role ?? target.role) === 'owner' && (change.active ?? target.active);
	return !staysActiveOwner && otherActiveOwners === 0;
}

export async function otherActiveOwners(db: Executor, excludeId: string) {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(adminUsers)
		.where(and(eq(adminUsers.role, 'owner'), eq(adminUsers.active, true), ne(adminUsers.id, excludeId)));
	return n;
}

export async function createInvite(db: Executor, input: { email: string; name: string; role: Role }) {
	const token = randomToken(32);
	const values = {
		email: input.email.toLowerCase(),
		name: input.name,
		role: input.role,
		active: true,
		inviteTokenHash: await sha256Hex(token),
		inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
		passwordHash: null,
		totpSecret: null,
		totpEnabledAt: null,
		recoveryCodes: null
	};
	const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, values.email));
	if (existing?.passwordHash) return { ok: false as const, error: 'exists' as const };
	const [user] = existing
		? await db.update(adminUsers).set(values).where(eq(adminUsers.id, existing.id)).returning()
		: await db.insert(adminUsers).values(values).returning();
	return { ok: true as const, user, token };
}

export async function findInvite(db: Executor, token: string) {
	const [user] = await db
		.select()
		.from(adminUsers)
		.where(eq(adminUsers.inviteTokenHash, await sha256Hex(token)));
	if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date() || !user.active) return null;
	return user;
}

export async function revokeSessions(db: Executor, userId: string) {
	await db.delete(sessions).where(and(eq(sessions.userType, 'admin'), eq(sessions.userId, userId)));
}
