/**
 * Idempotent seed (P0-06). Safe to run repeatedly: every insert is keyed on a natural key
 * (category key, product slug, SKU, settings key, admin email, page key) and skips existing rows.
 *
 * `opts.demo = false` seeds only structure (categories, settings, zones, menus, pages) — used for the
 * production cutover (P5-07: "categories/settings only; no DEMO products").
 */
import { eq, sql } from 'drizzle-orm';
import type { Executor } from './index.ts';
import * as s from './schema.ts';
import { CATEGORY_SEED, BRACELET_SIZES, FAQ_SEED, MENUS, RING_SIZES, demoProducts, editorialSvg, pageSeeds, placeholderSvg } from './seed-data.ts';
import { categoryIcons } from '../../components/ui/category-icons.ts';
import { icons } from '../../components/ui/icons.ts';
import type { Storage } from '../adapters/storage.ts';
import { hashPassword } from '../auth/password.ts';
import { DEFAULT_SETTINGS } from '../services/settings.ts';

export interface SeedOptions {
	demo?: boolean;
	adminEmail?: string;
	/** Fixed password (tests); otherwise a random one is generated and returned once. */
	adminPassword?: string;
	log?: (msg: string) => void;
}

export async function seed(db: Executor, storage: Storage, opts: SeedOptions = {}) {
	const log = opts.log ?? (() => {});
	const demo = opts.demo ?? true;

	// Categories
	for (const [position, c] of CATEGORY_SEED.entries()) {
		await db
			.insert(s.categories)
			.values({ key: c.key, slugs: c.slugs, name: c.name, icon: c.icon, position })
			.onConflictDoNothing({ target: s.categories.key });
	}
	const cats = await db.select().from(s.categories);
	const catId = (key: string) => cats.find((c) => c.key === key)!.id;
	log(`✓ ${cats.length} categories`);

	// Settings (D3, D4, D9 defaults) — only keys that do not exist yet
	for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
		if (value === null) continue;
		await db.insert(s.settings).values({ key, value: value as object }).onConflictDoNothing();
	}
	log('✓ settings defaults');

	// Shipping zone BE (+ inactive NL/LU zone prepared for D3)
	const [existingZone] = await db.select().from(s.shippingZones).where(eq(s.shippingZones.name, 'België'));
	if (!existingZone) {
		const [be] = await db.insert(s.shippingZones).values({ name: 'België', countries: ['BE'] }).returning();
		await db.insert(s.shippingRates).values([
			{ zoneId: be.id, method: 'home', carrier: 'bpost', price: 495, freeFrom: 5000 },
			{ zoneId: be.id, method: 'pickup', carrier: 'bpost', price: 395, freeFrom: 5000 }
		]);
		const [benelux] = await db.insert(s.shippingZones).values({ name: 'Nederland & Luxemburg', countries: ['NL', 'LU'], active: false }).returning();
		await db.insert(s.shippingRates).values([{ zoneId: benelux.id, method: 'home', carrier: 'bpost', price: 995, freeFrom: 7500 }]);
		log('✓ shipping zones (BE active; NL/LU prepared, inactive)');
	}

	// Owner admin
	let adminPassword: string | null = null;
	const adminEmail = (opts.adminEmail ?? 'owner@example.invalid').toLowerCase();
	const [admin] = await db.select().from(s.adminUsers).where(eq(s.adminUsers.email, adminEmail));
	if (!admin) {
		adminPassword = opts.adminPassword ?? randomPassword();
		await db.insert(s.adminUsers).values({ email: adminEmail, name: 'Eigenaar', role: 'owner', passwordHash: await hashPassword(adminPassword) });
		log(`✓ owner admin ${adminEmail}`);
	}

	// Menus
	for (const [key, items] of Object.entries(MENUS)) {
		await db.insert(s.menus).values({ key, items }).onConflictDoNothing();
	}

	// Editorial placeholder media (hero + editorial)
	const crown = icons.crown;
	const heroKey = 'demo/editorial-hero.svg';
	const editorialKey = 'demo/editorial-split.svg';
	await ensureMedia(db, storage, heroKey, editorialSvg(crown, true), 2400, 1600, { nl: 'DEMO sfeerbeeld', fr: 'DEMO image d’ambiance' });
	await ensureMedia(db, storage, editorialKey, editorialSvg(crown, false), 1600, 2000, { nl: 'DEMO editoriaal beeld', fr: 'DEMO image éditoriale' });

	// Pages + blocks
	for (const p of pageSeeds(heroKey, editorialKey)) {
		const [existing] = await db.select().from(s.pages).where(eq(s.pages.key, p.key));
		if (existing) continue;
		const slugs = p.key === 'home' ? { nl: '__home', fr: '__home_fr' } : p.slugs;
		const [page] = await db.insert(s.pages).values({ key: p.key, type: p.type, slugs, title: p.title, status: 'published' }).returning();
		if (p.blocks.length) {
			await db.insert(s.pageBlocks).values(p.blocks.map((b, position) => ({ pageId: page.id, type: b.type, data: b.data as Record<string, unknown>, position })));
		}
	}
	log('✓ content pages');

	const faqCount = await db.select({ n: sql<number>`count(*)::int` }).from(s.faqs);
	if (faqCount[0].n === 0) {
		await db.insert(s.faqs).values(FAQ_SEED.map((f, position) => ({ ...f, position })));
	}

	// "Nieuw" rule collection
	await db
		.insert(s.collections)
		.values({ slugs: { nl: 'nieuw', fr: 'nouveautes' }, name: { nl: 'Nieuw', fr: 'Nouveautés' }, type: 'rule', rule: { newWithinDays: 30 } })
		.onConflictDoNothing();

	if (!demo) return { adminPassword };

	// DEMO products
	let created = 0;
	for (const p of demoProducts()) {
		const [exists] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.slug, p.slug));
		if (exists) continue;
		const cat = CATEGORY_SEED.find((c) => c.key === p.categoryKey)!;
		const iconBody = categoryIcons[cat.icon as keyof typeof categoryIcons];
		const createdAt = new Date(Date.now() - p.ageDays * 86400_000);
		const [product] = await db
			.insert(s.products)
			.values({
				slug: p.slug,
				name: p.name,
				description: p.description,
				meaning: p.meaning,
				care: { nl: 'DEMO — onderhoudsadvies volgt.', fr: 'DEMO — conseils d’entretien à venir.' },
				material: p.material,
				categoryId: catId(p.categoryKey),
				status: 'active',
				price: p.price,
				compareAtPrice: p.compareAtPrice,
				featured: p.featured,
				badge: p.badge,
				tags: p.tags,
				stoneColor: p.stoneColor,
				engravable: p.engravable,
				gpsr: { manufacturer: 'DEMO fabrikant', address: 'DEMO adres', contact: 'demo@example.invalid' },
				createdAt,
				updatedAt: createdAt
			})
			.returning();
		await db.insert(s.priceHistory).values({ productId: product.id, price: p.compareAtPrice ?? p.price, validFrom: createdAt });
		if (p.compareAtPrice) await db.insert(s.priceHistory).values({ productId: product.id, price: p.price, validFrom: new Date(Date.now() - 2 * 86400_000) });

		const label = (p.name.nl.replace('DEMO ', '') || '').toUpperCase();
		for (const variant of ['a', 'b'] as const) {
			const key = `demo/${p.slug}-${variant}.svg`;
			const mediaId = await ensureMedia(db, storage, key, placeholderSvg(iconBody, label, variant), 1600, 2000, p.name);
			await db.insert(s.productImages).values({
				productId: product.id,
				mediaId,
				alt: { nl: `${p.name.nl} — ${variant === 'a' ? 'productfoto' : 'sfeerbeeld'}`, fr: `${p.name.fr} — ${variant === 'a' ? 'photo produit' : 'ambiance'}` },
				position: variant === 'a' ? 0 : 1
			});
		}

		const sizes = p.categoryKey === 'rings' ? RING_SIZES : p.categoryKey === 'bracelets' ? BRACELET_SIZES : [null];
		const metals = (p.categoryKey === 'accessories' ? ['gold'] : ['gold', 'silver', ...(p.featured ? ['rosegold'] : [])]) as ('gold' | 'silver' | 'rosegold')[];
		let position = 0;
		const rows = [];
		for (const metal of metals) {
			for (const size of sizes) {
				const sku = `DEMO-${p.slug.slice(5, 20).toUpperCase()}-${metal.slice(0, 2).toUpperCase()}${size ? '-' + size : ''}`;
				// Deterministic stock: some low, some sold out, to exercise UI states.
				const stock = (position * 7 + p.price) % 11 === 0 ? 0 : ((position * 3 + p.price) % 9) + 1;
				rows.push({ productId: product.id, sku, metal, size, stock, position: position++ });
			}
		}
		await db.insert(s.variants).values(rows).onConflictDoNothing({ target: s.variants.sku });
		created++;
	}
	log(`✓ ${created} DEMO products created`);
	return { adminPassword };
}

async function ensureMedia(db: Executor, storage: Storage, key: string, svg: string, width: number, height: number, alt: s.I18n) {
	const [existing] = await db.select({ id: s.media.id }).from(s.media).where(eq(s.media.storageKey, key));
	if (existing) return existing.id;
	await storage.put(key, svg, 'image/svg+xml');
	const [row] = await db.insert(s.media).values({ storageKey: key, mime: 'image/svg+xml', width, height, bytes: svg.length, alt }).returning();
	return row.id;
}

function randomPassword() {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}
