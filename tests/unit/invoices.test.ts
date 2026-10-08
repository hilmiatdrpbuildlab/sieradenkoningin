/** P3-03 — invoice PDF: text-layer snapshot, rendering, storage job, gap-free numbering under concurrency. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, like, sql } from 'drizzle-orm';
import { PDFDocument, PDFRawStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import { jobs, orders, payments } from '#lib/server/db/schema.ts';
import { placeOrder } from '#lib/server/services/checkout.ts';
import { brusselsYear, nextInvoiceNumber, syncPayment } from '#lib/server/services/orders.ts';
import {
	generateInvoice,
	invoiceData,
	invoiceKey,
	invoiceText,
	layoutInvoice,
	renderInvoicePdf,
	vatBreakdown,
	type InvoiceData
} from '#lib/server/services/invoices.ts';
import { runJobs } from '#lib/server/jobs/index.ts';
import { createStorage } from '#lib/server/adapters/storage.ts';
import {
	checkoutData,
	deps,
	ensureShipping,
	makeCart,
	makeVariant,
	openTestDb,
	setMockStatus
} from './checkout-fixtures.ts';

const { db, close } = openTestDb();
const storage = createStorage({
	STORAGE_ENDPOINT: '',
	STORAGE_BUCKET: '',
	STORAGE_ACCESS_KEY_ID: '',
	STORAGE_SECRET_ACCESS_KEY: '',
	PUBLIC_MEDIA_URL: '',
	SESSION_SECRET: 'test'
});
beforeAll(() => ensureShipping(db));
afterAll(() => close());

const sample: InvoiceData = {
	locale: 'nl',
	invoiceNumber: 'SK-INV-2026-000042',
	invoiceDate: new Date('2026-10-08T10:00:00Z'),
	orderNumber: 'SK-2026-000123',
	paymentMethod: 'bancontact',
	seller: {
		name: 'Sieradenkoningin',
		legalName: 'DEMO Sieradenkoningin BV',
		street: 'Demostraat 1',
		postalCode: '9000',
		city: 'Gent',
		country: 'BE',
		kbo: '0123.456.789',
		vat: 'BE0123456789',
		email: 'hallo@example.invalid',
		phone: ''
	},
	buyer: {
		name: 'Ann DEMO',
		company: 'DEMO Bedrijf BV',
		address: ['Kerkstraat 5', '1000 Brussel', 'BE'],
		email: 'ann@example.invalid',
		vatNumber: 'BE0987654321'
	},
	lines: [
		{
			description: 'DEMO Klaverring',
			variant: 'Goud · 52',
			sku: 'DEMO-KR-52',
			qty: 1,
			unitPrice: 4995,
			gross: 4995,
			discount: 455,
			vatRate: 2100,
			vatAmount: 788
		},
		{
			description: 'DEMO Armband',
			variant: 'Zilver',
			sku: 'DEMO-AB',
			qty: 2,
			unitPrice: 2995,
			gross: 5990,
			discount: 545,
			vatRate: 2100,
			vatAmount: 945
		}
	],
	subtotal: 10985,
	discount: 1000,
	discountCode: 'DEMO10',
	shipping: 495,
	shippingVat: 86,
	vatTotal: 1819,
	total: 10480
};
/** Deterministic text measurement (Helvetica averages ≈ 0.5 em). */
const measure = (t: string, size: number) => t.length * size * 0.5;

describe('invoice layout (text layer)', () => {
	it('NL snapshot: seller, numbers, buyer + VAT number, lines, discount, shipping, VAT breakdown, totals', () => {
		const text = invoiceText(layoutInvoice(sample, measure));
		for (const s of [
			'DEMO Sieradenkoningin BV',
			'Ondernemingsnr. 0123.456.789',
			'Btw-nr. BE0123456789',
			'SK-INV-2026-000042',
			'08/10/2026',
			'SK-2026-000123',
			'Btw-nr. klant BE0987654321',
			'DEMO Klaverring',
			'Korting (DEMO10)',
			'Verzending',
			'Totaal (incl. btw)',
			'BTW-OVERZICHT'
		])
			expect(text).toContain(s);
		expect(text).toMatchSnapshot();
	});

	it('FR snapshot', () => {
		const text = invoiceText(
			layoutInvoice(
				{ ...sample, locale: 'fr', buyer: { ...sample.buyer, company: undefined, vatNumber: null } },
				measure
			)
		);
		expect(text).toContain('Numéro de facture');
		expect(text).toContain('Total (TVA comprise)');
		expect(text).not.toContain('N° TVA client');
		expect(text).toMatchSnapshot();
	});

	it('VAT breakdown reconciles with the order: base + VAT = total', () => {
		const [r] = vatBreakdown(sample);
		expect(r).toEqual({ rate: 2100, gross: 10480, vat: 1819, base: 8661 });
		expect(r.gross).toBe(sample.total);
	});

	it('long orders continue on a second page with the header repeated', () => {
		const many = { ...sample, lines: Array.from({ length: 40 }, (_, i) => ({ ...sample.lines[0], sku: `DEMO-${i}` })) };
		const pages = layoutInvoice(many, measure);
		expect(pages.length).toBeGreaterThan(1);
		const text = invoiceText(pages);
		expect(text).toContain('--- page 2 ---');
		expect(text).toContain(`Pagina 2/${pages.length}`);
	});
});

