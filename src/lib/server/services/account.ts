/**
 * Customer account area (P3-02): orders, address book (exactly one default), profile, newsletter
 * preference (opt-in goes through the double opt-in of services/newsletter.ts), GDPR export/delete.
 * Every query is scoped by the logged-in customer's id — a customer can never reach another's data.
 */
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { DB, Executor } from '../db/index.ts';
import { addresses, customers, newsletterSubscribers, orderLines, orders } from '../db/schema.ts';
import type { NewsletterAdapter } from '../adapters/newsletter.ts';
import { verifyPassword } from '../auth/password.ts';
import { anonymizeCustomer } from './customers.ts';
import { orderProgress } from './tracking.ts';
import { tr } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/paths.ts';

export const MAX_ADDRESSES = 20;

// ── Orders ─────────────────────────────────────────────────────────────────────

export async function listCustomerOrders(db: Executor, customerId: string, opts: { limit?: number; offset?: number } = {}) {
	const rows = await db
		.select({
			number: orders.number,
			status: orders.status,
			paymentStatus: orders.paymentStatus,
			total: orders.total,
			placedAt: orders.placedAt,
			items: sql<number>`(select coalesce(sum(qty), 0)::int from order_lines where order_lines.order_id = ${sql.raw('"orders"."id"')})`
		})
		.from(orders)
		.where(eq(orders.customerId, customerId))
		.orderBy(desc(orders.placedAt))
		.limit(opts.limit ?? 50)
		.offset(opts.offset ?? 0);
	return rows.map((r) => ({ ...r, placedAt: r.placedAt.toISOString() }));
}

export async function countCustomerOrders(db: Executor, customerId: string) {
	const [r] = await db.select({ n: count() }).from(orders).where(eq(orders.customerId, customerId));
	return r?.n ?? 0;
}

export async function customerOrderDetail(db: Executor, customerId: string, number: string, lang: Lang) {
	const [order] = await db
		.select()
		.from(orders)
		.where(and(eq(orders.customerId, customerId), eq(orders.number, number)));
	if (!order) return null;
	const [lines, progress] = await Promise.all([
		db.select().from(orderLines).where(eq(orderLines.orderId, order.id)),
		orderProgress(db, order)
	]);
	return {
		number: order.number,
		status: order.status,
		paymentStatus: order.paymentStatus,
		placedAt: order.placedAt.toISOString(),
		paymentMethod: order.paymentMethod,
		shippingMethod: order.shippingMethod,
		shippingAddress: order.shippingAddress,
		billingAddress: order.billingAddress,
		servicePoint: order.servicePoint,
		giftWrap: order.giftWrap,
		giftMessage: order.giftMessage,
		discountCode: order.discountCode,
		invoiceNumber: order.invoiceNumber,
		totals: {
			subtotal: order.subtotal,
			discount: order.discountTotal,
			shipping: order.shippingTotal,
			vat: order.vatTotal,
			total: order.total,
			refunded: order.refundedTotal
		},
		lines: lines.map((l) => ({
			name: tr(l.name, lang),
			variantLabel: tr(l.variantLabel, lang),
			qty: l.qty,
			lineTotal: l.lineTotal,
			imageKey: l.imageKey,
			engraving: l.engraving?.text ?? null
		})),
		timeline: progress.timeline,
		shipments: progress.shipments
	};
}

// ── Addresses ──────────────────────────────────────────────────────────────────

export type AddressInput = {
	name: string;
	company: string;
	line1: string;
	line2: string;
	postalCode: string;
	city: string;
	country: string;
	phone: string;
	isDefault: boolean;
};

