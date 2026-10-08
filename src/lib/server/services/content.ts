/**
 * CMS content (P4-01/P4-02): menus, pages and their scheduled blocks.
 * Blocks are filtered by `isBlockVisible()` at request time, so a scheduled hero swaps at the
 * configured moment without a deploy.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { DB, Executor } from '../db/index.ts';
import { categories, faqs, menus, pageBlocks, pages } from '../db/schema.ts';
import type { I18n, MenuItem, Seo } from '../db/schema.ts';
import {
	BLOCK_LABELS,
	blockSchemas,
	isBlockVisible,
	type Block,
	type BlockData,
	type BlockType
} from '../../schemas/page-block.ts';
import { tr } from '../../i18n/index.ts';
import { SEGMENTS, type Lang } from '../../i18n/paths.ts';
import type { NavLink } from '../../types.ts';

export async function getMenus(db: Executor, keys: string[]) {
	const rows = await db.select().from(menus).where(inArray(menus.key, keys));
	return Object.fromEntries(keys.map((k) => [k, rows.find((r) => r.key === k)?.items ?? []])) as Record<
		string,
		MenuItem[]
	>;
}

export function menuLinks(items: MenuItem[], lang: Lang): NavLink[] {
	return items.map((i) => ({ label: tr(i.label, lang), href: typeof i.href === 'string' ? i.href : tr(i.href, lang) }));
}

/** Published (and publish_at reached) page by stable key, e.g. 'home'. */
export async function getPageByKey(db: Executor, key: string, opts: { preview?: boolean } = {}) {
	const [p] = await db.select().from(pages).where(eq(pages.key, key));
	if (!p || (!opts.preview && !isPublished(p))) return null;
	return p;
}

export async function getPageBySlug(db: Executor, lang: Lang, slug: string, opts: { preview?: boolean } = {}) {
	const [p] = await db
		.select()
		.from(pages)
		.where(sql`${pages.slugs}->>${lang} = ${slug}`);
	if (!p || (!opts.preview && !isPublished(p))) return null;
	return p;
}

export function isPublished(p: { status: string; publishAt: Date | null }, now = new Date()) {
	return p.status === 'published' && (!p.publishAt || p.publishAt <= now);
}

export async function getBlocks(
	db: Executor,
	pageId: string,
	opts: { now?: Date; includeHidden?: boolean } = {}
): Promise<Block[]> {
	const rows = await db
		.select()
		.from(pageBlocks)
		.where(eq(pageBlocks.pageId, pageId))
		.orderBy(asc(pageBlocks.position));
	const blocks = rows.map(
		(r) =>
			({
				id: r.id,
				type: r.type,
				data: r.data,
				hidden: r.hidden,
				visibleFrom: r.visibleFrom?.toISOString() ?? null,
				visibleUntil: r.visibleUntil?.toISOString() ?? null
			}) as Block
	);
	return opts.includeHidden ? blocks : blocks.filter((b) => isBlockVisible(b, opts.now));
}

export async function getFaqs(db: Executor, group?: string) {
	return db
		.select()
		.from(faqs)
		.where(group ? and(eq(faqs.group, group)) : undefined)
		.orderBy(asc(faqs.group), asc(faqs.position));
}

// ── Admin (P4-01 / P4-02) ──────────────────────────────────────────────────────────────────────

export const MENU_KEYS = ['main', 'footer_shop', 'footer_help', 'footer_about', 'footer_legal'] as const;
export type MenuKey = (typeof MENU_KEYS)[number];
export const MENU_LABELS: Record<MenuKey, string> = {
	main: 'Hoofdmenu',
	footer_shop: 'Footer — Shop',
	footer_help: 'Footer — Hulp',
	footer_about: 'Footer — Over ons',
	footer_legal: 'Footer — Juridisch'
};

