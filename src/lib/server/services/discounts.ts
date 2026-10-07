/**
 * Discount engine (P2-02). Pure evaluation (`evaluateDiscount`) is unit-tested for every rule;
 * `lookupDiscount` adds the usage counts from the database. Max 1 code per cart (no stacking).
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { discountRedemptions, discounts, orders } from '../db/schema.ts';

export type DiscountRow = typeof discounts.$inferSelect;

export type DiscountFailure = 'not_found' | 'inactive' | 'not_started' | 'expired' | 'min_subtotal' | 'usage_limit' | 'customer_limit';

export type DiscountResult =
	| { ok: true; code: string; type: DiscountRow['type']; amount: number; freeShipping: boolean }
	| { ok: false; reason: DiscountFailure; minSubtotal?: number };

export interface DiscountContext {
	subtotal: number; // cents
	now?: Date;
	totalUses?: number;
	customerUses?: number;
}

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

export function evaluateDiscount(d: DiscountRow | null | undefined, ctx: DiscountContext): DiscountResult {
	const now = ctx.now ?? new Date();
	if (!d) return { ok: false, reason: 'not_found' };
	if (!d.active) return { ok: false, reason: 'inactive' };
	if (d.startsAt && d.startsAt > now) return { ok: false, reason: 'not_started' };
	if (d.endsAt && d.endsAt <= now) return { ok: false, reason: 'expired' };
	if (d.usageLimit != null && (ctx.totalUses ?? 0) >= d.usageLimit) return { ok: false, reason: 'usage_limit' };
	if (d.perCustomerLimit != null && (ctx.customerUses ?? 0) >= d.perCustomerLimit) return { ok: false, reason: 'customer_limit' };
	if (d.minSubtotal != null && ctx.subtotal < d.minSubtotal) return { ok: false, reason: 'min_subtotal', minSubtotal: d.minSubtotal };

	let amount = 0;
	if (d.type === 'percent') amount = Math.round((ctx.subtotal * Math.min(100, Math.max(0, d.value))) / 100);
	else if (d.type === 'amount') amount = Math.min(d.value, ctx.subtotal);
	return { ok: true, code: d.code, type: d.type, amount: Math.max(0, Math.min(amount, ctx.subtotal)), freeShipping: d.type === 'free_shipping' };
}

/** Loads the code plus its usage counts (paid / non-cancelled orders only). */
export async function lookupDiscount(db: Executor, code: string, email?: string | null) {
	const [d] = await db.select().from(discounts).where(eq(discounts.code, normalizeCode(code)));
	if (!d) return { discount: null, totalUses: 0, customerUses: 0 };
	const countable = sql`${orders.paymentStatus} in ('paid', 'partially_refunded', 'refunded')`;
	const [{ total }] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(discountRedemptions)
		.innerJoin(orders, eq(orders.id, discountRedemptions.orderId))
		.where(and(eq(discountRedemptions.discountId, d.id), countable));
	let customerUses = 0;
	if (email) {
		const [{ n }] = await db
			.select({ n: sql<number>`count(*)::int` })
			.from(discountRedemptions)
			.innerJoin(orders, eq(orders.id, discountRedemptions.orderId))
			.where(and(eq(discountRedemptions.discountId, d.id), eq(discountRedemptions.email, email.toLowerCase()), countable));
		customerUses = n;
	}
	return { discount: d, totalUses: total, customerUses };
}
