/**
 * Minimal fixtures for the checkout / order / reservation tests. They run against the dedicated
 * test database (TEST_DATABASE_URL, default …/sieradenkoningin_test — migrate it first with
 * `node --experimental-strip-types scripts/migrate.ts <url>`). Every fixture row is DEMO-prefixed
 * and uniquely named, so tests never depend on each other or on seed data.
 */
import { eq, sql } from 'drizzle-orm';
import { createDb, type DB } from '#lib/server/db/index.ts';
import {
	cartLines,
	carts,
	categories,
	discounts,
	products,
	shippingRates,
	shippingZones,
	variants
} from '#lib/server/db/schema.ts';
import { createPayments } from '#lib/server/adapters/payments.ts';
import type { EmailAdapter, OutgoingEmail } from '#lib/server/adapters/email.ts';
import type { CheckoutData } from '#lib/schemas/checkout.ts';

export const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin_test';

export function openTestDb() {
	return createDb(TEST_DB_URL, 10);
}

const uid = () => crypto.randomUUID().slice(0, 8);

export async function ensureShipping(db: DB) {
	const [zone] = await db.select().from(shippingZones).where(eq(shippingZones.name, 'DEMO België (tests)'));
	if (zone) return;
	const [z] = await db
		.insert(shippingZones)
		.values({ name: 'DEMO België (tests)', countries: ['BE'] })
		.returning();
	await db.insert(shippingRates).values([
		{ zoneId: z.id, method: 'home', price: 495, freeFrom: 5000 },
		{ zoneId: z.id, method: 'pickup', price: 395, freeFrom: 5000 }
	]);
}

export async function makeVariant(db: DB, opts: { stock: number; price?: number }) {
	const id = uid();
	const [cat] = await db
		.insert(categories)
		.values({
			key: `demo-${id}`,
			slugs: { nl: `demo-cat-${id}`, fr: `demo-cat-fr-${id}` },
			name: { nl: 'DEMO cat' },
			icon: 'rings'
		})
		.returning();
	const [product] = await db
		.insert(products)
		.values({
			slug: `demo-product-${id}`,
			name: { nl: `DEMO Ring ${id}`, fr: `DEMO Bague ${id}` },
			categoryId: cat.id,
			status: 'active',
			price: opts.price ?? 2995
		})
		.returning();
	const [variant] = await db
		.insert(variants)
		.values({ productId: product.id, sku: `DEMO-${id}`, metal: 'gold', size: '52', stock: opts.stock })
		.returning();
	return { productId: product.id, variantId: variant.id, sku: variant.sku };
}

export async function makeCart(
	db: DB,
	lines: { variantId: string; qty: number; giftWrap?: boolean }[],
	discountCode: string | null = null
) {
	const [cart] = await db
		.insert(carts)
		.values({ token: `t-${crypto.randomUUID()}`, locale: 'nl', discountCode })
		.returning();
	if (lines.length)
		await db
			.insert(cartLines)
			.values(
				lines.map((l) => ({ cartId: cart.id, variantId: l.variantId, qty: l.qty, giftWrap: l.giftWrap ?? false }))
			);
	return cart.id;
}

export async function makeDiscount(
	db: DB,
	values: Partial<typeof discounts.$inferInsert> & { type: 'percent' | 'amount' | 'free_shipping' }
) {
	const [d] = await db
		.insert(discounts)
		.values({ code: `DEMO${uid().toUpperCase()}`, value: 0, ...values })
		.returning();
	return d;
}

export const stockOf = async (db: DB, variantId: string) =>
	(await db.select({ s: variants.stock }).from(variants).where(eq(variants.id, variantId)))[0].s;

export function checkoutData(overrides: Partial<CheckoutData> = {}): CheckoutData {
	return {
		email: 'demo.klant@example.com',
		phone: undefined,
		firstName: 'Ann',
		lastName: 'DEMO',
		line1: 'Demostraat 1',
		line2: undefined,
		postalCode: '1000',
		city: 'Brussel',
		country: 'BE',
		shippingMethod: 'home',
		servicePointId: undefined,
		spPostalCode: undefined,
		billingSame: true,
		billingFirstName: undefined,
		billingLastName: undefined,
		billingLine1: undefined,
		billingLine2: undefined,
		billingPostalCode: undefined,
		billingCity: undefined,
		billingCountry: undefined,
		company: undefined,
		vatNumber: undefined,
		giftWrap: false,
		giftMessage: undefined,
		paymentMethod: 'bancontact',
		terms: true,
		...overrides
	};
}

/** In-memory email adapter. */
export function memoryEmail(): EmailAdapter & { sent: OutgoingEmail[] } {
	const sent: OutgoingEmail[] = [];
	return {
		provider: 'mock',
		sent,
		async send(email) {
			sent.push(email);
			return { id: `mem-${sent.length}` };
		}
	};
}

export function deps(db: DB) {
	return {
		db,
		payments: createPayments('', db),
		shipping: {
			servicePoints: async (pc: string) => [
				{ id: `${pc}01`, name: 'DEMO punt', street: 'Straat 1', postalCode: pc, city: 'Demostad', carrier: 'bpost' }
			]
		},
		email: memoryEmail(),
		siteUrl: 'http://localhost:5173'
	};
}

/** Sets the simulated provider status of a mock payment (what the mock page buttons do). */
export async function setMockStatus(db: DB, providerRef: string, status: string) {
	await db.execute(
		sql`update payments set raw = jsonb_set(coalesce(raw, '{}'::jsonb), '{mock,status}', to_jsonb(${status}::text)) where provider_ref = ${providerRef}`
	);
}
