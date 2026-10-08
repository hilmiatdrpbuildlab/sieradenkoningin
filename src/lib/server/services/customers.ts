/**
 * Customers (P3-07) + GDPR helpers shared with the account area (P3-02):
 *  - exportCustomerData(): profile, addresses, orders (with lines), wishlist, newsletter status.
 *  - anonymizeCustomer(): irreversible. Deletes profile data, addresses, sessions, wishlist, carts and
 *    alerts; keeps orders for the legal invoice retention but strips personal fields that are not
 *    needed on the invoice (phone, gift message) and detaches them from the account.
 */
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { addresses, carts, customers, newsletterSubscribers, orderLines, orders, sessions, stockAlerts, wishlists } from '../db/schema.ts';

export const SOLD = sql`${orders.paymentStatus} in ('paid','partially_refunded','refunded')`;

export type CustomerSort = 'created' | 'name' | 'spent' | 'orders';

export async function listCustomers(db: Executor, opts: { q?: string; newsletter?: boolean; sort?: CustomerSort; dir?: 'asc' | 'desc'; page?: number; pageSize?: number }) {
	const pageSize = opts.pageSize ?? 25;
	const where: SQL[] = [sql`${customers.deletedAt} is null`];
	if (opts.q) {
		const like = `%${opts.q}%`;
		where.push(or(ilike(customers.email, like), ilike(customers.firstName, like), ilike(customers.lastName, like), ilike(customers.phone, like))!);
	}
	if (opts.newsletter) where.push(eq(customers.marketingOptIn, true));
	const spent = sql<number>`coalesce((select sum(o.total - o.refunded_total) from ${orders} o where o.customer_id = ${sql.raw('"customers"."id"')} and o.payment_status in ('paid','partially_refunded','refunded')), 0)::int`;
	const orderCount = sql<number>`(select count(*) from ${orders} o where o.customer_id = ${sql.raw('"customers"."id"')} and o.payment_status in ('paid','partially_refunded','refunded'))::int`;
	const dirFn = opts.dir === 'asc' ? asc : desc;
	const orderBy =
		opts.sort === 'name' ? [dirFn(customers.lastName), dirFn(customers.firstName)] : opts.sort === 'spent' ? [dirFn(spent)] : opts.sort === 'orders' ? [dirFn(orderCount)] : [dirFn(customers.createdAt)];
	const cond = and(...where);
	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				id: customers.id,
				email: customers.email,
				firstName: customers.firstName,
				lastName: customers.lastName,
				locale: customers.locale,
				marketingOptIn: customers.marketingOptIn,
				emailVerifiedAt: customers.emailVerifiedAt,
				createdAt: customers.createdAt,
				tags: customers.tags,
				spent,
				orders: orderCount
			})
			.from(customers)
			.where(cond)
			.orderBy(...orderBy)
			.limit(pageSize)
			.offset(((opts.page ?? 1) - 1) * pageSize),
		db.select({ total: count() }).from(customers).where(cond)
	]);
	return { rows, total, pageSize };
}

export async function getCustomer(db: Executor, id: string) {
	const [c] = await db.select().from(customers).where(eq(customers.id, id));
	if (!c) return null;
	const [addr, ords, nl] = await Promise.all([
		db.select().from(addresses).where(eq(addresses.customerId, id)).orderBy(desc(addresses.isDefault), asc(addresses.createdAt)),
		db
			.select({ id: orders.id, number: orders.number, status: orders.status, paymentStatus: orders.paymentStatus, total: orders.total, refundedTotal: orders.refundedTotal, placedAt: orders.placedAt })
			.from(orders)
			.where(or(eq(orders.customerId, id), and(sql`${orders.customerId} is null`, eq(orders.email, c.email))))
			.orderBy(desc(orders.placedAt)),
		db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, c.email))
	]);
	const sold = ords.filter((o) => ['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus));
	return {
		customer: c,
		addresses: addr,
		orders: ords,
		newsletter: nl[0]?.status ?? null,
		stats: { orders: sold.length, spent: sold.reduce((s, o) => s + o.total - o.refundedTotal, 0) }
	};
}

/** GDPR Art. 15/20 export (JSON-serialisable). */
export async function exportCustomerData(db: Executor, id: string) {
	const [c] = await db.select().from(customers).where(eq(customers.id, id));
	if (!c) return null;
	const [addr, ords, wl, nl] = await Promise.all([
		db.select().from(addresses).where(eq(addresses.customerId, id)),
		db.select().from(orders).where(or(eq(orders.customerId, id), eq(orders.email, c.email))).orderBy(asc(orders.placedAt)),
		db.select({ productId: wishlists.productId, variantId: wishlists.variantId, createdAt: wishlists.createdAt }).from(wishlists).where(eq(wishlists.customerId, id)),
		db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, c.email))
	]);
	const lines = ords.length
		? await db
				.select()
				.from(orderLines)
				.where(sql`${orderLines.orderId} in (${sql.join(ords.map((o) => sql`${o.id}`), sql`, `)})`)
		: [];
	const strip = <T extends Record<string, unknown>>(o: T, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
	return {
		exportedAt: new Date().toISOString(),
		profile: strip(c, ['passwordHash', 'notes', 'tags', 'deletedAt']),
		addresses: addr.map((a) => strip(a, ['customerId'])),
		orders: ords.map((o) => ({
			...strip(o, ['accessToken', 'cartId', 'invoiceKey', 'customerId']),
			lines: lines.filter((l) => l.orderId === o.id).map((l) => strip(l, ['orderId', 'variantId', 'productId']))
		})),
		wishlist: wl,
		newsletter: nl.map((n) => ({ email: n.email, status: n.status, locale: n.locale, confirmedAt: n.confirmedAt }))
	};
}

/** Irreversible anonymisation (GDPR Art. 17) — keeps legally required invoice data on orders. */
export async function anonymizeCustomer(db: Executor, id: string) {
	const [c] = await db.select().from(customers).where(eq(customers.id, id));
	if (!c || c.deletedAt) return false;
	const placeholder = `deleted-${id.slice(0, 8)}@anonymized.invalid`;
	await db.delete(addresses).where(eq(addresses.customerId, id));
	await db.delete(sessions).where(and(eq(sessions.userType, 'customer'), eq(sessions.userId, id)));
	await db.delete(wishlists).where(eq(wishlists.customerId, id));
	await db.delete(carts).where(eq(carts.customerId, id));
	await db.delete(stockAlerts).where(eq(stockAlerts.email, c.email));
	await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.email, c.email));
	// Orders stay for bookkeeping (invoice: name + billing address + VAT number are legally required).
	await db.update(orders).set({ customerId: null, giftMessage: null, updatedAt: new Date() }).where(eq(orders.customerId, id));
	await db
		.update(customers)
		.set({
			email: placeholder,
			passwordHash: null,
			firstName: null,
			lastName: null,
			phone: null,
			birthday: null,
			notes: null,
			tags: [],
			marketingOptIn: false,
			deletedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(customers.id, id));
	return true;
}
