/**
 * Stock reservations (P2-05). A checkout reserves its units for RESERVATION_TTL_MS inside the same
 * transaction that creates the order; real stock is only decremented when the order is paid
 * (services/orders.ts → applyPaymentStatus). Reservations are released when the payment fails or
 * expires, and expired ones are swept by the cron (`POST /api/jobs`).
 *
 * Lock order matters: the variant rows are locked FIRST, before any insert that references them
 * (an FK insert takes a KEY SHARE lock, which would turn two checkouts into a deadlock).
 *
 * Concurrency: `lockAndCheck` takes `SELECT … FOR UPDATE` row locks on the variants (in id order,
 * so two checkouts never deadlock). A competing checkout for the same variant waits for the lock
 * and then — READ COMMITTED gives every statement a fresh snapshot — sees the reservation the
 * first one committed, so the last unit can only be reserved once.
 */
import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import type { Executor, Tx } from '../db/index.ts';
import { stockReservations } from '../db/schema.ts';

export const RESERVATION_TTL_MS = 15 * 60_000;

export interface ReserveLine {
	variantId: string;
	qty: number;
}

export interface StockShortage {
	variantId: string;
	requested: number;
	available: number;
}

export class InsufficientStockError extends Error {
	constructor(public shortages: StockShortage[]) {
		super(`Insufficient stock for ${shortages.length} line(s)`);
		this.name = 'InsufficientStockError';
	}
}

/** Sums quantities per variant (a cart can hold the same variant twice, e.g. with/without engraving). */
export function groupQty(lines: ReserveLine[]): Map<string, number> {
	const out = new Map<string, number>();
	for (const l of lines) out.set(l.variantId, (out.get(l.variantId) ?? 0) + l.qty);
	return out;
}

/**
 * Locks the variant rows and returns the available units per variant
 * (stock − active reservations held by OTHER carts). Must run inside a transaction.
 */
export async function lockAndCheck(tx: Tx, lines: ReserveLine[], cartId: string): Promise<StockShortage[]> {
	const wanted = groupQty(lines);
	const ids = [...wanted.keys()].sort();
	if (!ids.length) return [];
	const locked = await tx.execute<{ id: string; stock: number }>(
		sql`select id, stock from variants where id in (${sql.join(
			ids.map((id) => sql`${id}::uuid`),
			sql`, `
		)}) order by id for update`
	);
	const reserved = await tx
		.select({ variantId: stockReservations.variantId, qty: sql<number>`sum(${stockReservations.qty})::int` })
		.from(stockReservations)
		.where(
			and(
				inArray(stockReservations.variantId, ids),
				sql`${stockReservations.expiresAt} > now()`,
				ne(stockReservations.cartId, cartId)
			)
		)
		.groupBy(stockReservations.variantId);
	const held = new Map(reserved.map((r) => [r.variantId, r.qty]));
	const stock = new Map(locked.rows.map((r) => [r.id, Number(r.stock)]));
	const shortages: StockShortage[] = [];
	for (const id of ids) {
		const available = Math.max(0, (stock.get(id) ?? 0) - (held.get(id) ?? 0));
		const requested = wanted.get(id)!;
		if (requested > available) shortages.push({ variantId: id, requested, available });
	}
	return shortages;
}

/**
 * Locks, verifies and reserves in one go (inside the caller's transaction). Any earlier reservation
 * of the same cart is replaced. Throws InsufficientStockError — the caller's transaction rolls back.
 */
export async function reserveStock(
	tx: Tx,
	input: { cartId: string; orderId: string; lines: ReserveLine[]; ttlMs?: number }
) {
	const shortages = await lockAndCheck(tx, input.lines, input.cartId);
	if (shortages.length) throw new InsufficientStockError(shortages);
	return insertReservations(tx, input);
}

/**
 * Writes the reservation rows (replacing earlier ones of the same cart). Call only after
 * `lockAndCheck` succeeded in the same transaction.
 */
export async function insertReservations(
	tx: Tx,
	input: { cartId: string; orderId: string; lines: ReserveLine[]; ttlMs?: number }
) {
	await tx.delete(stockReservations).where(eq(stockReservations.cartId, input.cartId));
	const expiresAt = new Date(Date.now() + (input.ttlMs ?? RESERVATION_TTL_MS));
	const rows = [...groupQty(input.lines)].map(([variantId, qty]) => ({
		variantId,
		qty,
		cartId: input.cartId,
		orderId: input.orderId,
		expiresAt
	}));
	if (rows.length) await tx.insert(stockReservations).values(rows);
	return expiresAt;
}

/** Releases every reservation of an order (payment failed / cancelled / paid → consumed). */
export async function releaseReservations(db: Executor, orderId: string) {
	const rows = await db
		.delete(stockReservations)
		.where(eq(stockReservations.orderId, orderId))
		.returning({ id: stockReservations.id });
	return rows.length;
}

/** Cron: drops reservations past their TTL. Returns how many were released. */
export async function releaseExpiredReservations(db: Executor, now = new Date()) {
	const rows = await db
		.delete(stockReservations)
		.where(lt(stockReservations.expiresAt, now))
		.returning({ id: stockReservations.id });
	return rows.length;
}
