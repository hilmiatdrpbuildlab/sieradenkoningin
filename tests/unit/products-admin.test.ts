import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, desc, eq, inArray, like } from 'drizzle-orm';
import { createDb, type DB } from '#lib/server/db/index.ts';
import { auditLog, categories, media, priceHistory, productImages, productRelations, products, stockMovements, variants } from '#lib/server/db/schema.ts';
import {
	activationErrors,
	formToObject,
	normalizeModel,
	productSchema,
	skuFor,
	variantMatrix,
	parseSizes,
	parseTags
} from '#lib/schemas/product.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { duplicateProduct, listProducts, loadProduct, modelFromProduct, saveProduct, setProductStatus, ValidationError } from '#lib/server/services/products-admin.ts';
import { imageInfo, checkUpload } from '#lib/server/services/media.ts';

const fd = (entries: [string, string][]) => {
	const f = new FormData();
	for (const [k, v] of entries) f.append(k, v);
	return f;
};

describe('formToObject', () => {
	it('builds nested objects, ordered arrays and repeated keys', () => {
		const o = formToObject(
			fd([
				['name.nl', 'Ring'],
				['name.fr', 'Bague'],
				['variants.1.sku', 'B'],
				['variants.0.sku', 'A'],
				['variants.10.sku', 'K'],
				['related', 'x'],
				['related', 'y'],
				['_intent', 'ignored']
			])
		);
		expect(o).toEqual({ name: { nl: 'Ring', fr: 'Bague' }, variants: [{ sku: 'A' }, { sku: 'B' }, { sku: 'K' }], related: ['x', 'y'] });
	});

	it('normalizeModel fills every path for re-rendering', () => {
		const m = normalizeModel(formToObject(fd([['name.nl', 'Ring'], ['related', 'a']])));
		expect(m.name).toEqual({ nl: 'Ring', fr: '' });
		expect(m.related).toEqual(['a']);
		expect(m.seo.title).toEqual({ nl: '', fr: '' });
		expect(m.status).toBe('draft');
	});
});

describe('SKU helpers', () => {
	it('builds SKUs and the metal × size matrix', () => {
		expect(skuFor('demo-klaver-ring', 'gold', '52')).toBe('DEMO-KLAVER-RING-GO-52');
		expect(skuFor('ketting', 'rosegold')).toBe('KETTING-RG');
		expect(variantMatrix('ring', ['gold', 'silver'], parseSizes('50, 52'))).toEqual([
			{ sku: 'RING-GO-50', metal: 'gold', size: '50' },
			{ sku: 'RING-GO-52', metal: 'gold', size: '52' },
			{ sku: 'RING-SI-50', metal: 'silver', size: '50' },
			{ sku: 'RING-SI-52', metal: 'silver', size: '52' }
		]);
		expect(variantMatrix('ring', ['gold'], [])).toEqual([{ sku: 'RING-GO', metal: 'gold', size: '' }]);
		expect(parseTags('Klaver, rood;klaver')).toEqual(['klaver', 'rood']);
	});
});

const CAT = '8b1f7a52-6d8e-4c63-9f2e-0d3c2b1a0e01';
const base = {
	slug: 'demo-test',
	name: { nl: 'DEMO Test', fr: '' },
	categoryId: CAT,
	price: '49,95',
	compareAtPrice: '',
	status: 'draft'
};

describe('productSchema', () => {
	it('converts euros to cents and checkboxes to booleans', () => {
		const r = productSchema.safeParse({ ...base, featured: 'on', tags: 'a, b', variants: [{ sku: 'x-1', metal: 'gold', stock: '3', priceOverride: '55' }] });
		expect(r.success).toBe(true);
		expect(r.data!.price).toBe(4995);
		expect(r.data!.featured).toBe(true);
		expect(r.data!.engravable).toBe(false);
		expect(r.data!.tags).toEqual(['a', 'b']);
		expect(r.data!.variants[0]).toMatchObject({ sku: 'X-1', stock: 3, priceOverride: 5500, lowStockThreshold: 2, size: null });
		expect(r.data!.description).toBeNull();
	});

	it('reports Dutch errors keyed by field path', () => {
		const r = productSchema.safeParse({
			...base,
			slug: 'Niet Goed',
			name: { nl: '' },
			price: 'abc',
			categoryId: '',
			compareAtPrice: '',
			variants: [
				{ sku: 'A', metal: 'gold', stock: '-1' },
				{ sku: 'A', metal: 'gold', stock: '1' }
			],
			images: [{ mediaId: '8b1f7a52-6d8e-4c63-9f2e-0d3c2b1a0e02', alt: { nl: '' } }]
		});
		expect(r.success).toBe(false);
		const e = fieldErrors(r.error!);
		expect(e.slug[0]).toMatch(/kleine letters/);
		expect(e['name.nl'][0]).toBe('Naam (NL) is verplicht');
		expect(e.price[0]).toBe('Ongeldig bedrag');
		expect(e.categoryId[0]).toBe('Kies een categorie');
		expect(e['variants.0.stock'][0]).toBe('Voorraad kan niet negatief zijn');
		expect(e['images.0.alt.nl'][0]).toBe('Alt-tekst (NL) is verplicht');
	});

	it('flags duplicate SKUs and compare-at below price', () => {
		const r = productSchema.safeParse({
			...base,
			compareAtPrice: '10',
			variants: [
				{ sku: 'A', metal: 'gold', size: '50' },
				{ sku: 'a', metal: 'silver', size: '50' }
			]
		});
		const e = fieldErrors(r.error!);
		expect(e.compareAtPrice[0]).toMatch(/hoger/);
		expect(e['variants.1.sku'][0]).toBe('SKU komt dubbel voor');
	});
});

