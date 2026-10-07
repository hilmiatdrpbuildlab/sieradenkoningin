/**
 * Database connection.
 *
 * Driver decision (deviates from §2.4 "neon-http", logged in §12): we use node-postgres (`pg`)
 * through `drizzle-orm/node-postgres` everywhere. `pg` runs on Cloudflare Workers with the
 * `nodejs_compat` flag and connects to Neon's pooled endpoint (or Hyperdrive) over TCP, and it
 * also talks to a plain local Postgres. One driver gives us real interactive transactions
 * (`db.transaction`, `SELECT … FOR UPDATE`) for checkout, the same code path in dev, tests and
 * production, and no WebSocket proxy for local development.
 *
 * A pool is created per request and closed when the response is done (hooks.server.ts), so no
 * connection state is shared between requests on Workers.
 */
import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
/** Anything that can run queries: the db itself or an open transaction. */
export type Executor = DB | Tx;

export function createDb(databaseUrl: string, max = 5) {
	const pool = new pg.Pool({ connectionString: databaseUrl, max, idleTimeoutMillis: 5_000 });
	const db = drizzle(pool, { schema });
	return { db, close: () => pool.end() };
}

export { schema };
