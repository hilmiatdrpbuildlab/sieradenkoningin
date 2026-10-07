/**
 * `npm run db:seed` — idempotent seed. Flags: `--no-demo` (structure only, for production),
 * `--url <postgres url>` (target another database).
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DATABASE_URL } from './env.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import { seed } from '../src/lib/server/db/seed.ts';
import { createStorage } from '../src/lib/server/adapters/storage.ts';

const args = process.argv.slice(2);
const urlArg = args.indexOf('--url');
const url = urlArg >= 0 ? args[urlArg + 1] : DATABASE_URL;
const e = process.env;

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
	const db = drizzle(pool, { schema });
	const storage = createStorage({
		STORAGE_ENDPOINT: e.STORAGE_ENDPOINT ?? '',
		STORAGE_BUCKET: e.STORAGE_BUCKET ?? '',
		STORAGE_ACCESS_KEY_ID: e.STORAGE_ACCESS_KEY_ID ?? '',
		STORAGE_SECRET_ACCESS_KEY: e.STORAGE_SECRET_ACCESS_KEY ?? '',
		STORAGE_REGION: e.STORAGE_REGION ?? 'auto',
		PUBLIC_MEDIA_URL: e.PUBLIC_MEDIA_URL ?? '',
		SESSION_SECRET: e.SESSION_SECRET ?? ''
	});
	const { adminPassword } = await seed(db, storage, {
		demo: !args.includes('--no-demo'),
		adminEmail: e.SEED_ADMIN_EMAIL || 'owner@example.invalid',
		adminPassword: e.SEED_ADMIN_PASSWORD || undefined,
		log: (m) => console.log(m)
	});
	if (adminPassword) {
		console.log('\n────────────────────────────────────────────────────────');
		console.log(` Owner login: ${e.SEED_ADMIN_EMAIL || 'owner@example.invalid'}`);
		console.log(` Password (shown ONCE): ${adminPassword}`);
		console.log(' 2FA enrolment is required at first login: /admin/login');
		console.log('────────────────────────────────────────────────────────\n');
	}
} finally {
	await pool.end();
}