describe('invoice PDF', () => {
	it('renders a valid A4 PDF whose content stream holds the text', async () => {
		const bytes = await renderInvoicePdf({ ...sample, buyer: { ...sample.buyer, name: 'Zoë Ŧest' } }); // Ŧ is not WinAnsi → '?'
		const doc = await PDFDocument.load(bytes);
		expect(doc.getPageCount()).toBe(1);
		expect(doc.getTitle()).toBe('Factuur SK-INV-2026-000042');
		const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
		expect(Math.round(w)).toBe(595);
		expect(Math.round(h)).toBe(842);
		// Decode the (flate) content stream and look for hex-encoded strings of a few labels.
		let decoded = '';
		for (const [, obj] of doc.context.enumerateIndirectObjects()) {
			if (!(obj instanceof PDFRawStream)) continue;
			try {
				decoded += inflateSync(Buffer.from(obj.contents)).toString('latin1');
			} catch {
				/* not a flate stream (fonts are standard, so only content streams remain) */
			}
		}
		const hex = (s: string) => Buffer.from(s, 'latin1').toString('hex').toUpperCase();
		expect(decoded).toContain(hex('SK-INV-2026-000042'));
		expect(decoded).toContain(hex('Zoë ?est'));
	});
});

async function paidOrder(email = 'invoice@example.com') {
	const v = await makeVariant(db, { stock: 5, price: 3995 });
	const cartId = await makeCart(db, [{ variantId: v.variantId, qty: 1 }]);
	const d = { ...deps(db), storage };
	const r = await placeOrder(d, {
		cartId,
		lang: 'nl',
		customerId: null,
		data: checkoutData({ email, vatNumber: 'BE0123456749', company: 'DEMO BV' })
	});
	if (!r.ok) throw new Error(r.error);
	const [payment] = await db.select().from(payments).where(eq(payments.orderId, r.order.id));
	await setMockStatus(db, payment.providerRef, 'paid');
	return { order: r.order, payment, d };
}

describe('invoice job + storage', () => {
	it('the paid transition queues invoice.generate; the job stores the PDF privately and saves invoice_key', async () => {
		const { order, payment, d } = await paidOrder();
		const r = await syncPayment(d, payment.providerRef); // inline run (storage passed)
		expect(r.outcome).toBe('paid');
		const [job] = await db
			.select()
			.from(jobs)
			.where(eq(jobs.dedupeKey, `invoice:${order.id}`));
		expect(job).toMatchObject({ type: 'invoice.generate', status: 'done' });
		const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
		expect(o.invoiceKey).toBe(invoiceKey(o.invoiceNumber!));
		expect(o.invoiceKey).toMatch(/^invoices\/\d{4}\/SK-INV-\d{4}-\d{6}\.pdf$/);
		const obj = await storage.get(o.invoiceKey!);
		expect((await PDFDocument.load(obj!.body)).getPageCount()).toBe(1);
		const data = await invoiceData(db, order.id);
		expect(data?.buyer).toMatchObject({ company: 'DEMO BV', vatNumber: 'BE0123456749' });
		expect(vatBreakdown(data!)[0].gross).toBe(o.total);
	});

	it('without storage the inline run leaves the invoice job queued for the cron, which then completes it', async () => {
		const { order, payment, d } = await paidOrder();
		const { storage: _s, ...noStorage } = d;
		await syncPayment(noStorage, payment.providerRef);
		const [job] = await db
			.select()
			.from(jobs)
			.where(eq(jobs.dedupeKey, `invoice:${order.id}`));
		expect(job.status).toBe('queued');
		expect(job.attempts).toBe(0);
		await runJobs({ db, email: d.email, siteUrl: d.siteUrl, storage }, { ids: [job.id] });
		const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
		expect(o.invoiceKey).toBeTruthy();
	});

	it('generateInvoice refuses unpaid orders', async () => {
		const v = await makeVariant(db, { stock: 1 });
		const cartId = await makeCart(db, [{ variantId: v.variantId, qty: 1 }]);
		const r = await placeOrder(deps(db), { cartId, lang: 'nl', customerId: null, data: checkoutData() });
		if (!r.ok) throw new Error(r.error);
		await expect(generateInvoice({ db, storage }, r.order.id)).rejects.toThrow(/not invoiced/);
	});
});

describe('invoice numbers', () => {
	it('are sequential without gaps under concurrent paid transitions', async () => {
		const n = 8;
		const made = [];
		for (let i = 0; i < n; i++) made.push(await paidOrder(`inv-${i}@example.com`));
		const results = await Promise.all(
			made.map((m) => syncPayment({ ...m.d, email: undefined }, m.payment.providerRef))
		);
		expect(results.every((r) => r.outcome === 'paid')).toBe(true);
		const mine = (
			await Promise.all(
				made.map(
					async (m) =>
						(await db.select({ n: orders.invoiceNumber }).from(orders).where(eq(orders.id, m.order.id)))[0].n!
				)
			)
		).map((s) => Number(s.slice(-6)));
		expect(new Set(mine).size).toBe(n);
		// No gaps: every number between my lowest and highest exists (other test files may interleave).
		const year = brusselsYear();
		const all = await db
			.select({ n: sql<number>`right(${orders.invoiceNumber}, 6)::int` })
			.from(orders)
			.where(
				and(
					like(orders.invoiceNumber, `SK-INV-${year}-%`),
					sql`right(${orders.invoiceNumber}, 6)::int between ${Math.min(...mine)} and ${Math.max(...mine)}`
				)
			);
		const set = new Set(all.map((r) => Number(r.n)));
		for (let x = Math.min(...mine); x <= Math.max(...mine); x++) expect(set.has(x)).toBe(true);
	});

	it('a rolled-back transaction does not consume a number', async () => {
		let taken = '';
		await expect(
			db.transaction(async (tx) => {
				taken = await nextInvoiceNumber(tx);
				throw new Error('rollback');
			})
		).rejects.toThrow('rollback');
		const again = await db.transaction((tx) => nextInvoiceNumber(tx));
		expect(again).toBe(taken);
	});
});
