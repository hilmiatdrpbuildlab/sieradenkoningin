/**
 * Invoices (P3-03). An invoice NUMBER is assigned gap-free when the order is paid (orders.ts →
 * nextInvoiceNumber); the PDF is produced afterwards by the queued job `invoice.generate` and stored
 * privately under `invoices/<year>/<number>.pdf` (orders.invoice_key). The /media route never serves
 * that prefix publicly; downloads go through /api/invoices/[number] (admin, owning customer or guest
 * access token).
 *
 * The page layout is a PURE function (`layoutInvoice`) producing positioned text items, so the text
 * layer can be snapshot-tested without extracting text from the PDF; `renderInvoicePdf` only draws it.
 * Labels are bilingual (the invoice follows the order's language), kept here because the PDF is a
 * server-side legal document, not UI.
 */
import { eq } from 'drizzle-orm';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { Executor } from '../db/index.ts';
import { orderEvents, orderLines, orders } from '../db/schema.ts';
import type { Storage } from '../adapters/storage.ts';
import type { JobDeps, JobRow } from '../jobs/index.ts';
import { getSettings, type StoreSettings } from './settings.ts';
import { tr } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/paths.ts';
import { TIME_ZONE } from '../../utils/format.ts';

// ── Data ───────────────────────────────────────────────────────────────────────

export interface InvoiceLine {
	description: string;
	variant: string;
	sku: string;
	qty: number;
	unitPrice: number;
	/** Gross line amount before discount (unitPrice × qty). */
	gross: number;
	discount: number;
	vatRate: number; // basis points
	vatAmount: number;
}

export interface InvoiceData {
	locale: Lang;
	invoiceNumber: string;
	invoiceDate: Date;
	orderNumber: string;
	paymentMethod: string | null;
	seller: StoreSettings;
	buyer: {
		name: string;
		company?: string;
		address: string[];
		email: string;
		vatNumber: string | null;
	};
	lines: InvoiceLine[];
	subtotal: number;
	discount: number;
	discountCode: string | null;
	shipping: number;
	shippingVat: number;
	vatTotal: number;
	total: number;
}

/** VAT breakdown per rate: taxable base (excl. VAT), VAT, gross. Shipping is taxed at 21%. */
export function vatBreakdown(d: Pick<InvoiceData, 'lines' | 'shipping' | 'shippingVat'>) {
	const by = new Map<number, { rate: number; gross: number; vat: number }>();
	const add = (rate: number, gross: number, vat: number) => {
		const r = by.get(rate) ?? { rate, gross: 0, vat: 0 };
		r.gross += gross;
		r.vat += vat;
		by.set(rate, r);
	};
	for (const l of d.lines) add(l.vatRate, l.gross - l.discount, l.vatAmount);
	if (d.shipping > 0) add(2100, d.shipping, d.shippingVat);
	return [...by.values()].sort((a, b) => b.rate - a.rate).map((r) => ({ ...r, base: r.gross - r.vat }));
}

export async function invoiceData(db: Executor, orderId: string): Promise<InvoiceData | null> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
	if (!order || !order.invoiceNumber) return null;
	const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
	const { store } = await getSettings(db, ['store']);
	const locale: Lang = order.locale === 'fr' ? 'fr' : 'nl';
	const b = order.billingAddress;
	const lineVat = lines.reduce((s, l) => s + l.vatAmount, 0);
	return {
		locale,
		invoiceNumber: order.invoiceNumber,
		invoiceDate: order.paidAt ?? order.placedAt,
		orderNumber: order.number,
		paymentMethod: order.paymentMethod,
		seller: store,
		buyer: {
			name: b.name,
			company: b.company || undefined,
			address: [b.line1, b.line2, `${b.postalCode} ${b.city}`, b.country].filter((x): x is string => !!x),
			email: order.email,
			vatNumber: order.vatNumber
		},
		lines: lines.map((l) => ({
			description: tr(l.name, locale),
			variant: tr(l.variantLabel, locale),
			sku: l.sku,
			qty: l.qty,
			unitPrice: l.unitPrice,
			gross: l.lineTotal,
			discount: l.discountAmount,
			vatRate: l.vatRate,
			vatAmount: l.vatAmount
		})),
		subtotal: order.subtotal,
		discount: order.discountTotal,
		discountCode: order.discountCode,
		shipping: order.shippingTotal,
		shippingVat: Math.max(0, order.vatTotal - lineVat),
		vatTotal: order.vatTotal,
		total: order.total
	};
}

