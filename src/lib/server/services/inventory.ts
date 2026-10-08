/**
 * Inventory (P1-04). Every stock change goes through `applyStockDelta()`: one conditional UPDATE
 * (`stock + delta >= 0`, backed by the `variants_stock_nonneg` CHECK constraint) plus a
 * `stock_movements` row, so stock can never go negative and every change is traceable.
 */
import { and, asc, desc, eq, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { categories, products, stockMovements, variants } from '../db/schema.ts';
import { audit } from './audit.ts';
import type { StockAdjustInput } from '#lib/schemas/inventory.ts';

type Actor = Pick<App.Locals, 'admin' | 'ip'>;
export type StockReason = (typeof stockMovements.$inferInsert)['reason'];

export class StockError extends Error {}

/**
 * Atomically adds `delta` to a variant's stock and logs the movement. Throws StockError when the
 * result would be negative (or the variant does not exist). Returns the new stock level.
 */
export async function applyStockDelta(
	db: Executor,
	m: { variantId: string; delta: number; reason: StockReason; note?: string | null; refId?: string | null; actor?: string | null }
): Promise<number> {
	if (!Number.isInteger(m.delta)) throw new StockError('Ongeldig aantal');
	const [row] = await db
		.update(variants)
		.set({ stock: sql`${variants.stock} + ${m.delta}`, updatedAt: new Date() })
		.where(and(eq(variants.id, m.variantId), sql`${variants.stock} + ${m.delta} >= 0`))
		.returning({ stock: variants.stock });
	if (!row) {
		const [exists] = await db.select({ stock: variants.stock }).from(variants).where(eq(variants.id, m.variantId));
		if (!exists) throw new StockError('Variant niet gevonden');
		throw new StockError(`Voorraad kan niet negatief worden (huidig: ${exists.stock}, wijziging: ${m.delta})`);
	}
	if (m.delta !== 0) {
		await db.insert(stockMovements).values({
			variantId: m.variantId,
			delta: m.delta,
			reason: m.reason,
			note: m.note ?? null,
			refId: m.refId ?? null,
			actor: m.actor ?? null
		});
	}
	return row.stock;
}

/** Manual adjustment from /admin/inventory (reason required). */
export async function adjustStock(db: Executor, actor: Actor, input: StockAdjustInput) {
	const stock = await applyStockDelta(db, {
		variantId: input.variantId,
		delta: input.delta,
		reason: input.reason,
		note: input.note,
		actor: actor.admin?.name ?? null
	});
	await audit(db, actor, {
		action: 'stock.adjust',
		entity: 'variant',
		entityId: input.variantId,
		diff: { delta: input.delta, reason: input.reason, note: input.note, stock }
	});
	return stock;
}

export const INVENTORY_SORTS = ['sku', 'product', 'stock', 'threshold', 'updated'] as const;
export type InventorySort = (typeof INVENTORY_SORTS)[number];

export interface InventoryParams {
	q?: string;
	low?: boolean;
	out?: boolean;
	category?: string;
	sort?: InventorySort;
	dir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

const primaryImage = sql<string | null>`(select m.storage_key from product_images pi join media m on m.id = pi.media_id
	where pi.product_id = "products"."id" order by pi.position limit 1)`;

export async function listInventory(db: Executor, p: InventoryParams = {}) {
	const pageSize = p.pageSize ?? 50;
	const page = Math.max(1, p.page ?? 1);
	const conds: (SQL | undefined)[] = [sql`${products.status} <> 'archived'`];
	if (p.q) {
		const like = `%${p.q}%`;
		conds.push(or(ilike(variants.sku, like), sql`${products.name}->>'nl' ilike ${like}`, ilike(products.slug, like)));
	}
	if (p.low) conds.push(lte(variants.stock, variants.lowStockThreshold));
	if (p.out) conds.push(eq(variants.stock, 0));
	if (p.category) conds.push(eq(products.categoryId, p.category));
	const where = and(...conds);
	const dirFn = p.dir === 'asc' ? asc : desc;
	const sortCol = {
		sku: variants.sku,
		product: sql`${products.name}->>'nl'`,
		stock: variants.stock,
		threshold: variants.lowStockThreshold,
		updated: variants.updatedAt
	}[p.sort ?? 'stock'];
	const order = p.sort ? [dirFn(sortCol), asc(variants.sku)] : [asc(variants.stock), asc(variants.sku)];

	const [rows, [{ n }]] = await Promise.all([
		db
			.select({
				id: variants.id,
				sku: variants.sku,
				metal: variants.metal,
				size: variants.size,
				stock: variants.stock,
				threshold: variants.lowStockThreshold,
				updatedAt: variants.updatedAt,
				productId: products.id,
				product: sql<string>`${products.name}->>'nl'`,
				status: products.status,
				category: sql<string>`${categories.name}->>'nl'`,
				image: primaryImage
			})
			.from(variants)
			.innerJoin(products, eq(products.id, variants.productId))
			.innerJoin(categories, eq(categories.id, products.categoryId))
			.where(where)
			.orderBy(...order)
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(variants)
			.innerJoin(products, eq(products.id, variants.productId))
			.where(where)
	]);
	return { rows, total: n, page, pageSize };
}

export async function recentMovements(db: Executor, limit = 15) {
	return db
		.select({
			id: stockMovements.id,
			sku: variants.sku,
			delta: stockMovements.delta,
			reason: stockMovements.reason,
			note: stockMovements.note,
			actor: stockMovements.actor,
			createdAt: stockMovements.createdAt
		})
		.from(stockMovements)
		.innerJoin(variants, eq(variants.id, stockMovements.variantId))
		.orderBy(desc(stockMovements.createdAt))
		.limit(limit);
}
