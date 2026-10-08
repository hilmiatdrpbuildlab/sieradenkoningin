/** Page-builder helpers shared by BlockPicker / BlockEditor / the page editor route (P4-01). */
import { BLOCK_LABELS, BLOCK_TYPES, type BlockType } from '#lib/schemas/page-block.ts';

/** Editable block in the page builder (data stays loosely typed; the server validates with parseBlock). */
export interface EditorBlock {
	id: string;
	type: BlockType;
	data: Record<string, any>;
	hidden?: boolean;
	visibleFrom?: string | null;
	visibleUntil?: string | null;
}

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
	hero: 'Groot openingsbeeld met titel, Allura-woord en knoppen',
	usp_bar: 'Tot 4 korte voordelen met icoon',
	category_strip: 'De zes categorieën met iconen',
	product_rail: 'Rij producten: nieuw, bestsellers, uitgelicht, collectie of handmatig',
	banner: 'Beeld met tekst en knop',
	quote_band: 'Quote op espresso of bordeaux',
	editorial_split: 'Groot beeld naast een verhaal ("Met betekenis")',
	rich_text: 'Tekst met opmaak (markdown)',
	faq_list: 'Veelgestelde vragen (alle of één groep)',
	newsletter: 'Inschrijving nieuwsbrief',
	size_table: 'Ring- of armbandmaten + printbare maatmeter',
	contact_form: 'Contactformulier',
	legal_slot: 'Juridische tekst uit Instellingen → Juridisch'
};

export const PICKER_TYPES: BlockType[] = BLOCK_TYPES;
export { BLOCK_LABELS };

const empty = () => ({ nl: '' });

export function defaultBlockData(type: BlockType): Record<string, any> {
	switch (type) {
		case 'hero':
			return { variant: 'overlay', title: empty() };
		case 'usp_bar':
			return { items: [{ icon: 'truck', text: empty() }] };
		case 'product_rail':
			return { title: empty(), source: 'new', limit: 8 };
		case 'banner':
			return { title: empty(), surface: 'inverse' };
		case 'quote_band':
			return { quote: empty(), surface: 'espresso' };
		case 'editorial_split':
			return { title: empty(), body: empty(), reverse: false };
		case 'rich_text':
			return { body: empty() };
		case 'newsletter':
			return { title: empty() };
		case 'size_table':
			return { kind: 'ring' };
		case 'legal_slot':
			return { slot: 'terms' };
		default:
			return {};
	}
}

export function newBlock(type: BlockType): EditorBlock {
	return {
		id: crypto.randomUUID(),
		type,
		data: defaultBlockData(type),
		hidden: false,
		visibleFrom: null,
		visibleUntil: null
	};
}

/** Short human summary for the collapsed block header. */
export function blockSummary(b: EditorBlock): string {
	const d = b.data;
	const t = d.title?.nl || d.quote?.nl || d.body?.nl || d.items?.[0]?.text?.nl || d.slot || d.kind || '';
	return String(t)
		.replace(/[*#_[\]()]/g, '')
		.slice(0, 80);
}
