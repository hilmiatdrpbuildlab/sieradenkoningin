/** GDPR export contains profile, addresses, orders, wishlist; deletion anonymises but keeps invoices. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq, like } from 'drizzle-orm';
import * as s from '#lib/server/db/schema.ts';
import { anonymizeCustomer, exportCustomerData } from '#lib/server/services/customers.ts';

const url = process.env.TEST_DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin_test';
const pool = new pg.Pool({ connectionString: url, max: 2 });
const db = drizzle(pool, { schema: s });
const EMAIL = 'gdpr-test@example.invalid';
let customerId = '';

async function cleanup() {
	await db.delete(s.orders).where(like(s.orders.number, 'GDPR-TEST-%'));
	await db.delete(s.customers).where(like(s.customers.email, '%gdpr-test%'));
	const [c] = await db.select().from(s.customers).where(like(s.customers.email, 'deleted-%@anonymized.invalid'));
	if (c && c.id === customerId) await db.delete(s.customers).where(eq(s.customers.id, c.id));
	await db.delete(s.products).where(eq(s.products.slug, 'gdpr-test-product'));
	await db.delete(s.categories).where(eq(s.categories.key, 'gdpr-test'));
}

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle' });
	await cleanup();
	const [c] = await db.insert(s.customers).values({ email: EMAIL, firstName: 'Anna', lastName: 'Test', phone: '+32 470 00 00 00', passwordHash: 'x' }).returning();
	customerId = c.id;
	await db.insert(s.addresses).values({ customerId, name: 'Anna Test', line1: 'Straat 1', postalCode: '1000', city: 'Brussel' });
	const [cat] = await db.insert(s.categories).values({ key: 'gdpr-test', slugs: { nl: 'gdpr-nl', fr: 'gdpr-fr' }, name: { nl: 'x' }, icon: 'ring' }).returning();
	const [p] = await db.insert(s.products).values({ slug: 'gdpr-test-product', name: { nl: 'x' }, categoryId: cat.id, price: 1000 }).returning();
	await db.insert(s.wishlists).values({ customerId, productId: p.id });
	const addr = { name: 'Anna Test', line1: 'Straat 1', postalCode: '1000', city: 'Brussel', country: 'BE' };
	const [o] = await db
		.insert(s.orders)
		.values({ number: 'GDPR-TEST-1', accessToken: 'secret', customerId, email: EMAIL, subtotal: 1000, vatTotal: 174, total: 1000, shippingAddress: addr, billingAddress: addr, giftMessage: 'Voor mama', invoiceNumber: 'GDPR-INV-1', paymentStatus: 'paid', status: 'paid' })
		.returning();
	await db.insert(s.orderLines).values({ orderId: o.id, sku: 'X', name: { nl: 'x' }, unitPrice: 1000, qty: 1, vatAmount: 174, lineTotal: 1000 });
});

afterAll(async () => {
	await cleanup();
	await pool.end();
});

describe('GDPR', () => {
	it('export contains profile, addresses, orders with lines and wishlist, without secrets', async () => {
		const data = await exportCustomerData(db, customerId);
		expect(data?.profile.email).toBe(EMAIL);
		expect(data?.profile).not.toHaveProperty('passwordHash');
		expect(data?.addresses).toHaveLength(1);
		expect(data?.orders).toHaveLength(1);
		expect(data?.orders[0].lines).toHaveLength(1);
		expect(data?.orders[0]).not.toHaveProperty('accessToken');
		expect(data?.wishlist).toHaveLength(1);
	});

	it('anonymisation is irreversible and keeps the invoice data on orders', async () => {
		expect(await anonymizeCustomer(db, customerId)).toBe(true);
		const [c] = await db.select().from(s.customers).where(eq(s.customers.id, customerId));
		expect(c.email).toMatch(/@anonymized\.invalid$/);
		expect(c.firstName).toBeNull();
		expect(c.passwordHash).toBeNull();
		expect(c.deletedAt).not.toBeNull();
		expect(await db.select().from(s.addresses).where(eq(s.addresses.customerId, customerId))).toHaveLength(0);
		expect(await db.select().from(s.wishlists).where(eq(s.wishlists.customerId, customerId))).toHaveLength(0);
		const [o] = await db.select().from(s.orders).where(eq(s.orders.number, 'GDPR-TEST-1'));
		expect(o.customerId).toBeNull();
		expect(o.invoiceNumber).toBe('GDPR-INV-1');
		expect(o.billingAddress.name).toBe('Anna Test');
		expect(o.giftMessage).toBeNull();
		expect(await anonymizeCustomer(db, customerId)).toBe(false); // already deleted
	});
});
