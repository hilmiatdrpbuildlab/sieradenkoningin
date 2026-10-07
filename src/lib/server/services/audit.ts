/** Append-only audit trail. Every admin mutation calls `audit()` (EXECUTION_PLAN §2.4). */
import type { Executor } from '../db/index.ts';
import { auditLog } from '../db/schema.ts';

export interface AuditInput {
	action: string; // create | update | delete | archive | login | refund …
	entity: string; // product | order | discount …
	entityId?: string | null;
	diff?: unknown;
}

export async function audit(db: Executor, locals: Pick<App.Locals, 'admin' | 'ip'>, input: AuditInput) {
	await db.insert(auditLog).values({
		actorId: locals.admin?.id ?? null,
		actorName: locals.admin?.name ?? null,
		action: input.action,
		entity: input.entity,
		entityId: input.entityId ?? null,
		diff: input.diff ?? null,
		ip: locals.ip ?? null
	});
}

/** Shallow diff of two plain objects: { field: [before, after] } for changed fields only. */
export function diffObjects(before: Record<string, unknown> | null | undefined, after: Record<string, unknown>) {
	const out: Record<string, [unknown, unknown]> = {};
	for (const key of Object.keys(after)) {
		const a = before?.[key];
		const b = after[key];
		if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = [a ?? null, b ?? null];
	}
	return out;
}