// ── Layout (pure) ──────────────────────────────────────────────────────────────

const LABELS = {
	nl: {
		title: 'Factuur',
		invoiceNumber: 'Factuurnummer',
		invoiceDate: 'Factuurdatum',
		orderNumber: 'Bestelnummer',
		payment: 'Betaling',
		paid: 'Betaald',
		seller: 'Verkoper',
		buyer: 'Factuuradres',
		kbo: 'Ondernemingsnr.',
		vat: 'Btw-nr.',
		buyerVat: 'Btw-nr. klant',
		description: 'Omschrijving',
		qty: 'Aantal',
		unit: 'Eenheidsprijs',
		discount: 'Korting',
		vatCol: 'Btw',
		lineTotal: 'Totaal',
		subtotal: 'Subtotaal',
		shipping: 'Verzending',
		total: 'Totaal (incl. btw)',
		breakdown: 'Btw-overzicht',
		rate: 'Tarief',
		base: 'Maatstaf van heffing',
		vatAmount: 'Btw',
		note: 'Alle bedragen in euro, inclusief btw. Deze factuur werd volledig betaald.',
		page: 'Pagina'
	},
	fr: {
		title: 'Facture',
		invoiceNumber: 'Numéro de facture',
		invoiceDate: 'Date de facture',
		orderNumber: 'Numéro de commande',
		payment: 'Paiement',
		paid: 'Payée',
		seller: 'Vendeur',
		buyer: 'Adresse de facturation',
		kbo: "N° d'entreprise",
		vat: 'N° TVA',
		buyerVat: 'N° TVA client',
		description: 'Description',
		qty: 'Qté',
		unit: 'Prix unitaire',
		discount: 'Remise',
		vatCol: 'TVA',
		lineTotal: 'Total',
		subtotal: 'Sous-total',
		shipping: 'Livraison',
		total: 'Total (TVA comprise)',
		breakdown: 'Récapitulatif TVA',
		rate: 'Taux',
		base: 'Base imposable',
		vatAmount: 'TVA',
		note: 'Montants en euros, TVA comprise. Cette facture a été intégralement payée.',
		page: 'Page'
	}
} as const;

const METHODS: Record<Lang, Record<string, string>> = {
	nl: {
		bancontact: 'Bancontact',
		creditcard: 'Kredietkaart',
		applepay: 'Apple Pay',
		googlepay: 'Google Pay',
		kbc: 'KBC/CBC',
		belfius: 'Belfius'
	},
	fr: {
		bancontact: 'Bancontact',
		creditcard: 'Carte de crédit',
		applepay: 'Apple Pay',
		googlepay: 'Google Pay',
		kbc: 'KBC/CBC',
		belfius: 'Belfius'
	}
};

export interface TextItem {
	text: string;
	x: number;
	y: number;
	size: number;
	bold?: boolean;
	accent?: boolean;
	align?: 'left' | 'right';
}
export interface Rule {
	x1: number;
	x2: number;
	y: number;
}
export interface InvoicePage {
	items: TextItem[];
	rules: Rule[];
}
/** Text width at a font size (pdf-lib's `widthOfTextAtSize` in production; a stub in tests). */
export type Measure = (text: string, size: number, bold: boolean) => number;

export const PAGE = { width: 595.28, height: 841.89, margin: 48 };

const money = (cents: number, locale: Lang) =>
	new Intl.NumberFormat(locale === 'fr' ? 'fr-BE' : 'nl-BE', { style: 'currency', currency: 'EUR' }).format(
		cents / 100
	);
