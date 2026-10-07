/**
 * CMS content (P4-01/P4-02): menus, pages and their scheduled blocks.
 * Blocks are filtered by `isBlockVisible()` at request time, so a scheduled hero swaps at the
 * configured moment without a deploy.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { faqs, menus, pageBlocks, pages } from '../db/schema.ts';
import type { MenuItem } from '../db/schema.ts';
import { isBlockVisible, type Block } from '../../schemas/page-block.ts';
import { tr } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/paths.ts';
import type { NavLink } from '../../types.ts';

export async function getMenus(db: Executor, keys: string[]) {
	const rows = await db.select().from(menus).where(inArray(menus.key, keys));
	return Object.fromEntries(keys.map((k) => [k, rows.find((r) => r.key === k)?.items ?? []])) as Record<string, MenuItem[]>;
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

export async function getBlocks(db: Executor, pageId: string, opts: { now?: Date; includeHidden?: boolean } = {}): Promise<Block[]> {
	const rows = await db.select().from(pageBlocks).where(eq(pageBlocks.pageId, pageId)).orderBy(asc(pageBlocks.position));
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
