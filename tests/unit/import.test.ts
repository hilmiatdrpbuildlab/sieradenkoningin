import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray, like } from 'drizzle-orm';
import { createDb, type DB } from '#lib/server/db/index.ts';
import { products, stockMovements, variants } from '#lib/server/db/schema.ts';
import {
	commitImport,
	dryRun,
	exportCsv,
	IMPORT_COLUMNS,
	parseEuro,
	parseImportCsv,
	parseImportRecord,
	planImport,
	templateCsv,
	type CategoryRef,
	type ImportLookup
} from '#lib/server/services/import.ts';
import { parseCsvRecords, recordsToCsv } from '#lib/utils/csv.ts';

const CATS: CategoryRef[] = [
	{ key: 'rings', slugs: { nl: 'ringen', fr: 'bagues' }, name: { nl: 'Ringen', fr: 'Bagues' } },
	{ key: 'bracelets', slugs: { nl: 'armbanden', fr: 'bracelets' }, name: { nl: 'Armbanden', fr: 'Bracelets' } }
];
const emptyLookup = (): ImportLookup => ({ categories: CATS, products: new Map(), variants: new Map() });

describe('parseEuro', () => {
	it('parses Belgian and dotted notations', () => {
		expect(parseEuro('49,95')).toBe(4995);
		expect(parseEuro('49.95')).toBe(4995);
		expect(parseEuro('€ 1.249,95')).toBe(124995);
		expect(parseEuro('1,249.50')).toBe(124950);
		expect(parseEuro('49')).toBe(4900);
		expect(parseEuro('')).toBeUndefined();
		expect(parseEuro('abc')).toBeNaN();
		expect(parseEuro('-5')).toBeNaN();
		expect(parseEuro('4,999')).toBeNaN();
	});
});

describe('parseImportRecord', () => {
	it('maps aliases (NL category name, metal, status, booleans)', () => {
		const r = parseImportRecord(
			{ product_slug: 'Demo-A', name_nl: 'A', category: 'Ringen', status: 'Actief', price: '10', featured: 'ja', sku: 'demo-a-go', metal: 'Goud', stock: '3' },
			2,
			CATS
		);
		expect(r.errors).toEqual([]);
		expect(r.slug).toBe('demo-a');
		expect(r.product).toMatchObject({ categoryKey: 'rings', status: 'active', price: 1000, featured: true });
		expect(r.variant).toEqual({ sku: 'DEMO-A-GO', metal: 'gold', stock: 3 });
	});

	it('collects every problem of a row in Dutch', () => {
		const r = parseImportRecord({ product_slug: 'x y', category: 'hoeden', price: 'gratis', sku: 'A', metal: 'brons', stock: '-1' }, 7, CATS);
		expect(r.errors).toHaveLength(5);
		expect(r.errors.join(' ')).toMatch(/Ongeldige product_slug.*Onbekende categorie.*Ongeldige prijs.*Ongeldig metaal.*negatief/);
	});
});

describe('planImport', () => {
	it('merges product fields per slug, flags duplicates and foreign SKUs', () => {
		const lookup = emptyLookup();
		lookup.products.set('bestaand', { id: 'p1', status: 'draft', hasImage: false, variantCount: 1 });
		lookup.variants.set('BESTAAND-GO', { id: 'v1', productSlug: 'bestaand', stock: 4 });
		const parsed = [
			{ product_slug: 'nieuw', name_nl: 'Nieuw', category: 'rings', price: '20', status: 'active', sku: 'N-1', stock: '2' },
			{ product_slug: 'nieuw', sku: 'N-2', metal: 'silver' },
			{ product_slug: 'nieuw', sku: 'N-1' },
			{ product_slug: 'nieuw', sku: 'BESTAAND-GO' },
			{ product_slug: 'bestaand', sku: 'BESTAAND-GO', stock: '10' },
			{ product_slug: 'bestaand', status: 'active', sku: '' }
		].map((rec, i) => parseImportRecord(rec, i + 2, CATS));
		const plan = planImport(parsed, lookup);
		const byLine = Object.fromEntries(plan.rows.map((r) => [r.line, r]));
		expect(byLine[2]).toMatchObject({ action: 'create', productAction: 'create', variantAction: 'create' });
		expect(byLine[2].warnings[0]).toMatch(/concept/);
		expect(byLine[3].action).toBe('create');
		expect(byLine[4].errors[0]).toMatch(/komt al voor op regel 2/);
		expect(byLine[5].errors[0]).toMatch(/hoort bij product “bestaand”/);
		// the "bestaand" group cannot be activated without an image → all its rows fail
		expect(byLine[6].action).toBe('error');
		expect(byLine[7].errors.join()).toMatch(/geen foto/);
		expect(plan.products.find((p) => p.slug === 'nieuw')!.fields.status).toBe('draft');
	});

	it('requires name, category and price for new products', () => {
		const plan = planImport([parseImportRecord({ product_slug: 'leeg', sku: 'L-1' }, 2, CATS)], emptyLookup());
		expect(plan.rows[0].action).toBe('error');
		expect(plan.rows[0].errors).toHaveLength(3);
	});

	it('computes stock deltas against current stock', () => {
		const lookup = emptyLookup();
		lookup.products.set('pp', { id: 'p1', status: 'active', hasImage: true, variantCount: 1 });
		lookup.variants.set('P-GO', { id: 'v1', productSlug: 'pp', stock: 4 });
		const plan = planImport([parseImportRecord({ product_slug: 'pp', sku: 'P-GO', stock: '1' }, 2, CATS)], lookup);
		expect(plan.rows[0]).toMatchObject({ action: 'update', variantAction: 'update', stockDelta: -3 });
	});
});

