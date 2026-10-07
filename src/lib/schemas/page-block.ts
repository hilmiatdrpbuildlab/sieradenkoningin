/**
 * CMS block types (P4-01). The same shape is used by the seed, the storefront renderers in
 * components/blocks/* and the admin BlockEditor, so the home page can be rebuilt from the admin.
 * Links are stored per language (`href: { nl, fr }`) because public paths are localized.
 */
import { z } from 'zod';
import { i18nSchema } from './common.ts';

const imageRef = z.object({ key: z.string().min(1), alt: i18nSchema, width: z.number().optional(), height: z.number().optional() });
const link = z.object({ label: i18nSchema, href: i18nSchema });

export const blockSchemas = {
	hero: z.object({
		variant: z.enum(['overlay', 'split']).default('overlay'),
		overline: i18nSchema.optional(),
		title: i18nSchema,
		script: i18nSchema.optional(),
		lead: i18nSchema.optional(),
		image: imageRef,
		cta: link.optional(),
		secondaryCta: link.optional()
	}),
	usp_bar: z.object({
		items: z
			.array(z.object({ icon: z.enum(['truck', 'gift', 'sparkle', 'crown', 'clover', 'check']), text: i18nSchema }))
			.min(1)
			.max(4)
	}),
	category_strip: z.object({ title: i18nSchema.optional(), eyebrow: i18nSchema.optional() }),
	product_rail: z.object({
		eyebrow: i18nSchema.optional(),
		title: i18nSchema,
		source: z.enum(['collection', 'manual', 'new', 'bestsellers', 'featured']),
		collectionId: z.string().uuid().optional(),
		productIds: z.array(z.string().uuid()).optional(),
		limit: z.number().int().min(2).max(16).default(8),
		cta: link.optional()
	}),
	banner: z.object({
		image: imageRef,
		eyebrow: i18nSchema.optional(),
		title: i18nSchema,
		text: i18nSchema.optional(),
		cta: link.optional(),
		surface: z.enum(['inverse', 'espresso', 'light']).default('inverse')
	}),
	quote_band: z.object({
		quote: i18nSchema,
		attribution: i18nSchema.optional(),
		surface: z.enum(['espresso', 'inverse']).default('espresso')
	}),
	editorial_split: z.object({
		eyebrow: i18nSchema.optional(),
		title: i18nSchema,
		script: i18nSchema.optional(),
		body: i18nSchema,
		image: imageRef,
		cta: link.optional(),
		reverse: z.boolean().default(false)
	}),
	rich_text: z.object({ title: i18nSchema.optional(), body: i18nSchema }),
	faq_list: z.object({ title: i18nSchema.optional(), group: z.string().optional() }),
	newsletter: z.object({ title: i18nSchema, text: i18nSchema.optional() }),
	size_table: z.object({ title: i18nSchema.optional(), kind: z.enum(['ring', 'bracelet']).default('ring') }),
	contact_form: z.object({ title: i18nSchema.optional() }),
	legal_slot: z.object({ slot: z.string(), note: i18nSchema.optional() })
} as const;

export type BlockType = keyof typeof blockSchemas;
export const BLOCK_TYPES = Object.keys(blockSchemas) as BlockType[];
export type BlockData<T extends BlockType = BlockType> = z.infer<(typeof blockSchemas)[T]>;

export type Block = {
	[T in BlockType]: {
		id: string;
		type: T;
		data: BlockData<T>;
		hidden?: boolean;
		visibleFrom?: string | null;
		visibleUntil?: string | null;
	};
}[BlockType];

export const BLOCK_LABELS: Record<BlockType, string> = {
	hero: 'Hero',
	usp_bar: 'USP-balk',
	category_strip: 'Categorieën',
	product_rail: 'Productrij',
	banner: 'Banner',
	quote_band: 'Quote-band',
	editorial_split: 'Editoriaal (beeld + tekst)',
	rich_text: 'Tekst',
	faq_list: 'FAQ-lijst',
	newsletter: 'Nieuwsbrief',
	size_table: 'Maattabel',
	contact_form: 'Contactformulier',
	legal_slot: 'Juridische tekst (placeholder)'
};

export function parseBlock(type: string, data: unknown) {
	if (!(type in blockSchemas)) return { success: false as const, error: `Onbekend bloktype: ${type}` };
	const r = blockSchemas[type as BlockType].safeParse(data);
	return r.success ? { success: true as const, data: r.data } : { success: false as const, error: r.error.issues[0]?.message ?? 'Ongeldig blok' };
}

/** Is the block visible at `now`? (hidden flag + schedule window; unit-tested with a fake clock) */
export function isBlockVisible(b: { hidden?: boolean; visibleFrom?: string | Date | null; visibleUntil?: string | Date | null }, now = new Date()) {
	if (b.hidden) return false;
	if (b.visibleFrom && new Date(b.visibleFrom) > now) return false;
	if (b.visibleUntil && new Date(b.visibleUntil) <= now) return false;
	return true;
}
