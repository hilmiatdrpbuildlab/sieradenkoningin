/**
 * Playwright global setup: when testing a local build (no E2E_BASE_URL), migrate + seed the database
 * and upsert the e2e owner with a known password and TOTP secret (see fixtures.ts).
 */
import { existsSync } from 'node:fs';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/lib/server/db/schema.ts';
import { seed } from '../../src/lib/server/db/seed.ts';
import { createStorage } from '../../src/lib/server/adapters/storage.ts';
import { hashPassword } from '../../src/lib/server/auth/password.ts';
import { encrypt } from '../../src/lib/server/crypto.ts';
import { E2E_ADMIN } from './fixtures.ts';

export default async function globalSetup() {
	if (process.env.E2E_BASE_URL && !/localhost|127.0.0.1/.test(process.env.E2E_BASE_URL)) return;
	if (existsSync('.env')) process.loadEnvFile('.env');
	const url = process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin';
	const key = process.env.TOTP_ENC_KEY;
	if (!key) throw new Error('TOTP_ENC_KEY is required for e2e (see .env.example)');
	const pool = new pg.Pool({ connectionString: url, max: 1 });
	try {
		const db = drizzle(pool, { schema });
		await migrate(db, { migrationsFolder: './drizzle' });
		const storage = createStorage({
			STORAGE_ENDPOINT: '',
			STORAGE_BUCKET: '',
			STORAGE_ACCESS_KEY_ID: '',
			STORAGE_SECRET_ACCESS_KEY: '',
			PUBLIC_MEDIA_URL: process.env.PUBLIC_MEDIA_URL ?? '',
			SESSION_SECRET: process.env.SESSION_SECRET ?? ''
		});
		await seed(db, storage, { demo: true });
		const values = {
			email: E2E_ADMIN.email,
			name: 'E2E Eigenaar',
			role: 'owner' as const,
			active: true,
			passwordHash: await hashPassword(E2E_ADMIN.password),
			totpSecret: await encrypt(E2E_ADMIN.totpSecret, key),
			totpEnabledAt: new Date()
		};
		const [existing] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, E2E_ADMIN.email));
		if (existing) await db.update(schema.adminUsers).set(values).where(eq(schema.adminUsers.id, existing.id));
		else await db.insert(schema.adminUsers).values(values);
		await db.delete(schema.rateLimits);
		await db.insert(schema.settings).values({ key: 'maintenance', value: { enabled: false } }).onConflictDoUpdate({ target: schema.settings.key, set: { value: { enabled: false } } });
	} finally {
		await pool.end();
	}
}
