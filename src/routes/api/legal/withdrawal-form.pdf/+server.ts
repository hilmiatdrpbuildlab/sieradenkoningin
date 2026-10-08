/**
 * Model withdrawal form as PDF (P4-03): GET /api/legal/withdrawal-form.pdf?lang=nl|fr
 * The wording is the statutory model form of Directive 2011/83/EU, Annex I(B) (Belgian Code of Economic
 * Law, book VI, annex 2) in its official NL/FR versions (messages wd_*). The trader block is filled from
 * settings.store; empty fields stay blank lines — we never invent company data.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { RequestHandler } from './$types';
import { getSetting } from '#lib/server/services/settings.ts';
import { isLang } from '#lib/i18n/paths.ts';
import { m } from '#lib/paraglide/messages.js';

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const INK = rgb(0.2, 0.12, 0.11);
const MUTED = rgb(0.45, 0.35, 0.3);

function wrap(text: string, font: PDFFont, size: number, width: number) {
	const lines: string[] = [];
	for (const para of text.split('\n')) {
		let line = '';
		for (const word of para.split(/\s+/)) {
			const next = line ? `${line} ${word}` : word;
			if (font.widthOfTextAtSize(next, size) > width && line) {
				lines.push(line);
				line = word;
			} else line = next;
		}
		lines.push(line);
	}
	return lines;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const q = url.searchParams.get('lang');
	const lang = isLang(q) ? q : 'nl';
	const o = { locale: lang };
	const store = await getSetting(locals.db, 'store');
	const colon = lang === 'fr' ? ' :' : ':';

	const pdf = await PDFDocument.create();
	pdf.setTitle(m.wd_title({}, o));
	pdf.setAuthor(store.legalName || store.name);
	pdf.setLanguage(lang === 'fr' ? 'fr-BE' : 'nl-BE');
	const regular = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
	const page: PDFPage = pdf.addPage(A4);
	const width = A4[0] - 2 * MARGIN;
	let y = A4[1] - MARGIN;

	const text = (
		s: string,
		opts: { font?: PDFFont; size?: number; color?: typeof INK; gap?: number; indent?: number } = {}
	) => {
		const font = opts.font ?? regular;
		const size = opts.size ?? 11;
		const indent = opts.indent ?? 0;
		for (const line of wrap(s, font, size, width - indent)) {
			y -= size * 1.4;
			page.drawText(line, { x: MARGIN + indent, y, size, font, color: opts.color ?? INK });
		}
		y -= opts.gap ?? 6;
	};
	const blank = (label?: string, count = 1) => {
		if (label) text(label, { gap: 2 });
		for (let i = 0; i < count; i++) {
			y -= 22;
			page.drawLine({ start: { x: MARGIN + 14, y }, end: { x: MARGIN + width, y }, thickness: 0.5, color: MUTED });
		}
		y -= 10;
	};

	text(m.wd_title({}, o), { font: bold, size: 17, gap: 4 });
	text(m.wd_intro({}, o), { font: italic, size: 10, color: MUTED, gap: 16 });

	text(`— ${m.wd_to({}, o)}${colon}`, { gap: 2 });
	const trader = [
		store.legalName || store.name,
		store.street,
		[store.postalCode, store.city].filter(Boolean).join(' '),
		store.country && store.street ? store.country : '',
		store.email,
		store.phone
	].filter(Boolean);
	const hasAddress = !!(store.street && store.city);
	for (const line of trader) text(line, { indent: 14, gap: 0 });
	if (!hasAddress) text(m.wd_trader_missing({}, o), { indent: 14, font: italic, color: MUTED, gap: 0 });
	y -= 12;

	text(`— ${m.wd_notice({}, o)}${colon}`, { gap: 2 });
	blank(undefined, 3);
	blank(`— ${m.wd_ordered({}, o)}${colon}`);
	blank(`— ${m.wd_name({}, o)}${colon}`);
	blank(`— ${m.wd_address({}, o)}${colon}`, 2);
	blank(`— ${m.wd_signature({}, o)}${colon}`);
	blank(`— ${m.wd_date({}, o)}${colon}`);
	y -= 6;
	text(m.wd_strike({}, o), { font: italic, size: 10, color: MUTED });

	const bytes = await pdf.save();
	return new Response(bytes as unknown as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="${lang === 'fr' ? 'formulaire-de-retractation' : 'herroepingsformulier'}.pdf"`,
			'cache-control': 'public, max-age=300, s-maxage=600'
		}
	});
};