describe('CSV files', () => {
	it('template uses every column, semicolons and a BOM, and parses back cleanly', () => {
		const csv = templateCsv();
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		const { headers } = parseCsvRecords(csv);
		expect(headers).toEqual([...IMPORT_COLUMNS]);
		const parsed = parseImportCsv(csv, CATS);
		expect(parsed[0].errors).toEqual([]);
	});

	it('rejects files without the required columns', () => {
		expect(() => parseImportCsv('naam;prijs\nx;1', CATS)).toThrow(/Kolommen ontbreken/);
		expect(() => parseImportCsv('product_slug;sku\n', CATS)).toThrow(/geen rijen/);
	});
});

// ── Integration: 50 rows against the local database ────────────────────────────────
const DB_URL = process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin';
const RUN = `test-imp-${Date.now().toString(36)}`;
const actor = {
	admin: { id: crypto.randomUUID(), name: 'Unit test', email: 'unit@example.invalid', role: 'owner' as const, sessionId: 'unit' },
	ip: '127.0.0.1'
};

describe('import 50 rows (database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let demoSku: string;

	beforeAll(async () => {
		({ db, close } = createDb(DB_URL, 2));
		const [v] = await db.select({ sku: variants.sku }).from(variants).limit(1);
		demoSku = v.sku;
	});
	afterAll(async () => {
		await db.delete(products).where(like(products.slug, `${RUN}%`));
		await close();
	});

	function buildCsv() {
		const rows: Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>[] = [];
		// 15 new products × 3 variants = 45 valid rows
		for (let p = 0; p < 15; p++) {
			for (const [i, metal] of (['gold', 'silver', 'rosegold'] as const).entries()) {
				rows.push({
					product_slug: `${RUN}-p${p}`,
					...(i === 0 ? { name_nl: `DEMO Import ${p}`, name_fr: `DEMO Import ${p} FR`, category: p % 2 ? 'bracelets' : 'rings', price: '39,95', tags: 'import' } : {}),
					sku: `${RUN}-P${p}-${metal}`.toUpperCase(),
					metal,
					size: '52',
					stock: String(p + i)
				});
			}
		}
		// 5 broken rows
		rows.push({ product_slug: `${RUN}-p0`, sku: `${RUN}-BAD-NEG`.toUpperCase(), stock: '-3' }); // negative stock
		rows.push({ product_slug: `${RUN}-p1`, sku: `${RUN}-BAD-METAL`.toUpperCase(), metal: 'brons' }); // bad metal
		rows.push({ product_slug: `${RUN}-p2`, sku: `${RUN}-P2-gold`.toUpperCase() }); // duplicate SKU in file
		rows.push({ product_slug: `${RUN}-p3`, sku: demoSku }); // SKU of another product
		rows.push({ product_slug: `${RUN}-noname`, category: 'rings', price: '10', sku: `${RUN}-NONAME`.toUpperCase() }); // missing name
		return recordsToCsv(IMPORT_COLUMNS, rows, { delimiter: ';', bom: true });
	}

	it('dry-runs without writing, then commits valid rows with per-row errors', async () => {
		const csv = buildCsv();
		const plan = await dryRun(db, csv);
		expect(plan.summary.rows).toBe(50);
		expect(plan.summary.errors).toBe(5);
		expect(plan.summary.create).toBe(45);
		expect(plan.summary.productsCreate).toBe(15);
		const errorLines = plan.rows.filter((r) => r.action === 'error').map((r) => r.line);
		expect(errorLines).toEqual([47, 48, 49, 50, 51]);
		expect((await db.select().from(products).where(like(products.slug, `${RUN}%`))).length).toBe(0);

		const result = await commitImport(db, actor, csv);
		expect(result.summary.errors).toBe(5);
		expect(result.summary.create).toBe(45);
		const created = await db.select({ id: products.id, status: products.status }).from(products).where(like(products.slug, `${RUN}%`));
		expect(created).toHaveLength(15);
		expect(created.every((p) => p.status === 'draft')).toBe(true);
		const vars = await db
			.select({ id: variants.id, stock: variants.stock })
			.from(variants)
			.where(inArray(variants.productId, created.map((c) => c.id)));
		expect(vars).toHaveLength(45);
		const movements = await db
			.select()
			.from(stockMovements)
			.where(inArray(stockMovements.variantId, vars.map((v) => v.id)));
		expect(movements.every((m) => m.reason === 'import')).toBe(true);
		expect(movements.reduce((s, m) => s + m.delta, 0)).toBe(vars.reduce((s, v) => s + v.stock, 0));

		// Re-import updates: stock change is a delta, and the export round-trips
		const again = await commitImport(db, actor, csv.replace(`${RUN}-P0-GOLD`.toUpperCase() + ';gold;52;0', `${RUN}-P0-GOLD`.toUpperCase() + ';gold;52;7'));
		expect(again.summary.update).toBe(45);
		const [v0] = await db.select({ stock: variants.stock }).from(variants).where(eq(variants.sku, `${RUN}-P0-GOLD`.toUpperCase()));
		expect(v0.stock).toBe(7);
		const exported = await exportCsv(db);
		expect(exported).toContain(`${RUN}-P0-GOLD`.toUpperCase());
	});
});