const pct = (bp: number) => `${(bp / 100).toLocaleString('nl-BE')}%`;
const date = (d: Date, locale: Lang) =>
	new Intl.DateTimeFormat(locale === 'fr' ? 'fr-BE' : 'nl-BE', {
		timeZone: TIME_ZONE,
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	}).format(d);

/** Truncates text to fit `width` (adds an ellipsis). */
function fit(text: string, width: number, size: number, bold: boolean, measure: Measure) {
	if (measure(text, size, bold) <= width) return text;
	let t = text;
	while (t.length > 1 && measure(t + '...', size, bold) > width) t = t.slice(0, -1);
	return t.trimEnd() + '...';
}

/**
 * Lays the invoice out on A4 pages. Returns positioned text (PDF coordinates: origin bottom-left).
 * Long orders continue on extra pages; the totals block always follows the last line.
 */
export function layoutInvoice(d: InvoiceData, measure: Measure): InvoicePage[] {
	const L = LABELS[d.locale];
	const { width, height, margin } = PAGE;
	const right = width - margin;
	const pages: InvoicePage[] = [];
	let page: InvoicePage = { items: [], rules: [] };
	pages.push(page);
	const text = (t: string, x: number, y: number, size = 9, o: Partial<TextItem> = {}) => {
		if (t) page.items.push({ text: t, x, y, size, ...o });
	};
	const rtext = (t: string, x: number, y: number, size = 9, o: Partial<TextItem> = {}) =>
		text(t, x, y, size, { ...o, align: 'right' });

	// Header: store name + title + meta
	let y = height - margin - 6;
	text(d.seller.name || 'Sieradenkoningin', margin, y, 20, { accent: true });
	rtext(L.title.toUpperCase(), right, y, 16, { bold: true, accent: true });
	y -= 34;

	// Seller block (left) and invoice meta (right)
	const s = d.seller;
	const sellerLines = [
		s.legalName || s.name,
		s.street,
		[s.postalCode, s.city].filter(Boolean).join(' '),
		s.country,
		s.kbo ? `${L.kbo} ${s.kbo}` : '',
		s.vat ? `${L.vat} ${s.vat}` : '',
		s.email,
		s.phone
	].filter(Boolean);
	text(L.seller.toUpperCase(), margin, y, 7, { bold: true });
	const meta: [string, string][] = [
		[L.invoiceNumber, d.invoiceNumber],
		[L.invoiceDate, date(d.invoiceDate, d.locale)],
		[L.orderNumber, d.orderNumber],
		[
			L.payment,
			[L.paid, d.paymentMethod ? (METHODS[d.locale][d.paymentMethod] ?? d.paymentMethod) : '']
				.filter(Boolean)
				.join(' - ')
		]
	];
	let my = y;
	for (const [k, v] of meta) {
		rtext(k, right - 130, my, 8);
		rtext(v, right, my, 9, { bold: true });
		my -= 14;
	}
	let sy = y - 13;
	for (const l of sellerLines) {
		text(l, margin, sy, 9);
		sy -= 12;
	}
	y = Math.min(sy, my) - 16;

	// Buyer block
	text(L.buyer.toUpperCase(), margin, y, 7, { bold: true });
	y -= 13;
	const buyerLines = [
		d.buyer.company ?? '',
		d.buyer.name,
		...d.buyer.address,
		d.buyer.email,
		d.buyer.vatNumber ? `${L.buyerVat} ${d.buyer.vatNumber}` : ''
	].filter(Boolean);
	for (const l of buyerLines) {
		text(l, margin, y, 9, { bold: l === (d.buyer.company || d.buyer.name) });
		y -= 12;
	}
	y -= 14;

	// Lines table
	const col = { desc: margin, qty: right - 250, unit: right - 175, disc: right - 110, vat: right - 70, total: right };
	const header = () => {
		text(L.description, col.desc, y, 8, { bold: true });
		rtext(L.qty, col.qty, y, 8, { bold: true });
		rtext(L.unit, col.unit, y, 8, { bold: true });
		rtext(L.discount, col.disc, y, 8, { bold: true });
		rtext(L.vatCol, col.vat, y, 8, { bold: true });
		rtext(L.lineTotal, col.total, y, 8, { bold: true });
		page.rules.push({ x1: margin, x2: right, y: y - 6 });
		y -= 20;
	};
	const newPage = () => {
		page = { items: [], rules: [] };
		pages.push(page);
		y = height - margin - 6;
		text(`${L.title} ${d.invoiceNumber}`, margin, y, 9, { bold: true });
		y -= 28;
		header();
	};
	header();
	const descWidth = col.qty - 40 - col.desc;
	for (const l of d.lines) {
		if (y < margin + 60) newPage();
		text(fit(l.description, descWidth, 9, false, measure), col.desc, y, 9);
		rtext(String(l.qty), col.qty, y, 9);
		rtext(money(l.unitPrice, d.locale), col.unit, y, 9);
		rtext(l.discount ? `-${money(l.discount, d.locale)}` : '', col.disc, y, 9);
		rtext(pct(l.vatRate), col.vat, y, 9);
		rtext(money(l.gross - l.discount, d.locale), col.total, y, 9);
		const sub = [l.variant, l.sku].filter(Boolean).join(' - ');
		text(fit(sub, descWidth, 7.5, false, measure), col.desc, y - 10, 7.5);
		y -= 26;
	}
	page.rules.push({ x1: margin, x2: right, y: y + 12 });

	// Totals (+ VAT breakdown) — needs ~ 190pt
	if (y < margin + 190) newPage();
	y -= 4;
	const total = (k: string, v: string, o: Partial<TextItem> = {}) => {
		rtext(k, right - 110, y, o.size ?? 9, o);
		rtext(v, right, y, o.size ?? 9, o);
		y -= (o.size ?? 9) + 6;
	};
	total(L.subtotal, money(d.subtotal, d.locale));
	if (d.discount > 0)
		total(d.discountCode ? `${L.discount} (${d.discountCode})` : L.discount, `-${money(d.discount, d.locale)}`);
	total(L.shipping, money(d.shipping, d.locale));
	page.rules.push({ x1: right - 230, x2: right, y: y + 8 });
	y -= 4;
	total(L.total, money(d.total, d.locale), { bold: true, size: 11, accent: true });
	y -= 14;

	text(L.breakdown.toUpperCase(), margin, y, 7, { bold: true });
	y -= 14;
	text(L.rate, margin, y, 8, { bold: true });
	rtext(L.base, margin + 220, y, 8, { bold: true });
	rtext(L.vatAmount, margin + 300, y, 8, { bold: true });
	rtext(L.lineTotal, margin + 380, y, 8, { bold: true });
	page.rules.push({ x1: margin, x2: margin + 380, y: y - 5 });
	y -= 17;
	for (const r of vatBreakdown(d)) {
		text(pct(r.rate), margin, y, 9);
		rtext(money(r.base, d.locale), margin + 220, y, 9);
		rtext(money(r.vat, d.locale), margin + 300, y, 9);
		rtext(money(r.gross, d.locale), margin + 380, y, 9);
		y -= 14;
	}
	y -= 18;
	text(L.note, margin, y, 8);

	// Footer: page numbers
	pages.forEach((p, i) => {
		p.items.push({
			text: `${d.invoiceNumber} - ${L.page} ${i + 1}/${pages.length}`,
			x: right,
			y: margin - 20,
			size: 7,
			align: 'right'
		});
	});
	return pages;
}

