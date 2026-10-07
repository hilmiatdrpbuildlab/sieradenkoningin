/** Fixed-window rate limiter backed by the `rate_limits` table (shared across Worker isolates). */
import { eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { rateLimits } from '../db/schema.ts';

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: Date;
}

export async function rateLimit(db: Executor, key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
	const resetAt = new Date(Date.now() + windowSec * 1000).toISOString();
	const [row] = await db
		.insert(rateLimits)
		.values({ key, count: 1, resetAt: new Date(resetAt) })
		.onConflictDoUpdate({
			target: rateLimits.key,
			set: {
				count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
				resetAt: sql`case when ${rateLimits.resetAt} < now() then ${resetAt}::timestamptz else ${rateLimits.resetAt} end`
			}
		})
		.returning();
	return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}

export async function resetRateLimit(db: Executor, key: string) {
	await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Best-effort client IP (Cloudflare header first). */
export function clientIp(request: Request, fallback = 'unknown') {
	return (
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		fallback
	);
}
