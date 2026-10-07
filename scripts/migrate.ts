/** `npm run db:migrate` — applies drizzle/*.sql to DATABASE_URL (or the URL passed as argv[2]). */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DATABASE_URL } from './env.ts';

const url = process.argv[2] ?? DATABASE_URL;
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
	await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
	console.log(`✓ migrations applied to ${new URL(url).pathname.slice(1)}`);
} finally {
	await pool.end();
}
