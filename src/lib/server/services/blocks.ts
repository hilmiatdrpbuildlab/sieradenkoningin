/**
 * Resolves CMS blocks into render-ready view models for one language (P1-06 / P4-01).
 * Translations are picked here, links are per language, product rails are queried, legal slots are
 * filled from settings — so block components stay dumb and the same data powers the admin preview.
 */
import type { Executor } from '../db/index.ts';
import type { Block } from '../../schemas/page-block.ts';
import { tr } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/paths.ts';
import { picture } from '../../utils/media.ts';
import { bestsellers, cardsByIds, categoryNav, collectionCards, featured, newArrivals, toCard } from './catalog.ts';
import { getFaqs } from './content.ts';
import { getSettings } from './settings.ts';
import type { ProductCardData } from '../../types.ts';

type Link = { label: string; href: string } | null;
const link = (l: { label: { nl: string; fr?: string }; href: { nl: string; fr?: string } } | undefined, lang: Lang): Link =>
	l && tr(l.label, lang) ? { label: tr(l.label, lang), href: tr(l.href, lang) } : null;
const image = (i: { key: string; alt: { nl: string; fr?: string }; width?: number; height?: number }, lang: Lang, width = 1600) => ({
	...picture(i.key, tr(i.alt, lang), width),
	width: i.width,
	height: i.height
});

export type ResolvedBlock = { id: string; type: Block['type']; view: Record<string, unknown> };

export async function resolveBlocks(db: Executor, blocks: Block[], lang: Lang): Promise<ResolvedBlock[]> {
	const card = (rows: Parameters<typeof toCard>[0][]) => rows.map((r) => toCard(r, lang, (key, alt) => picture(key, alt, 800)));
	const out: ResolvedBlock[] = [];
	for (const b of blocks) {
		let view: Record<string, unknown>;
		switch (b.type) {
			case 'hero': {
				const d = b.data;
				view = {
					variant: d.variant,
					overline: tr(d.overline, lang),
					title: tr(d.title, lang),
					script: tr(d.script, lang),
					lead: tr(d.lead, lang),
					image: image(d.image, lang, 2400),
					cta: link(d.cta, lang),
					secondaryCta: link(d.secondaryCta, lang)
				};
				break;
			}
			case 'usp_bar':
				view = { items: b.data.items.map((i) => ({ icon: i.icon, text: tr(i.text, lang) })) };
				break;
			case 'category_strip':
				view = { title: tr(b.data.title, lang), eyebrow: tr(b.data.eyebrow, lang), categories: await categoryNav(db, lang) };
				break;
			case 'product_rail': {
				const d = b.data;
				const limit = d.limit ?? 8;
				let products: ProductCardData[] = [];
				if (d.source === 'new') products = card(await newArrivals(db, limit));
				else if (d.source === 'bestsellers') products = card(await bestsellers(db, limit));
				else if (d.source === 'featured') products = card(await featured(db, limit));
				else if (d.source === 'collection' && d.collectionId) products = card(await collectionCards(db, d.collectionId, limit));
				else if (d.source === 'manual' && d.productIds?.length) products = card(await cardsByIds(db, d.productIds.slice(0, limit)));
				view = { eyebrow: tr(d.eyebrow, lang), title: tr(d.title, lang), products, cta: link(d.cta, lang) };
				break;
			}
			case 'banner':
				view = { image: image(b.data.image, lang), eyebrow: tr(b.data.eyebrow, lang), title: tr(b.data.title, lang), text: tr(b.data.text, lang), cta: link(b.data.cta, lang), surface: b.data.surface };
				break;
			case 'quote_band':
				view = { quote: tr(b.data.quote, lang), attribution: tr(b.data.attribution, lang), surface: b.data.surface };
				break;
			case 'editorial_split':
				view = {
					eyebrow: tr(b.data.eyebrow, lang),
					title: tr(b.data.title, lang),
					script: tr(b.data.script, lang),
					body: tr(b.data.body, lang),
					image: image(b.data.image, lang, 1600),
					cta: link(b.data.cta, lang),
					reverse: b.data.reverse
				};
				break;
			case 'rich_text':
				view = { title: tr(b.data.title, lang), body: tr(b.data.body, lang) };
				break;
			case 'faq_list': {
				const faqs = await getFaqs(db, b.data.group);
				view = { title: tr(b.data.title, lang), items: faqs.map((f) => ({ id: f.id, question: tr(f.question, lang), answer: tr(f.answer, lang) })) };
				break;
			}
			case 'newsletter':
				view = { title: tr(b.data.title, lang), text: tr(b.data.text, lang) };
				break;
			case 'size_table':
				view = { title: tr(b.data.title, lang), kind: b.data.kind };
				break;
			case 'contact_form':
				view = { title: tr(b.data.title, lang) };
				break;
			case 'legal_slot': {
				const { legal, store, return_days } = await getSettings(db, ['legal', 'store', 'return_days']);
				const entry = legal[b.data.slot];
				view = { slot: b.data.slot, body: entry ? tr(entry.body, lang) : '', reviewed: entry?.reviewed ?? false, store, returnDays: return_days };
				break;
			}
			default:
				continue;
		}
		out.push({ id: b.id, type: b.type, view });
	}
	return out;
}
