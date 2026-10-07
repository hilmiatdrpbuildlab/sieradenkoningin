/**
 * Owner recovery tool (RUNBOOK: "lost authenticator / forgot password").
 *   npm run admin:reset -- owner@example.com            → new random password + 2FA re-enrolment
 *   npm run admin:reset -- owner@example.com --keep-2fa → new password only
 * Signs the user out everywhere. Needs direct database access, so only the operator can run it.
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { DATABASE_URL } from './env.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import { hashPassword } from '../src/lib/server/auth/password.ts';

const [email, ...flags] = process.argv.slice(2);
if (!email) {
	console.error('Usage: npm run admin:reset -- <email> [--keep-2fa]');
	process.exit(1);
}
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
try {
	const db = drizzle(pool, { schema });
	const [user] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email.toLowerCase()));
	if (!user) throw new Error(`No admin user ${email}`);
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
	const password = process.env.NEW_PASSWORD || [...crypto.getRandomValues(new Uint8Array(18))].map((b) => alphabet[b % alphabet.length]).join('');
	await db
		.update(schema.adminUsers)
		.set({
			passwordHash: await hashPassword(password),
			active: true,
			...(flags.includes('--keep-2fa') ? {} : { totpSecret: null, totpEnabledAt: null, recoveryCodes: null }),
			updatedAt: new Date()
		})
		.where(eq(schema.adminUsers.id, user.id));
	await db.delete(schema.sessions).where(and(eq(schema.sessions.userType, 'admin'), eq(schema.sessions.userId, user.id)));
	await db.delete(schema.rateLimits);
	await db.insert(schema.auditLog).values({ action: 'reset_credentials_cli', entity: 'admin_user', entityId: user.id, actorName: 'CLI' });
	console.log(`✓ ${email}: new password (shown once): ${password}${flags.includes('--keep-2fa') ? '' : ' — 2FA will be re-enrolled at next login'}`);
} finally {
	await pool.end();
}
