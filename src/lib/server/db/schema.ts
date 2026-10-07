/**
 * Drizzle schema (PostgreSQL / Neon) — the data model of EXECUTION_PLAN §6.
 * Conventions: uuid PKs, money as integer cents, timestamptz (UTC), translatable
 * text in jsonb { nl, fr?, en? } (Belgium is bilingual), soft delete via status.
 *
 * Extensions (citext, pg_trgm, unaccent) and the immutable `sk_unaccent()` wrapper used
 * by the generated search vectors are created in drizzle/0000_extensions.sql.
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	customType,
	index,
	integer,
	jsonb,
	pgEnum,
	pgSequence,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

export type I18n = { nl: string; fr?: string; en?: string };
export type Seo = { title?: I18n; description?: I18n; ogImage?: string };
export type Address = {
	name: string;
	company?: string;
	line1: string;
	line2?: string;
	postalCode: string;
	city: string;
	country: string;
	phone?: string;
};
export type Gpsr = { manufacturer?: string; address?: string; contact?: string; safetyInfo?: I18n };
export type ServicePoint = { id: string; name: string; street: string; postalCode: string; city: string; carrier: string };
export type CollectionRule = {
	category?: string;
	tag?: string;
	newWithinDays?: number;
	onSale?: boolean;
	priceLt?: number;
};
export type MenuItem = { label: I18n; href: string | I18n; children?: MenuItem[] };

const citext = customType<{ data: string }>({ dataType: () => 'citext' });
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () => ts('updated_at').notNull().defaultNow();
const i18n = (name: string) => jsonb(name).$type<I18n>();

// ── Enums ──────────────────────────────────────────────────────────────────────
export const productStatusEnum = pgEnum('product_status', ['draft', 'active', 'archived']);
export const metalEnum = pgEnum('metal', ['gold', 'rosegold', 'silver']);
export const orderStatusEnum = pgEnum('order_status', [
	'pending',
	'paid',
	'processing',
	'shipped',
	'delivered',
	'cancelled',
	'refunded'
]);
export const paymentStatusEnum = pgEnum('payment_status', [
	'open',
	'paid',
	'failed',
	'canceled',
	'expired',
	'partially_refunded',
	'refunded'
]);
export const adminRoleEnum = pgEnum('admin_role', ['owner', 'editor', 'fulfilment', 'support']);
export const userTypeEnum = pgEnum('user_type', ['customer', 'admin']);
export const collectionTypeEnum = pgEnum('collection_type', ['manual', 'rule']);
export const relationKindEnum = pgEnum('relation_kind', ['related', 'complete_set']);
export const stockReasonEnum = pgEnum('stock_reason', ['sale', 'return', 'adjust', 'import', 'reservation_release']);
export const discountTypeEnum = pgEnum('discount_type', ['percent', 'amount', 'free_shipping']);
export const pageTypeEnum = pgEnum('page_type', ['home', 'page', 'legal', 'landing']);
export const publishStatusEnum = pgEnum('publish_status', ['draft', 'published']);
export const newsletterStatusEnum = pgEnum('newsletter_status', ['pending', 'confirmed', 'unsubscribed']);
export const shippingMethodEnum = pgEnum('shipping_method', ['home', 'pickup']);
export const reviewStatusEnum = pgEnum('review_status', ['pending', 'approved', 'rejected']);
export const tokenPurposeEnum = pgEnum('token_purpose', ['login', 'reset', 'verify', 'newsletter']);
export const jobStatusEnum = pgEnum('job_status', ['queued', 'done', 'failed']);

// ── Sequences ──────────────────────────────────────────────────────────────────
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 1 });
export const invoiceNumberSeq = pgSequence('invoice_number_seq', { startWith: 1 });

// ── Catalog ────────────────────────────────────────────────────────────────────
export const media = pgTable(
	'media',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		storageKey: text('storage_key').notNull(),
		mime: text('mime').notNull(),
		width: integer('width'),
		height: integer('height'),
		bytes: integer('bytes'),
		alt: i18n('alt').notNull().default({ nl: '' }),
		deletedAt: ts('deleted_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [uniqueIndex('media_key_uq').on(t.storageKey)]
);

export const categories = pgTable(
	'categories',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		key: text('key').notNull(), // rings | bracelets | … (stable, used by icons & code)
		slugs: jsonb('slugs').$type<{ nl: string; fr: string }>().notNull(),
		name: i18n('name').notNull(),
		description: i18n('description'),
		icon: text('icon').notNull(),
		position: integer('position').notNull().default(0),
		seo: jsonb('seo').$type<Seo>(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('categories_key_uq').on(t.key),
		uniqueIndex('categories_slug_nl_uq').on(sql`(${t.slugs}->>'nl')`),
		uniqueIndex('categories_slug_fr_uq').on(sql`(${t.slugs}->>'fr')`)
	]
);

export const products = pgTable(
	'products',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull(),
		name: i18n('name').notNull(),
		description: i18n('description'),
		meaning: i18n('meaning'), // "Met betekenis" — the story behind the piece
		care: i18n('care'),
		material: i18n('material'), // "18k verguld edelstaal · granaat"
		stoneColor: text('stone_color'), // filter facet: red | green | white | none …
		tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
		badge: text('badge'), // limited | bestseller (manual); "new" is computed
		categoryId: uuid('category_id')
			.notNull()
			.references(() => categories.id),
		status: productStatusEnum('status').notNull().default('draft'),
		price: integer('price').notNull(), // cents, VAT incl.
		compareAtPrice: integer('compare_at_price'),
		featured: boolean('featured').notNull().default(false),
		engravable: boolean('engravable').notNull().default(false),
		seo: jsonb('seo').$type<Seo>(),
		gpsr: jsonb('gpsr').$type<Gpsr>(),
		searchNl: tsvector('search_nl').generatedAlwaysAs(
			sql`to_tsvector('dutch', sk_unaccent(coalesce(name->>'nl','') || ' ' || coalesce(description->>'nl','') || ' ' || coalesce(material->>'nl','')))`
		),
		searchFr: tsvector('search_fr').generatedAlwaysAs(
			sql`to_tsvector('french', sk_unaccent(coalesce(name->>'fr', name->>'nl','') || ' ' || coalesce(description->>'fr','') || ' ' || coalesce(material->>'fr','')))`
		),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('products_slug_uq').on(t.slug),
		index('products_cat_status_idx').on(t.categoryId, t.status),
		index('products_search_nl_idx').using('gin', t.searchNl),
		index('products_search_fr_idx').using('gin', t.searchFr),
		index('products_name_trgm_idx').using('gin', sql`(sk_unaccent(${t.name}->>'nl')) gin_trgm_ops`),
		index('products_name_fr_trgm_idx').using('gin', sql`(sk_unaccent(coalesce(${t.name}->>'fr', ${t.name}->>'nl'))) gin_trgm_ops`),
		check('products_price_nonneg', sql`${t.price} >= 0`)
	]
);

export const priceHistory = pgTable(
	'price_history',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		price: integer('price').notNull(),
		validFrom: ts('valid_from').notNull().defaultNow()
	},
	(t) => [index('price_history_product_idx').on(t.productId, t.validFrom)]
);

export const variants = pgTable(
	'variants',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		sku: text('sku').notNull(),
		metal: metalEnum('metal').notNull().default('gold'),
		size: text('size'), // ring size "52", bracelet "S/M/L"
		priceOverride: integer('price_override'),
		stock: integer('stock').notNull().default(0),
		lowStockThreshold: integer('low_stock_threshold').notNull().default(2),
		position: integer('position').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('variants_sku_uq').on(t.sku),
		index('variants_product_idx').on(t.productId, t.position),
		check('variants_stock_nonneg', sql`${t.stock} >= 0`)
	]
);

export const productImages = pgTable(
	'product_images',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		mediaId: uuid('media_id')
			.notNull()
			.references(() => media.id),
		alt: i18n('alt').notNull(),
		position: integer('position').notNull().default(0)
	},
	(t) => [index('product_images_product_idx').on(t.productId, t.position), index('product_images_media_idx').on(t.mediaId)]
);

export const collections = pgTable(
	'collections',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slugs: jsonb('slugs').$type<{ nl: string; fr: string }>().notNull(),
		name: i18n('name').notNull(),
		description: i18n('description'),
		type: collectionTypeEnum('type').notNull().default('manual'),
		rule: jsonb('rule').$type<CollectionRule>(),
		seo: jsonb('seo').$type<Seo>(),
		heroMediaId: uuid('hero_media_id').references(() => media.id),
		active: boolean('active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('collections_slug_nl_uq').on(sql`(${t.slugs}->>'nl')`),
		uniqueIndex('collections_slug_fr_uq').on(sql`(${t.slugs}->>'fr')`)
	]
);

export const collectionProducts = pgTable(
	'collection_products',
	{
		collectionId: uuid('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		position: integer('position').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.collectionId, t.productId] })]
);

export const productRelations = pgTable(
	'product_relations',
	{
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		relatedId: uuid('related_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		kind: relationKindEnum('kind').notNull(),
		position: integer('position').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.productId, t.relatedId, t.kind] })]
);

// ── Inventory ──────────────────────────────────────────────────────────────────
export const stockMovements = pgTable(
	'stock_movements',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		variantId: uuid('variant_id')
			.notNull()
			.references(() => variants.id, { onDelete: 'cascade' }),
		delta: integer('delta').notNull(),
		reason: stockReasonEnum('reason').notNull(),
		note: text('note'),
		refId: text('ref_id'),
		actor: text('actor'),
		createdAt: createdAt()
	},
	(t) => [index('stock_movements_variant_idx').on(t.variantId, t.createdAt)]
);

export const stockReservations = pgTable(
	'stock_reservations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		variantId: uuid('variant_id')
			.notNull()
			.references(() => variants.id, { onDelete: 'cascade' }),
		cartId: uuid('cart_id').notNull(),
		orderId: uuid('order_id'),
		qty: integer('qty').notNull(),
		expiresAt: ts('expires_at').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('stock_reservations_variant_idx').on(t.variantId, t.expiresAt), index('stock_reservations_order_idx').on(t.orderId)]
);

// ── Customers & auth ───────────────────────────────────────────────────────────
export const customers = pgTable(
	'customers',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		email: citext('email').notNull(),
		passwordHash: text('password_hash'),
		firstName: text('first_name'),
		lastName: text('last_name'),
		phone: text('phone'),
		locale: text('locale').notNull().default('nl'),
		emailVerifiedAt: ts('email_verified_at'),
		marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
		birthday: text('birthday'),
		notes: text('notes'),
		tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
		deletedAt: ts('deleted_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [uniqueIndex('customers_email_uq').on(t.email)]
);

export const addresses = pgTable(
	'addresses',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		customerId: uuid('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		company: text('company'),
		line1: text('line1').notNull(),
		line2: text('line2'),
		postalCode: text('postal_code').notNull(),
		city: text('city').notNull(),
		country: text('country').notNull().default('BE'),
		phone: text('phone'),
		isDefault: boolean('is_default').notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [index('addresses_customer_idx').on(t.customerId)]
);

export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(), // SHA-256 hash of the cookie token
		userType: userTypeEnum('user_type').notNull(),
		userId: uuid('user_id').notNull(),
		expiresAt: ts('expires_at').notNull(), // absolute expiry
		idleExpiresAt: ts('idle_expires_at').notNull(),
		twoFactorVerified: boolean('two_factor_verified').notNull().default(false),
		ip: text('ip'),
		ua: text('ua'),
		createdAt: createdAt()
	},
	(t) => [index('sessions_user_idx').on(t.userType, t.userId)]
);

export const magicLinks = pgTable(
	'magic_links',
	{
		tokenHash: text('token_hash').primaryKey(),
		email: citext('email').notNull(),
		purpose: tokenPurposeEnum('purpose').notNull().default('login'),
		expiresAt: ts('expires_at').notNull(),
		usedAt: ts('used_at'),
		createdAt: createdAt()
	},
	(t) => [index('magic_links_email_idx').on(t.email)]
);

export const rateLimits = pgTable('rate_limits', {
	key: text('key').primaryKey(),
	count: integer('count').notNull().default(0),
	resetAt: ts('reset_at').notNull()
});

export const wishlists = pgTable(
	'wishlists',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
		guestToken: text('guest_token'),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		variantId: uuid('variant_id').references(() => variants.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('wishlists_customer_product_uq').on(t.customerId, t.productId),
		uniqueIndex('wishlists_guest_product_uq').on(t.guestToken, t.productId),
		check('wishlists_owner', sql`${t.customerId} is not null or ${t.guestToken} is not null`)
	]
);

export const wishlistShares = pgTable('wishlist_shares', {
	token: text('token').primaryKey(),
	customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
	guestToken: text('guest_token'),
	createdAt: createdAt()
});

export const stockAlerts = pgTable(
	'stock_alerts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		email: citext('email').notNull(),
		variantId: uuid('variant_id')
			.notNull()
			.references(() => variants.id, { onDelete: 'cascade' }),
		locale: text('locale').notNull().default('nl'),
		notifiedAt: ts('notified_at'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('stock_alerts_email_variant_uq').on(t.email, t.variantId)]
);

// ── Cart ───────────────────────────────────────────────────────────────────────
export const carts = pgTable(
	'carts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		token: text('token').notNull(),
		customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
		locale: text('locale').notNull().default('nl'),
		discountCode: text('discount_code'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [uniqueIndex('carts_token_uq').on(t.token), index('carts_customer_idx').on(t.customerId)]
);

export const cartLines = pgTable(
	'cart_lines',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		cartId: uuid('cart_id')
			.notNull()
			.references(() => carts.id, { onDelete: 'cascade' }),
		variantId: uuid('variant_id')
			.notNull()
			.references(() => variants.id, { onDelete: 'cascade' }),
		qty: integer('qty').notNull(),
		giftWrap: boolean('gift_wrap').notNull().default(false),
		engraving: jsonb('engraving').$type<{ text: string; font: string } | null>(),
		createdAt: createdAt()
	},
	(t) => [index('cart_lines_cart_idx').on(t.cartId), check('cart_lines_qty_pos', sql`${t.qty} > 0`)]
);

// ── Orders ─────────────────────────────────────────────────────────────────────
export const orders = pgTable(
	'orders',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		number: text('number').notNull(), // "SK-2026-000123"
		accessToken: text('access_token').notNull(), // lets a guest open the thank-you page
		customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
		email: citext('email').notNull(),
		locale: text('locale').notNull().default('nl'),
		status: orderStatusEnum('status').notNull().default('pending'),
		paymentStatus: paymentStatusEnum('payment_status').notNull().default('open'),
		subtotal: integer('subtotal').notNull(),
		discountTotal: integer('discount_total').notNull().default(0),
		shippingTotal: integer('shipping_total').notNull().default(0),
		vatTotal: integer('vat_total').notNull(),
		total: integer('total').notNull(),
		refundedTotal: integer('refunded_total').notNull().default(0),
		currency: text('currency').notNull().default('EUR'),
		shippingAddress: jsonb('shipping_address').$type<Address>().notNull(),
		billingAddress: jsonb('billing_address').$type<Address>().notNull(),
		vatNumber: text('vat_number'),
		shippingMethod: shippingMethodEnum('shipping_method').notNull().default('home'),
		servicePoint: jsonb('service_point').$type<ServicePoint | null>(),
		giftWrap: boolean('gift_wrap').notNull().default(false),
		giftMessage: text('gift_message'),
		discountCode: text('discount_code'),
		paymentMethod: text('payment_method'),
		invoiceNumber: text('invoice_number'),
		invoiceKey: text('invoice_key'),
		cartId: uuid('cart_id'),
		placedAt: ts('placed_at').notNull().defaultNow(),
		paidAt: ts('paid_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('orders_number_uq').on(t.number),
		uniqueIndex('orders_invoice_uq').on(t.invoiceNumber),
		index('orders_status_placed_idx').on(t.status, t.placedAt),
		index('orders_email_idx').on(t.email),
		index('orders_customer_idx').on(t.customerId),
		check('orders_total_nonneg', sql`${t.total} >= 0`)
	]
);

export const orderLines = pgTable(
	'order_lines',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		variantId: uuid('variant_id').references(() => variants.id, { onDelete: 'set null' }),
		productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
		sku: text('sku').notNull(),
		name: i18n('name').notNull(), // snapshot
		variantLabel: i18n('variant_label'),
		imageKey: text('image_key'),
		unitPrice: integer('unit_price').notNull(),
		qty: integer('qty').notNull(),
		vatRate: integer('vat_rate').notNull().default(2100), // basis points: 2100 = 21%
		vatAmount: integer('vat_amount').notNull(),
		lineTotal: integer('line_total').notNull(),
		discountAmount: integer('discount_amount').notNull().default(0),
		refundedQty: integer('refunded_qty').notNull().default(0),
		giftWrap: boolean('gift_wrap').notNull().default(false),
		engraving: jsonb('engraving').$type<{ text: string; font: string } | null>()
	},
	(t) => [index('order_lines_order_idx').on(t.orderId)]
);

export const orderEvents = pgTable(
	'order_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		type: text('type').notNull(), // placed | paid | status | note | email | shipment | refund …
		data: jsonb('data').$type<Record<string, unknown>>(),
		actor: text('actor'),
		createdAt: createdAt()
	},
	(t) => [index('order_events_order_idx').on(t.orderId, t.createdAt)]
);

export const payments = pgTable(
	'payments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		provider: text('provider').notNull(),
		providerRef: text('provider_ref').notNull(),
		method: text('method'),
		amount: integer('amount').notNull(),
		status: paymentStatusEnum('status').notNull().default('open'),
		checkoutUrl: text('checkout_url'),
		raw: jsonb('raw'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [uniqueIndex('payments_ref_uq').on(t.provider, t.providerRef), index('payments_order_idx').on(t.orderId)]
);

export const refunds = pgTable(
	'refunds',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		paymentId: uuid('payment_id').references(() => payments.id),
		amount: integer('amount').notNull(),
		reason: text('reason'),
		lines: jsonb('lines').$type<{ orderLineId: string; qty: number }[]>(),
		restock: boolean('restock').notNull().default(false),
		providerRef: text('provider_ref'),
		status: text('status').notNull().default('pending'),
		actor: text('actor'),
		createdAt: createdAt()
	},
	(t) => [index('refunds_order_idx').on(t.orderId), check('refunds_amount_pos', sql`${t.amount} > 0`)]
);

export const shipments = pgTable(
	'shipments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		carrier: text('carrier').notNull(),
		providerRef: text('provider_ref'),
		servicePoint: jsonb('service_point').$type<ServicePoint | null>(),
		labelKey: text('label_key'),
		trackingNumber: text('tracking_number'),
		trackingUrl: text('tracking_url'),
		status: text('status').notNull().default('created'), // created | shipped | delivered | exception
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('shipments_order_idx').on(t.orderId), index('shipments_ref_idx').on(t.providerRef)]
);

export const returns = pgTable(
	'returns',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('requested'),
		reason: text('reason'),
		labelKey: text('label_key'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('returns_order_idx').on(t.orderId)]
);

export const returnLines = pgTable('return_lines', {
	id: uuid('id').primaryKey().defaultRandom(),
	returnId: uuid('return_id')
		.notNull()
		.references(() => returns.id, { onDelete: 'cascade' }),
	orderLineId: uuid('order_line_id')
		.notNull()
		.references(() => orderLines.id),
	qty: integer('qty').notNull(),
	condition: text('condition')
});

// ── Marketing ──────────────────────────────────────────────────────────────────
export const discounts = pgTable(
	'discounts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		code: text('code').notNull(), // stored upper-case
		type: discountTypeEnum('type').notNull(),
		value: integer('value').notNull().default(0), // percent (0–100) or cents
		minSubtotal: integer('min_subtotal'),
		startsAt: ts('starts_at'),
		endsAt: ts('ends_at'),
		usageLimit: integer('usage_limit'),
		perCustomerLimit: integer('per_customer_limit'),
		active: boolean('active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [uniqueIndex('discounts_code_uq').on(t.code), check('discounts_code_upper', sql`${t.code} = upper(${t.code})`)]
);

export const discountRedemptions = pgTable(
	'discount_redemptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		discountId: uuid('discount_id')
			.notNull()
			.references(() => discounts.id, { onDelete: 'cascade' }),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		customerId: uuid('customer_id'),
		email: citext('email').notNull(),
		amount: integer('amount').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('discount_redemptions_order_uq').on(t.discountId, t.orderId), index('discount_redemptions_email_idx').on(t.email)]
);

export const giftCards = pgTable('gift_cards', {
	id: uuid('id').primaryKey().defaultRandom(),
	codeHash: text('code_hash').notNull().unique(),
	last4: text('last4').notNull(),
	initial: integer('initial').notNull(),
	balance: integer('balance').notNull(),
	expiresAt: ts('expires_at'),
	recipientEmail: citext('recipient_email'),
	recipientName: text('recipient_name'),
	message: text('message'),
	sendAt: ts('send_at'),
	createdAt: createdAt()
});

export const giftCardTransactions = pgTable('gift_card_transactions', {
	id: uuid('id').primaryKey().defaultRandom(),
	giftCardId: uuid('gift_card_id')
		.notNull()
		.references(() => giftCards.id, { onDelete: 'cascade' }),
	delta: integer('delta').notNull(),
	orderId: uuid('order_id').references(() => orders.id),
	createdAt: createdAt()
});

export const reviews = pgTable(
	'reviews',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		orderLineId: uuid('order_line_id').references(() => orderLines.id),
		customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
		rating: integer('rating').notNull(),
		title: text('title'),
		body: text('body'),
		media: jsonb('media').$type<string[]>(),
		status: reviewStatusEnum('status').notNull().default('pending'),
		reply: text('reply'),
		createdAt: createdAt()
	},
	(t) => [index('reviews_product_idx').on(t.productId, t.status), check('reviews_rating_range', sql`${t.rating} between 1 and 5`)]
);

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
	email: citext('email').primaryKey(),
	locale: text('locale').notNull().default('nl'),
	status: newsletterStatusEnum('status').notNull().default('pending'),
	token: text('token').notNull(),
	source: text('source'),
	syncedAt: ts('synced_at'),
	confirmedAt: ts('confirmed_at'),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

// ── Content (CMS) ──────────────────────────────────────────────────────────────
export const pages = pgTable(
	'pages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		key: text('key'), // stable key for system pages (home, size-guide, terms …)
		slugs: jsonb('slugs').$type<{ nl: string; fr: string }>().notNull(),
		type: pageTypeEnum('type').notNull().default('page'),
		title: i18n('title').notNull(),
		seo: jsonb('seo').$type<Seo>(),
		status: publishStatusEnum('status').notNull().default('draft'),
		publishAt: ts('publish_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('pages_key_uq').on(t.key),
		uniqueIndex('pages_slug_nl_uq').on(sql`(${t.slugs}->>'nl')`),
		uniqueIndex('pages_slug_fr_uq').on(sql`(${t.slugs}->>'fr')`)
	]
);

export const pageBlocks = pgTable(
	'page_blocks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		pageId: uuid('page_id')
			.notNull()
			.references(() => pages.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		data: jsonb('data').$type<Record<string, unknown>>().notNull(),
		position: integer('position').notNull().default(0),
		hidden: boolean('hidden').notNull().default(false),
		visibleFrom: ts('visible_from'),
		visibleUntil: ts('visible_until')
	},
	(t) => [index('page_blocks_page_idx').on(t.pageId, t.position)]
);

export const menus = pgTable('menus', {
	key: text('key').primaryKey(), // main | footer_shop | footer_help | footer_about | footer_legal
	items: jsonb('items').$type<MenuItem[]>().notNull().default([]),
	updatedAt: updatedAt()
});

export const faqs = pgTable('faqs', {
	id: uuid('id').primaryKey().defaultRandom(),
	question: i18n('question').notNull(),
	answer: i18n('answer').notNull(),
	group: text('group').notNull().default('general'),
	position: integer('position').notNull().default(0),
	createdAt: createdAt()
});

export const articles = pgTable('articles', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	title: i18n('title').notNull(),
	body: i18n('body').notNull(),
	coverMediaId: uuid('cover_media_id').references(() => media.id),
	status: publishStatusEnum('status').notNull().default('draft'),
	publishedAt: ts('published_at'),
	createdAt: createdAt()
});

export const redirects = pgTable('redirects', {
	fromPath: text('from_path').primaryKey(),
	toPath: text('to_path').notNull(),
	code: integer('code').notNull().default(301),
	hits: integer('hits').notNull().default(0),
	createdAt: createdAt()
});

// ── Admin & system ─────────────────────────────────────────────────────────────
export const adminUsers = pgTable(
	'admin_users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		email: citext('email').notNull(),
		name: text('name').notNull(),
		passwordHash: text('password_hash'),
		role: adminRoleEnum('role').notNull().default('editor'),
		totpSecret: text('totp_secret'), // AES-GCM encrypted
		totpEnabledAt: ts('totp_enabled_at'),
		recoveryCodes: jsonb('recovery_codes').$type<string[]>(), // SHA-256 hashes
		inviteTokenHash: text('invite_token_hash'),
		inviteExpiresAt: ts('invite_expires_at'),
		lastLoginAt: ts('last_login_at'),
		active: boolean('active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [uniqueIndex('admin_users_email_uq').on(t.email)]
);

export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		actorId: uuid('actor_id'),
		actorName: text('actor_name'),
		action: text('action').notNull(),
		entity: text('entity').notNull(),
		entityId: text('entity_id'),
		diff: jsonb('diff'),
		ip: text('ip'),
		createdAt: createdAt()
	},
	(t) => [index('audit_log_entity_idx').on(t.entity, t.entityId), index('audit_log_created_idx').on(t.createdAt)]
);

export const emailLog = pgTable(
	'email_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		to: text('to').notNull(),
		template: text('template').notNull(),
		locale: text('locale').notNull(),
		subject: text('subject'),
		providerId: text('provider_id'),
		status: text('status').notNull(),
		error: text('error'),
		refId: text('ref_id'),
		createdAt: createdAt()
	},
	(t) => [index('email_log_created_idx').on(t.createdAt), index('email_log_ref_idx').on(t.refId)]
);

export const settings = pgTable('settings', {
	key: text('key').primaryKey(),
	value: jsonb('value').notNull(),
	updatedAt: updatedAt()
});

export const shippingZones = pgTable('shipping_zones', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	countries: text('countries').array().notNull(),
	active: boolean('active').notNull().default(true)
});

export const shippingRates = pgTable(
	'shipping_rates',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		zoneId: uuid('zone_id')
			.notNull()
			.references(() => shippingZones.id, { onDelete: 'cascade' }),
		method: shippingMethodEnum('method').notNull(),
		carrier: text('carrier').notNull().default('bpost'),
		price: integer('price').notNull(),
		freeFrom: integer('free_from'),
		active: boolean('active').notNull().default(true)
	},
	(t) => [uniqueIndex('shipping_rates_zone_method_uq').on(t.zoneId, t.method)]
);

/** DB-backed job queue processed by the cron trigger (Cloudflare Queues can replace it later). */
export const jobs = pgTable(
	'jobs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		type: text('type').notNull(),
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
		dedupeKey: text('dedupe_key'),
		status: jobStatusEnum('status').notNull().default('queued'),
		attempts: integer('attempts').notNull().default(0),
		runAt: ts('run_at').notNull().defaultNow(),
		lastError: text('last_error'),
		createdAt: createdAt()
	},
	(t) => [index('jobs_status_run_idx').on(t.status, t.runAt), uniqueIndex('jobs_dedupe_uq').on(t.dedupeKey)]
);