/** Legal slots filled from settings.legal (P4-03). Keys match the seeded legal pages. */
export const LEGAL_SLOTS = ['terms', 'privacy', 'cookies', 'withdrawal', 'legal-notice', 'accessibility'] as const;
export type LegalSlotKey = (typeof LEGAL_SLOTS)[number];
export const LEGAL_SLOT_LABELS: Record<LegalSlotKey, string> = {
	terms: 'Algemene voorwaarden',
	privacy: 'Privacyverklaring',
	cookies: 'Cookiebeleid',
	withdrawal: 'Herroepingsrecht',
	'legal-notice': 'Wettelijke vermeldingen',
	accessibility: 'Toegankelijkheidsverklaring'
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isI18n = (v: unknown): v is { nl: string; fr?: string; en?: string } =>
	isObj(v) && typeof v.nl === 'string' && Object.keys(v).every((k) => k === 'nl' || k === 'fr' || k === 'en');

/** True when any translatable value has Dutch text but no French translation (admin indicator). */
export function hasMissingFr(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(hasMissingFr);
	if (isI18n(value)) return !!value.nl.trim() && !(value.fr ?? '').trim();
	if (isObj(value)) return Object.values(value).some(hasMissingFr);
	return false;
}

/**
 * Tidies editor output before validation: trims text, drops an empty `fr`, removes translatable values
 * that are completely empty and objects that became empty (an unused optional CTA). Emptied REQUIRED
 * fields then fail `parseBlock()` with a clear message. Untouched data passes through unchanged, so the
 * seeded blocks round-trip exactly.
 */
export function cleanBlockData(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(cleanBlockData);
	if (!isObj(value)) return value;
	if (isI18n(value)) {
		const out: Record<string, string> = { nl: value.nl.trim() };
		if (value.fr?.trim()) out.fr = value.fr.trim();
		if (value.en?.trim()) out.en = value.en.trim();
		return out;
	}
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) {
		const c = cleanBlockData(v);
		if (c === undefined || c === null || c === '') continue;
		if (isI18n(c) && !c.nl && !c.fr) continue;
		if (isObj(c) && !Object.keys(c).length) continue;
		out[k] = c;
	}
	return out;
}