/** The text layer as plain lines (top to bottom, left to right) — what the snapshot test asserts. */
export function invoiceText(pages: InvoicePage[]): string {
	return pages
		.map((p, i) => {
			const rows = new Map<number, TextItem[]>();
			for (const it of p.items) rows.set(it.y, [...(rows.get(it.y) ?? []), it]);
			const body = [...rows.entries()]
				.sort((a, b) => b[0] - a[0])
				.map(([, items]) =>
					items
						.sort((a, b) => a.x - b.x)
						.map((t) => t.text)
						.join(' | ')
				);
			return [`--- page ${i + 1} ---`, ...body].join('\n');
		})
		.join('\n');
}

// ── PDF ────────────────────────────────────────────────────────────────────────

/** Brand burgundy (--sk-burgundy) as PDF rgb fractions. */
const ACCENT = rgb(57 / 255, 22 / 255, 23 / 255);
const INK = rgb(73 / 255, 37 / 255, 32 / 255);
const LINE = rgb(217 / 255, 203 / 255, 191 / 255);

/** Standard PDF fonts only encode WinAnsi: map typographic spaces, replace anything else with "?". */
function winAnsi(font: PDFFont, text: string) {
	const set = new Set(font.getCharacterSet());
	let out = '';
	for (const ch of text.replace(/\s/g, ' ')) out += set.has(ch.codePointAt(0)!) ? ch : '?';
	return out;
}