describe('activationErrors', () => {
	const img = { alt: { nl: 'Gouden ring' } };
	it('only applies to active products', () => {
		expect(activationErrors({ status: 'draft', images: [], variants: [] })).toEqual({});
	});
	it('needs an image with NL alt text and a variant', () => {
		expect(activationErrors({ status: 'active', images: [img], variants: [{}] })).toEqual({});
		const e = activationErrors({ status: 'active', images: [{ alt: { nl: '' } }, { ...img, remove: true }], variants: [{ remove: true }] });
		expect(Object.keys(e).sort()).toEqual(['images', 'status', 'variants']);
	});
});

describe('imageInfo', () => {
	it('reads PNG dimensions and enforces the 1600px rule', () => {
		const png = new Uint8Array(33);
		png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
		new DataView(png.buffer).setUint32(16, 2000);
		new DataView(png.buffer).setUint32(20, 1500);
		const info = imageInfo(png)!;
		expect(info).toEqual({ mime: 'image/png', width: 2000, height: 1500 });
		expect(checkUpload(info, 1000)).toMatch(/1600px/);
		expect(checkUpload({ ...info, height: 1600 }, 1000)).toBeNull();
		expect(checkUpload(imageInfo(new TextEncoder().encode('<svg></svg>')), 10)).toMatch(/Alleen/);
	});
	it('reads JPEG SOF dimensions', () => {
		const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x07, 0xd0, 0x0a, 0x00, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(imageInfo(jpg)).toEqual({ mime: 'image/jpeg', width: 2560, height: 2000 });
	});
});

// ── Database integration ─────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin';
const RUN = `test-pa-${Date.now().toString(36)}`;
const actor = {
	admin: { id: crypto.randomUUID(), name: 'Unit test', email: 'unit@example.invalid', role: 'owner' as const, sessionId: 'unit' },
	ip: '127.0.0.1'
};

