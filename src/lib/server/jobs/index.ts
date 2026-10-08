/**
 * DB-backed job queue (table `jobs`), processed by the cron endpoint `POST /api/jobs` and, for
 * low latency, inline right after the request that enqueued them (best effort).
 *
 * Adding a job type: write a handler `(job, deps) => Promise<void>` and add it to `HANDLERS` below.
 * Handlers must be idempotent — a job can run more than once (crash after side effect, retry).
 *
 * Claiming: jobs are leased by pushing `run_at` forward inside a `FOR UPDATE SKIP LOCKED`
 * statement, so two concurrent runners never pick the same job. A failed job is retried with
 * exponential backoff and marked `failed` after MAX_ATTEMPTS.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../db/index.ts';
import { jobs } from '../db/schema.ts';
import type { EmailAdapter } from '../adapters/email.ts';
import type { PaymentsAdapter } from '../adapters/payments.ts';
import { emailSendJob } from '../services/email.ts';
import type { Storage } from '../adapters/storage.ts';
import { invoiceGenerateJob } from '../services/invoices.ts';
import { stockAlertJob } from '../services/stock-alerts.ts';

export type JobRow = typeof jobs.$inferSelect;

/** Everything a handler may need; built from `event.locals` (or test doubles). */
export interface JobDeps {
	db: DB;
	email: EmailAdapter;
	siteUrl: string;
	payments?: PaymentsAdapter;
	/** Object storage (invoice PDFs); jobs needing it fail + retry when a caller does not pass it. */
	storage?: Storage;
}

export type JobHandler = (job: JobRow, deps: JobDeps) => Promise<void>;

/** Handler registry — other modules add their job types here. */
export const HANDLERS: Record<string, JobHandler> = {
	'email.send': emailSendJob,
	'invoice.generate': invoiceGenerateJob,
	'stock.alert': stockAlertJob
};

export const MAX_ATTEMPTS = 5;

/** Enqueue a job. With a `dedupeKey` the same logical job is only ever queued once. Returns the id (or null when deduplicated). */
export async function enqueueJob(
	db: Pick<DB, 'insert'>,
	type: string,
	payload: Record<string, unknown>,
	opts: { dedupeKey?: string; runAt?: Date } = {}
): Promise<string | null> {
	const rows = await db
		.insert(jobs)
		.values({ type, payload, dedupeKey: opts.dedupeKey ?? null, runAt: opts.runAt ?? new Date() })
		.onConflictDoNothing()
		.returning({ id: jobs.id });
	return rows[0]?.id ?? null;
}

export interface RunResult {
	done: number;
	failed: number;
	retried: number;
}

/**
 * Claims and runs due jobs. `ids` restricts the run to specific jobs (inline processing right after
 * enqueueing); otherwise up to `limit` due jobs are processed.
 */
export async function runJobs(
	deps: JobDeps,
	opts: { limit?: number; ids?: string[]; handlers?: Record<string, JobHandler> } = {}
): Promise<RunResult> {
	const handlers = opts.handlers ?? HANDLERS;
	const limit = opts.limit ?? 25;
	const result: RunResult = { done: 0, failed: 0, retried: 0 };
	if (opts.ids && !opts.ids.length) return result;

	const filter = opts.ids?.length
		? sql`and id in (${sql.join(
				opts.ids.map((id) => sql`${id}::uuid`),
				sql`, `
			)})`
		: sql``;
	// Lease = backoff after attempt n: 1m, 4m, 9m, 16m … (a crashed runner's job becomes due again).
	const claimed = await deps.db.execute<{ id: string }>(sql`
		update jobs set attempts = attempts + 1, run_at = now() + make_interval(secs => 60 * (attempts + 1) * (attempts + 1))
		where id in (
			select id from jobs where status = 'queued' and run_at <= now() ${filter}
			order by run_at limit ${limit} for update skip locked
		)
		returning id`);
	const ids = claimed.rows.map((r) => r.id);
	if (!ids.length) return result;
	const rows = await deps.db.select().from(jobs).where(inArray(jobs.id, ids));

	for (const job of rows) {
		const handler = handlers[job.type];
		try {
			if (!handler) throw new Error(`No handler for job type "${job.type}"`);
			await handler(job, deps);
			await deps.db.update(jobs).set({ status: 'done', lastError: null }).where(eq(jobs.id, job.id));
			result.done++;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const final = job.attempts >= MAX_ATTEMPTS || !handler;
			await deps.db
				.update(jobs)
				.set({ status: final ? 'failed' : 'queued', lastError: message.slice(0, 2000) })
				.where(and(eq(jobs.id, job.id), eq(jobs.status, 'queued')));
			if (final) result.failed++;
			else result.retried++;
		}
	}
	return result;
}
