/**
 * JSON lookups for the page-builder pickers (P4-01): media library images and products.
 *   GET ?kind=media&q=klaver        → [{ id, key, url, alt, width, height }]
 *   GET ?kind=products&q=ring       → [{ id, name, slug, status, image }]
 *   GET ?kind=products&ids=a,b      → the given products (labels for already-selected ids)
 */
import { json } from '@sveltejs/kit';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { media, productImages, products } from '#lib/server/db/schema.ts';
import { img } from '#lib/utils/media.ts';

const UUID = /^[0-9a-f-]{36}$/i;

export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, 'content:read');
	const db = locals.db;
	const kind = url.searchParams.get('kind');
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;

	if (kind === 'media') {
		const rows = await db
			.select()
			.from(media)
			.where(
				and(
					isNull(media.deletedAt),
					sql`${media.mime} like 'image/%'`,
					q
						? or(
								ilike(media.storageKey, like),
								sql`${media.alt}->>'nl' ilike ${like}`,
								sql`${media.alt}->>'fr' ilike ${like}`
							)
						: undefined
				)
			)
			.orderBy(desc(media.createdAt))
			.limit(60);
		return json(
			rows.map((r) => ({
				id: r.id,
				key: r.storageKey,
				url: img(r.storageKey, 400),
				alt: r.alt,
				width: r.width,
				height: r.height
			}))
		);
	}

	if (kind === 'products') {
		const ids = (url.searchParams.get('ids') ?? '')
			.split(',')
			.filter((x) => UUID.test(x))
			.slice(0, 50);
		const cover = sql<
			string | null
		>`(select m.storage_key from ${productImages} pi join ${media} m on m.id = pi.media_id where pi.product_id = ${sql.raw('"products"."id"')} order by pi.position limit 1)`;
		const rows = await db
			.select({ id: products.id, name: products.name, slug: products.slug, status: products.status, cover })
			.from(products)
			.where(
				ids.length
					? inArray(products.id, ids)
					: q
						? or(
								sql`${products.name}->>'nl' ilike ${like}`,
								sql`${products.name}->>'fr' ilike ${like}`,
								ilike(products.slug, like)
							)
						: eq(products.status, 'active')
			)
			.orderBy(asc(sql`${products.name}->>'nl'`))
			.limit(ids.length ? 50 : 30);
		return json(
			rows.map((r) => ({
				id: r.id,
				name: r.name.nl,
				slug: r.slug,
				status: r.status,
				image: r.cover ? img(r.cover, 120) : null
			}))
		);
	}

	return json({ error: 'unknown kind' }, { status: 400 });
};