describe('saveProduct / duplicate / archive (database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let categoryId: string;
	let mediaId: string;
	let otherProductId: string;

	beforeAll(async () => {
		({ db, close } = createDb(DB_URL, 2));
		[{ id: categoryId }] = await db.select({ id: categories.id }).from(categories).where(eq(categories.key, 'rings'));
		[{ id: mediaId }] = await db.select({ id: media.id }).from(media).limit(1);
		[{ id: otherProductId }] = await db.select({ id: products.id }).from(products).where(like(products.slug, 'demo-%')).limit(1);
	});
	afterAll(async () => {
		await db.delete(products).where(like(products.slug, `${RUN}%`));
		await close();
	});

	const parse = (o: Record<string, unknown>) => {
		const r = productSchema.safeParse({ ...base, categoryId, slug: RUN, ...o });
		if (!r.success) throw new Error(JSON.stringify(fieldErrors(r.error)));
		return r.data;
	};

	it('refuses activation without image/variant, then creates, edits, duplicates and archives', async () => {
		await expect(db.transaction((tx) => saveProduct(tx, actor, null, parse({ status: 'active' })))).rejects.toBeInstanceOf(ValidationError);

		const id = await db.transaction((tx) =>
			saveProduct(
				tx,
				actor,
				null,
				parse({
					status: 'active',
					images: [{ mediaId, alt: { nl: 'DEMO testfoto', fr: '' } }],
					variants: [
						{ sku: `${RUN}-go-52`, metal: 'gold', size: '52', stock: '4' },
						{ sku: `${RUN}-si-52`, metal: 'silver', size: '52', stock: '0' }
					],
					related: [otherProductId]
				})
			)
		);
		const loaded = (await loadProduct(db, id))!;
		expect(loaded.product.status).toBe('active');
		expect(loaded.variants.map((v) => v.stock)).toEqual([4, 0]);
		expect(loaded.relations).toEqual([{ relatedId: otherProductId, kind: 'related' }]);
		expect((await db.select().from(priceHistory).where(eq(priceHistory.productId, id))).map((p) => p.price)).toEqual([4995]);

		// Edit: new price → price_history row; stock change → stock movement; remove a variant
		const model = modelFromProduct(loaded, (k) => `/media/${k}`);
		expect(model.price).toBe('49,95');
		const edited = parse({
			...model,
			price: '59,95',
			variants: model.variants.map((v, i) => (i === 0 ? { ...v, stock: '1' } : { ...v, remove: 'on' }))
		});
		await db.transaction((tx) => saveProduct(tx, actor, id, edited));
		const after = (await loadProduct(db, id))!;
		expect(after.product.price).toBe(5995);
		expect(after.variants).toHaveLength(1);
		expect((await db.select().from(priceHistory).where(eq(priceHistory.productId, id))).map((p) => p.price).sort()).toEqual([4995, 5995]);
		const moves = await db.select().from(stockMovements).where(eq(stockMovements.variantId, after.variants[0].id)).orderBy(desc(stockMovements.createdAt));
		expect(moves.map((m) => m.delta)).toEqual([-3, 4]);

		// SKU clash with another product is a field error
		const [demoVariant] = await db.select({ sku: variants.sku }).from(variants).where(eq(variants.productId, otherProductId)).limit(1);
		const clash = parse({ ...modelFromProduct(after, (k) => k), variants: [{ sku: demoVariant.sku, metal: 'rosegold', stock: '0' }] });
		const err = await db.transaction((tx) => saveProduct(tx, actor, id, clash)).catch((e) => e);
		expect(err).toBeInstanceOf(ValidationError);
		expect(Object.keys((err as ValidationError).errors)).toContain('variants.0.sku');

		// Duplicate → draft copy, unique slug + SKUs, zero stock, same images/relations
		const copyId = await db.transaction((tx) => duplicateProduct(tx, actor, id));
		const copy = (await loadProduct(db, copyId))!;
		expect(copy.product.slug).toBe(`${RUN}-kopie`);
		expect(copy.product.status).toBe('draft');
		expect(copy.variants.map((v) => [v.sku, v.stock])).toEqual([[`${RUN}-GO-52-K`.toUpperCase(), 0]]);
		expect(await db.select().from(productImages).where(eq(productImages.productId, copyId))).toHaveLength(1);
		expect(await db.select().from(productRelations).where(eq(productRelations.productId, copyId))).toHaveLength(1);

		// Archive
		await db.transaction((tx) => setProductStatus(tx, actor, id, 'archived'));
		expect((await loadProduct(db, id))!.product.status).toBe('archived');
		const list = await listProducts(db, { q: RUN });
		expect(list.rows.map((r) => r.id)).toEqual([copyId]); // archived hidden by default
		expect((await listProducts(db, { q: RUN, status: 'archived' })).rows.map((r) => r.id)).toEqual([id]);

		const audits = await db
			.select({ action: auditLog.action })
			.from(auditLog)
			.where(and(eq(auditLog.entity, 'product'), inArray(auditLog.entityId, [id, copyId])));
		expect(audits.map((a) => a.action).sort()).toEqual(['archive', 'create', 'duplicate', 'update']);
	});
});

describe('prepareProductForm (no-JS edits)', () => {
	it('applies relation add/remove and expands the variant matrix', async () => {
		const { prepareProductForm } = await import('#lib/schemas/product.ts');
		const raw = formToObject(
			fd([
				['slug', 'ring'],
				['related', 'a'],
				['related', 'b'],
				['relatedRemove', 'a'],
				['relatedAdd', 'c'],
				['variants.0.sku', 'RING-GO-50'],
				['variants.0.metal', 'gold'],
				['variants.0.size', '50'],
				['variants.1.sku', ''],
				['variants.1.size', ''],
				['matrix.metals', 'gold'],
				['matrix.metals', 'silver'],
				['matrix.sizes', '50, 52']
			])
		) as Record<string, unknown>;
		const out = prepareProductForm(raw);
		expect(out.related).toEqual(['b', 'c']);
		expect((out.variants as { sku: string }[]).map((v) => v.sku)).toEqual(['RING-GO-50', 'RING-GO-52', 'RING-SI-50', 'RING-SI-52']);
		expect(out.matrix).toBeUndefined();
	});
});