export interface BlockInput {
	id?: string;
	type: string;
	data: unknown;
	hidden?: boolean;
	visibleFrom?: string | null;
	visibleUntil?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** ISO string → normalized ISO, '' / null → null, garbage → undefined. */
const isoOrNull = (v: unknown): string | null | undefined => {
	if (v == null || v === '') return null;
	if (typeof v !== 'string') return undefined;
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** Validates every block with the block schemas; returns normalized blocks or Dutch error messages. */
export function validateBlocks(input: unknown): { blocks: Block[]; errors: string[]; byIndex: Record<number, string> } {
	const errors: string[] = [];
	const byIndex: Record<number, string> = {};
	const blocks: Block[] = [];
	if (!Array.isArray(input)) return { blocks, errors: ['Ongeldige blokken'], byIndex };
	if (input.length > 60) errors.push('Maximaal 60 blokken per pagina');
	input.forEach((raw, i) => {
		const b = raw as BlockInput;
		const known = isObj(b) && typeof b.type === 'string' && b.type in blockSchemas;
		const label = `Blok ${i + 1}${known ? ` (${BLOCK_LABELS[b.type as BlockType]})` : ''}`;
		const fail = (msg: string) => {
			errors.push(`${label}: ${msg}`);
			byIndex[i] = msg;
		};
		if (!known) return fail(`onbekend bloktype`);
		const parsed = blockSchemas[b.type as BlockType].safeParse(cleanBlockData(b.data));
		if (!parsed.success) {
			const path = parsed.error.issues[0]?.path.join('.') || 'gegevens';
			return fail(`veld “${path}” ontbreekt of is ongeldig`);
		}
		const visibleFrom = isoOrNull(b.visibleFrom);
		const visibleUntil = isoOrNull(b.visibleUntil);
		if (visibleFrom === undefined || visibleUntil === undefined) return fail(`ongeldige planning`);
		if (visibleFrom && visibleUntil && visibleUntil <= visibleFrom)
			return fail(`“zichtbaar tot” moet na “zichtbaar vanaf” liggen`);
		if (b.type === 'product_rail') {
			const d = parsed.data as BlockData<'product_rail'>;
			if (d.source === 'collection' && !d.collectionId) return fail(`kies een collectie`);
			if (d.source === 'manual' && !d.productIds?.length) return fail(`kies minstens één product`);
		}
		blocks.push({
			id: typeof b.id === 'string' && UUID_RE.test(b.id) ? b.id : crypto.randomUUID(),
			type: b.type,
			data: parsed.data,
			hidden: !!b.hidden,
			visibleFrom,
			visibleUntil
		} as Block);
	});
	const ids = new Set<string>();
	for (const b of blocks) {
		if (ids.has(b.id)) b.id = crypto.randomUUID();
		ids.add(b.id);
	}
	return { blocks, errors, byIndex };
}

export async function listPagesAdmin(db: Executor) {
	const rows = await db.select().from(pages).orderBy(asc(pages.type), asc(pages.createdAt));
	const blocks = await db.select({ pageId: pageBlocks.pageId, data: pageBlocks.data }).from(pageBlocks);
	return rows.map((p) => {
		const own = blocks.filter((b) => b.pageId === p.id);
		return {
			...p,
			blockCount: own.length,
			missingFr:
				!p.title.fr?.trim() ||
				(p.type !== 'home' && !p.slugs.fr) ||
				hasMissingFr(p.seo) ||
				own.some((b) => hasMissingFr(b.data))
		};
	});
}

/** Slugs a CMS page may not take: category slugs and localized system segments. */
export async function reservedSlugs(db: Executor, lang: Lang) {
	const cats = await db.select({ slugs: categories.slugs }).from(categories);
	const segs = SEGMENTS.map((s) => (lang === 'nl' ? s[1] : s[2]).split('/')[0]);
	return new Set([
		...cats.map((c) => c.slugs[lang]),
		...segs,
		'p',
		'api',
		'admin',
		'media',
		'nieuwsbrief',
		'newsletter'
	]);
}

export interface PageMeta {
	title: I18n;
	slugs: { nl: string; fr: string };
	type: 'home' | 'page' | 'legal' | 'landing';
	status: 'draft' | 'published';
	publishAt: Date | null;
	seo: Seo;
}

/** Slug conflicts with other pages or reserved paths → Dutch errors keyed slug_nl / slug_fr. */
export async function slugErrors(db: Executor, slugs: { nl: string; fr: string }, pageId: string | null) {
	const out: Record<string, string[]> = {};
	for (const lang of ['nl', 'fr'] as const) {
		const slug = slugs[lang];
		if (!slug) continue;
		if ((await reservedSlugs(db, lang)).has(slug))
			out[`slug_${lang}`] = ['Deze URL is al in gebruik door de winkel (categorie of systeempagina)'];
		const [other] = await db
			.select({ id: pages.id })
			.from(pages)
			.where(sql`${pages.slugs}->>${lang} = ${slug}`);
		if (other && other.id !== pageId) out[`slug_${lang}`] = ['Een andere pagina gebruikt deze URL al'];
	}
	return out;
}

/** Saves page meta + its complete block list in one transaction. Returns the page id. */
export async function savePage(db: DB, id: string | null, meta: PageMeta, blocks: Block[]) {
	return db.transaction(async (tx) => {
		let pageId = id;
		const values = {
			title: meta.title,
			slugs: meta.slugs,
			type: meta.type,
			status: meta.status,
			publishAt: meta.publishAt,
			seo: meta.seo
		};
		if (pageId) {
			await tx
				.update(pages)
				.set({ ...values, updatedAt: new Date() })
				.where(eq(pages.id, pageId));
		} else {
			const [row] = await tx.insert(pages).values(values).returning({ id: pages.id });
			pageId = row.id;
		}
		const pid = pageId;
		await tx.delete(pageBlocks).where(eq(pageBlocks.pageId, pid));
		if (blocks.length) {
			await tx.insert(pageBlocks).values(
				blocks.map((b, position) => ({
					id: b.id,
					pageId: pid,
					type: b.type,
					data: b.data as Record<string, unknown>,
					position,
					hidden: !!b.hidden,
					visibleFrom: b.visibleFrom ? new Date(b.visibleFrom) : null,
					visibleUntil: b.visibleUntil ? new Date(b.visibleUntil) : null
				}))
			);
		}
		return pid;
	});
}

export async function saveMenu(db: Executor, key: MenuKey, items: MenuItem[]) {
	await db
		.insert(menus)
		.values({ key, items, updatedAt: new Date() })
		.onConflictDoUpdate({ target: menus.key, set: { items, updatedAt: new Date() } });
}

/** Moves an FAQ one step up/down within its group (positions renumbered 0..n). */
export async function moveFaq(db: DB, id: string, dir: 'up' | 'down') {
	await db.transaction(async (tx) => {
		const [f] = await tx.select().from(faqs).where(eq(faqs.id, id));
		if (!f) return;
		const list = await tx
			.select({ id: faqs.id })
			.from(faqs)
			.where(eq(faqs.group, f.group))
			.orderBy(asc(faqs.position), asc(faqs.createdAt));
		const i = list.findIndex((x) => x.id === id);
		const j = dir === 'up' ? i - 1 : i + 1;
		if (i < 0 || j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
		for (const [position, row] of list.entries()) await tx.update(faqs).set({ position }).where(eq(faqs.id, row.id));
	});
}

export async function nextFaqPosition(db: Executor, group: string) {
	const [r] = await db
		.select({ n: sql<number>`coalesce(max(${faqs.position}) + 1, 0)::int` })
		.from(faqs)
		.where(eq(faqs.group, group));
	return r?.n ?? 0;
}

const HREF_RE = /^(\/(?!\/)|https:\/\/|mailto:|tel:)/;

/**
 * Menu editor form → items (P4-02). Rows come as parallel arrays (label_nl[], label_fr[], href_nl[],
 * href_fr[], children[]); fully empty rows are dropped. The submit button may carry `move=i:up|down`
 * or `remove=i` (no-JS reorder/remove). An empty FR link defaults to the localized NL link.
 */
export function parseMenuForm(form: FormData, localizeFr: (href: string) => string) {
	const col = (k: string) => form.getAll(k).map((v) => String(v).trim());
	const [lnl, lfr, hnl, hfr, kids] = [
		col('label_nl'),
		col('label_fr'),
		col('href_nl'),
		col('href_fr'),
		form.getAll('children').map(String)
	];
	type Row = { item: MenuItem; index: number };
	let rows: Row[] = [];
	const errors: Record<string, string[]> = {};
	lnl.forEach((labelNl, i) => {
		const labelFr = lfr[i] ?? '';
		const hrefNl = hnl[i] ?? '';
		let hrefFr = hfr[i] ?? '';
		if (!labelNl && !labelFr && !hrefNl && !hrefFr) return;
		if (!labelNl) errors[`${i}.label`] = ['Label NL is verplicht'];
		if (!HREF_RE.test(hrefNl)) errors[`${i}.href`] = ['Link moet beginnen met / of https://'];
		if (!hrefFr && hrefNl.startsWith('/nl')) hrefFr = localizeFr(hrefNl);
		if (hrefFr && !HREF_RE.test(hrefFr)) errors[`${i}.href`] = ['FR-link moet beginnen met / of https://'];
		let children: MenuItem[] | undefined;
		try {
			const c = JSON.parse(kids[i] || '[]');
			children = Array.isArray(c) && c.length ? (c as MenuItem[]) : undefined;
		} catch {
			children = undefined;
		}
		const item: MenuItem = {
			label: { nl: labelNl, ...(labelFr ? { fr: labelFr } : {}) },
			href: { nl: hrefNl, ...(hrefFr ? { fr: hrefFr } : {}) },
			...(children ? { children } : {})
		};
		rows.push({ item, index: i });
	});
	const move = /^(\d+):(up|down)$/.exec(String(form.get('move') ?? ''));
	const remove = form.get('remove');
	if (move) {
		const at = rows.findIndex((r) => r.index === Number(move[1]));
		const to = move[2] === 'up' ? at - 1 : at + 1;
		if (at >= 0 && to >= 0 && to < rows.length) [rows[at], rows[to]] = [rows[to], rows[at]];
	} else if (remove != null && remove !== '') {
		rows = rows.filter((r) => r.index !== Number(remove));
	}
	return { items: rows.map((r) => r.item), errors, structural: !!move || (remove != null && remove !== '') };
}