export async function renderInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.setTitle(`${LABELS[d.locale].title} ${d.invoiceNumber}`);
	doc.setAuthor(d.seller.legalName || d.seller.name || 'Sieradenkoningin');
	doc.setCreationDate(d.invoiceDate);
	const regular = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);
	const measure: Measure = (t, size, b) => (b ? bold : regular).widthOfTextAtSize(winAnsi(b ? bold : regular, t), size);
	for (const p of layoutInvoice(d, measure)) {
		const page = doc.addPage([PAGE.width, PAGE.height]);
		for (const r of p.rules)
			page.drawLine({ start: { x: r.x1, y: r.y }, end: { x: r.x2, y: r.y }, thickness: 0.6, color: LINE });
		for (const it of p.items) {
			const font = it.bold ? bold : regular;
			const t = winAnsi(font, it.text);
			const x = it.align === 'right' ? it.x - font.widthOfTextAtSize(t, it.size) : it.x;
			page.drawText(t, { x, y: it.y, size: it.size, font, color: it.accent ? ACCENT : INK });
		}
	}
	return doc.save();
}

// ── Storage + job ──────────────────────────────────────────────────────────────

export const invoiceKey = (invoiceNumber: string) => `invoices/${invoiceNumber.slice(7, 11)}/${invoiceNumber}.pdf`;

/**
 * Renders and stores the invoice PDF of a paid order and saves `orders.invoice_key`. Idempotent:
 * the key is derived from the invoice number, so a re-run overwrites the same object.
 */
export async function generateInvoice(deps: { db: Executor; storage: Storage }, orderId: string) {
	const data = await invoiceData(deps.db, orderId);
	if (!data) throw new Error(`invoice: order ${orderId} not found or not invoiced yet`);
	const pdf = await renderInvoicePdf(data);
	const key = invoiceKey(data.invoiceNumber);
	await deps.storage.put(key, pdf, 'application/pdf');
	const [prev] = await deps.db.select({ key: orders.invoiceKey }).from(orders).where(eq(orders.id, orderId));
	if (prev?.key !== key) {
		await deps.db.update(orders).set({ invoiceKey: key, updatedAt: new Date() }).where(eq(orders.id, orderId));
		await deps.db
			.insert(orderEvents)
			.values({ orderId, type: 'invoice', actor: 'system', data: { invoiceNumber: data.invoiceNumber } });
	}
	return { key, pdf, invoiceNumber: data.invoiceNumber };
}

/** Job handler `invoice.generate` — payload `{ orderId }`. Needs object storage in the job deps. */
export async function invoiceGenerateJob(job: JobRow, deps: JobDeps) {
	const { orderId } = job.payload as { orderId?: string };
	if (!orderId) throw new Error('invoice.generate: orderId required');
	if (!deps.storage) throw new Error('invoice.generate: no storage in job deps (runs from the cron)');
	await generateInvoice({ db: deps.db, storage: deps.storage }, orderId);
}
