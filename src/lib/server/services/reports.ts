/**
 * Sales aggregation for the dashboard and reports (P3-08).
 * Definitions (single source of truth, unit-tested to reconcile with order totals):
 *  - A sale = an order whose payment_status is paid / partially_refunded / refunded.
 *  - Gross revenue = sum(orders.total); net revenue = gross − sum(orders.refunded_total).
 *  - Days/months are bucketed in Europe/Brussels.
 */
import { and, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { categories, discountRedemptions, discounts, orderLines, orders, products } from '../db/schema.ts';

export const TZ = 'Europe/Brussels';
/** Inlined literal: a bound parameter would make GROUP BY and SELECT expressions differ ($1 vs $4). */
const TZ_SQL = sql.raw(`'${TZ}'`);
export const SOLD = sql`${orders.paymentStatus} in ('paid','partially_refunded','refunded')`;

export interface Range {
	from: Date; // inclusive
	to: Date; // exclusive
}

const inRange = (r: Range): SQL => and(SOLD, gte(orders.paidAt, r.from), lt(orders.paidAt, r.to))!;

export interface Summary {
	orders: number;
	gross: number;
	refunded: number;
	net: number;
	aov: number;
	vat: number;
	units: number;
}

export async function summary(db: Executor, r: Range): Promise<Summary> {
	const [row] = await db
		.select({
			orders: sql<number>`count(*)::int`,
			gross: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
			refunded: sql<number>`coalesce(sum(${orders.refundedTotal}), 0)::int`,
			vat: sql<number>`coalesce(sum(${orders.vatTotal}), 0)::int`
		})
		.from(orders)
		.where(inRange(r));
	const [{ units }] = await db
		.select({ units: sql<number>`coalesce(sum(${orderLines.qty}), 0)::int` })
		.from(orderLines)
		.innerJoin(orders, eq(orders.id, orderLines.orderId))
		.where(inRange(r));
	const net = row.gross - row.refunded;
	return { ...row, units, net, aov: row.orders ? Math.round(row.gross / row.orders) : 0 };
}

/** Relative change vs the previous period of equal length (null when the base is 0). */
export function delta(current: number, previous: number): number | undefined {
	if (!previous) return undefined;
	return (current - previous) / previous;
}

export function previousRange(r: Range): Range {
	const len = r.to.getTime() - r.from.getTime();
	return { from: new Date(r.from.getTime() - len), to: r.from };
}

/** Last `days` days ending now (rolling window). */
export function lastDays(days: number, now = new Date()): Range {
	return { from: new Date(now.getTime() - days * 86400_000), to: now };
}

export async function byDay(db: Executor, r: Range) {
	const day = sql<string>`to_char(${orders.paidAt} at time zone ${TZ_SQL}, 'YYYY-MM-DD')`;
	const rows = await db
		.select({ day, orders: sql<number>`count(*)::int`, gross: sql<number>`sum(${orders.total})::int`, net: sql<number>`sum(${orders.total} - ${orders.refundedTotal})::int` })
		.from(orders)
		.where(inRange(r))
		.groupBy(day)
		.orderBy(day);
	// Fill gaps so charts show zero days.
	const out: { day: string; orders: number; gross: number; net: number }[] = [];
	const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
	for (let t = r.from.getTime(); t < r.to.getTime(); t += 86400_000) {
		const key = fmt.format(new Date(t));
		if (out.at(-1)?.day === key) continue;
		out.push(rows.find((x) => x.day === key) ?? { day: key, orders: 0, gross: 0, net: 0 });
	}
	return out;
}

/** Merchandise sales per category (line totals after line discount). */
export async function byCategory(db: Executor, r: Range) {
	return db
		.select({
			key: categories.key,
			name: categories.name,
			units: sql<number>`sum(${orderLines.qty})::int`,
			revenue: sql<number>`sum(${orderLines.lineTotal} - ${orderLines.discountAmount})::int`
		})
		.from(orderLines)
		.innerJoin(orders, eq(orders.id, orderLines.orderId))
		.leftJoin(products, eq(products.id, orderLines.productId))
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.where(inRange(r))
		.groupBy(categories.key, categories.name)
		.orderBy(desc(sql`sum(${orderLines.lineTotal} - ${orderLines.discountAmount})`));
}

export async function topProducts(db: Executor, r: Range, limit = 10) {
	return db
		.select({
			productId: orderLines.productId,
			name: sql<{ nl: string; fr?: string }>`(array_agg(${orderLines.name}))[1]`,
			units: sql<number>`sum(${orderLines.qty})::int`,
			revenue: sql<number>`sum(${orderLines.lineTotal} - ${orderLines.discountAmount})::int`
		})
		.from(orderLines)
		.innerJoin(orders, eq(orders.id, orderLines.orderId))
		.where(inRange(r))
		.groupBy(orderLines.productId)
		.orderBy(desc(sql`sum(${orderLines.qty})`))
		.limit(limit);
}

/** VAT report per month: gross incl. VAT, VAT, net excl. VAT (21%). Refunds reported separately. */
export async function vatByMonth(db: Executor, r: Range) {
	const month = sql<string>`to_char(${orders.paidAt} at time zone ${TZ_SQL}, 'YYYY-MM')`;
	const rows = await db
		.select({
			month,
			orders: sql<number>`count(*)::int`,
			gross: sql<number>`sum(${orders.total})::int`,
			vat: sql<number>`sum(${orders.vatTotal})::int`,
			refunded: sql<number>`sum(${orders.refundedTotal})::int`
		})
		.from(orders)
		.where(inRange(r))
		.groupBy(month)
		.orderBy(month);
	return rows.map((x) => ({ ...x, netExVat: x.gross - x.vat }));
}

export async function discountPerformance(db: Executor, r: Range) {
	return db
		.select({
			code: discounts.code,
			type: discounts.type,
			uses: sql<number>`count(*)::int`,
			discount: sql<number>`sum(${orders.discountTotal})::int`,
			revenue: sql<number>`sum(${orders.total})::int`
		})
		.from(discountRedemptions)
		.innerJoin(discounts, eq(discounts.id, discountRedemptions.discountId))
		.innerJoin(orders, eq(orders.id, discountRedemptions.orderId))
		.where(inRange(r))
		.groupBy(discounts.code, discounts.type)
		.orderBy(desc(sql`count(*)`));
}

/** Orders waiting for fulfilment (paid, not yet processed). */
export async function toProcess(db: Executor, limit = 8) {
	return db
		.select({ id: orders.id, number: orders.number, email: orders.email, total: orders.total, placedAt: orders.placedAt, status: orders.status, shippingMethod: orders.shippingMethod })
		.from(orders)
		.where(eq(orders.status, 'paid'))
		.orderBy(orders.placedAt)
		.limit(limit);
}

/** CSV helper for report exports (RFC 4180 quoting, ; separator for Belgian Excel). */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[], sep = ';') {
	const q = (v: unknown) => {
		const s = v == null ? '' : String(v);
		return /["\n\r;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	return '﻿' + [columns.map((c) => q(c.label)).join(sep), ...rows.map((r) => columns.map((c) => q(r[c.key])).join(sep))].join('\r\n') + '\r\n';
}

/** Cents → "49,95" (Belgian Excel decimal comma). */
export const csvMoney = (cents: number | null | undefined) => ((cents ?? 0) / 100).toFixed(2).replace('.', ',');