export async function listAddresses(db: Executor, customerId: string) {
	return db
		.select()
		.from(addresses)
		.where(eq(addresses.customerId, customerId))
		.orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

/** Makes `addressId` (owned by the customer) the only default (one UPDATE → atomic). */
export async function setDefaultAddress(db: Executor, customerId: string, addressId: string) {
	const [owned] = await db
		.select({ id: addresses.id })
		.from(addresses)
		.where(and(eq(addresses.id, addressId), eq(addresses.customerId, customerId)));
	if (!owned) return false;
	const rows = await db
		.update(addresses)
		.set({ isDefault: sql`${addresses.id} = ${addressId}` })
		.where(eq(addresses.customerId, customerId))
		.returning({ id: addresses.id, isDefault: addresses.isDefault });
	return rows.some((r) => r.id === addressId && r.isDefault);
}

/** Create (no id) or update (id owned by the customer). The first address is always the default. */
export async function saveAddress(
	db: DB,
	customerId: string,
	id: string | undefined,
	input: AddressInput
): Promise<{ ok: true; id: string } | { ok: false; reason: 'not_found' | 'limit' }> {
	return db.transaction(async (tx) => {
		const values = {
			name: input.name,
			company: input.company || null,
			line1: input.line1,
			line2: input.line2 || null,
			postalCode: input.postalCode.toUpperCase(),
			city: input.city,
			country: input.country,
			phone: input.phone || null
		};
		let addressId: string;
		if (id) {
			const [row] = await tx
				.update(addresses)
				.set(values)
				.where(and(eq(addresses.id, id), eq(addresses.customerId, customerId)))
				.returning({ id: addresses.id });
			if (!row) return { ok: false as const, reason: 'not_found' as const };
			addressId = row.id;
		} else {
			const [{ n }] = await tx.select({ n: count() }).from(addresses).where(eq(addresses.customerId, customerId));
			if (n >= MAX_ADDRESSES) return { ok: false as const, reason: 'limit' as const };
			const [row] = await tx
				.insert(addresses)
				.values({ ...values, customerId })
				.returning({ id: addresses.id });
			addressId = row.id;
		}
		const [{ defaults }] = await tx
			.select({ defaults: sql<number>`count(*) filter (where ${addresses.isDefault})::int` })
			.from(addresses)
			.where(eq(addresses.customerId, customerId));
		if (input.isDefault || defaults === 0) await setDefaultAddress(tx, customerId, addressId);
		return { ok: true as const, id: addressId };
	});
}

/** Deletes an address; when it was the default, the most recent remaining address becomes default. */
export async function deleteAddress(db: DB, customerId: string, id: string) {
	return db.transaction(async (tx) => {
		const [gone] = await tx
			.delete(addresses)
			.where(and(eq(addresses.id, id), eq(addresses.customerId, customerId)))
			.returning();
		if (!gone) return false;
		if (gone.isDefault) {
			const [next] = await tx
				.select({ id: addresses.id })
				.from(addresses)
				.where(eq(addresses.customerId, customerId))
				.orderBy(desc(addresses.createdAt))
				.limit(1);
			if (next) await setDefaultAddress(tx, customerId, next.id);
		}
		return true;
	});
}

// ── Profile & password ─────────────────────────────────────────────────────────

export async function getProfile(db: Executor, customerId: string) {
	const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
	if (!c) return null;
	const [nl] = await db
		.select({ status: newsletterSubscribers.status })
		.from(newsletterSubscribers)
		.where(eq(newsletterSubscribers.email, c.email));
	return {
		email: c.email,
		firstName: c.firstName ?? '',
		lastName: c.lastName ?? '',
		phone: c.phone ?? '',
		locale: (c.locale === 'fr' ? 'fr' : 'nl') as Lang,
		verified: !!c.emailVerifiedAt,
		hasPassword: !!c.passwordHash,
		newsletter: (nl?.status ?? 'none') as 'none' | 'pending' | 'confirmed' | 'unsubscribed'
	};
}

export async function updateProfile(
	db: Executor,
	customerId: string,
	input: { firstName: string; lastName: string; phone: string; locale: Lang }
) {
	await db
		.update(customers)
		.set({ firstName: input.firstName, lastName: input.lastName, phone: input.phone || null, locale: input.locale, updatedAt: new Date() })
		.where(eq(customers.id, customerId));
}

export async function checkCurrentPassword(db: Executor, customerId: string, password: string) {
	const [c] = await db.select({ hash: customers.passwordHash }).from(customers).where(eq(customers.id, customerId));
	return verifyPassword(c?.hash, password);
}

// ── Newsletter preference ──────────────────────────────────────────────────────

/** Opt-out from the account settings (opt-in uses newsletter.subscribe → double opt-in mail). */
export async function newsletterOptOut(db: Executor, adapter: NewsletterAdapter, customerId: string) {
	const [c] = await db.select({ email: customers.email }).from(customers).where(eq(customers.id, customerId));
	if (!c) return;
	const [row] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, c.email));
	await db.update(customers).set({ marketingOptIn: false, updatedAt: new Date() }).where(eq(customers.id, customerId));
	if (!row || row.status === 'unsubscribed') return;
	const wasSynced = row.status === 'confirmed' || !!row.syncedAt;
	await db
		.update(newsletterSubscribers)
		.set({ status: 'unsubscribed', updatedAt: new Date() })
		.where(eq(newsletterSubscribers.email, row.email));
	if (wasSynced) {
		try {
			await adapter.unsubscribe(row.email);
		} catch (e) {
			console.error('[account] provider unsubscribe failed', e);
		}
	}
}

// ── GDPR ───────────────────────────────────────────────────────────────────────

/**
 * Irreversible deletion (GDPR Art. 17): password re-check, then anonymisation in ONE transaction
 * (orders keep the legally required invoice data; see customers.anonymizeCustomer).
 */
export async function deleteAccount(db: DB, customerId: string, password: string): Promise<'deleted' | 'wrong_password'> {
	if (!(await checkCurrentPassword(db, customerId, password))) return 'wrong_password';
	await db.transaction(async (tx) => {
		const ok = await anonymizeCustomer(tx, customerId);
		if (!ok) throw new Error('deleteAccount: customer not found');
	});
	return 'deleted';
}
