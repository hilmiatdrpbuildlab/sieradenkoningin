/**
 * Media library (P1-03). Uploaded objects become `media` rows the first time a form that references
 * them is saved (product form, media library). Deletion is soft (`deleted_at`) and the object itself is
 * removed asynchronously by a queued `storage.delete` job — never inline in the request (§4.5).
 */
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { jobs, media, type I18n } from '../db/schema.ts';
import { mediaKey, type Storage } from '../adapters/storage.ts';
import { audit } from './audit.ts';
import { MAX_UPLOAD_MB, MIN_EDGE_PX, RASTER_TYPES, UPLOAD_KEY_RE } from '#lib/schemas/product.ts';

type Actor = Pick<App.Locals, 'admin' | 'ip'>;

export class MediaError extends Error {}

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml' };
export const mimeFromKey = (key: string) => MIME_BY_EXT[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

// ── Image header sniffing (no-JS upload fallback) ────────────────────────────────
export interface ImageInfo {
	mime: (typeof RASTER_TYPES)[number];
	width: number;
	height: number;
}

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

/** Detects JPEG / PNG / WebP / AVIF from magic bytes and reads the pixel dimensions. */
export function imageInfo(b: Uint8Array): ImageInfo | null {
	const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
	if (b.length > 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') {
		return { mime: 'image/png', width: dv.getUint32(16), height: dv.getUint32(20) };
	}
	if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
		let i = 2;
		while (i + 9 < b.length) {
			if (b[i] !== 0xff) {
				i++;
				continue;
			}
			const marker = b[i + 1];
			if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
				i += 2;
				continue;
			}
			const len = dv.getUint16(i + 2);
			const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
			if (isSof) return { mime: 'image/jpeg', height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
			i += 2 + len;
		}
		return null;
	}
	if (b.length > 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
		const chunk = ascii(b, 12, 4);
		if (chunk === 'VP8 ') return { mime: 'image/webp', width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
		if (chunk === 'VP8L') {
			const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
			return { mime: 'image/webp', width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
		}
		if (chunk === 'VP8X') {
			const u24 = (at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
			return { mime: 'image/webp', width: 1 + u24(24), height: 1 + u24(27) };
		}
		return null;
	}
	if (b.length > 16 && ascii(b, 4, 4) === 'ftyp' && /avi[fs]/.test(ascii(b, 8, 4) + ascii(b, 16, Math.min(32, b.length - 16)))) {
		for (let i = 0; i + 16 < Math.min(b.length, 4096); i++) {
			if (b[i] === 0x69 && ascii(b, i, 4) === 'ispe') return { mime: 'image/avif', width: dv.getUint32(i + 8), height: dv.getUint32(i + 12) };
		}
		return null;
	}
	return null;
}

/** Validates a raster upload against the design-system rules. Returns a Dutch error or null. */
export function checkUpload(info: ImageInfo | null, bytes: number, minEdge = MIN_EDGE_PX): string | null {
	if (!info) return 'Alleen JPG, PNG, WebP of AVIF';
	if (bytes > MAX_UPLOAD_MB * 1024 * 1024) return `Maximaal ${MAX_UPLOAD_MB} MB`;
	if (Math.min(info.width, info.height) < minEdge) return `Minstens ${minEdge}px aan de kortste zijde (${info.width}×${info.height})`;
	return null;
}

/**
 * Server-side upload (forms submitted without JavaScript). Bytes pass through the server only in
 * this fallback; the normal path is a presigned PUT straight to storage.
 */
export async function storeFormFile(storage: Storage, file: File, folder: 'products' | 'media' = 'products') {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const info = imageInfo(bytes);
	const problem = checkUpload(info, bytes.byteLength);
	if (problem || !info) return { error: `${file.name}: ${problem}` } as const;
	const key = mediaKey(info.mime, folder);
	await storage.put(key, bytes, info.mime);
	return { key, mime: info.mime, width: info.width, height: info.height, bytes: bytes.byteLength } as const;
}

// ── Rows ─────────────────────────────────────────────────────────────────────────
export interface NewMedia {
	key: string;
	width?: number | null;
	height?: number | null;
	bytes?: number | null;
	alt?: I18n;
}

/** Returns the media id for an uploaded key, creating the row when it does not exist yet. */
export async function ensureMedia(db: Executor, m: NewMedia): Promise<string> {
	if (!UPLOAD_KEY_RE.test(m.key)) throw new MediaError('Ongeldige afbeelding');
	const [existing] = await db.select({ id: media.id, deletedAt: media.deletedAt }).from(media).where(eq(media.storageKey, m.key));
	if (existing) {
		if (existing.deletedAt) throw new MediaError('Deze afbeelding is verwijderd');
		return existing.id;
	}
	const [row] = await db
		.insert(media)
		.values({
			storageKey: m.key,
			mime: mimeFromKey(m.key),
			width: m.width || null,
			height: m.height || null,
			bytes: m.bytes || null,
			alt: m.alt?.nl ? m.alt : { nl: '' }
		})
		.onConflictDoNothing()
		.returning({ id: media.id });
	if (row) return row.id;
	const [again] = await db.select({ id: media.id }).from(media).where(eq(media.storageKey, m.key));
	return again.id;
}

/** Number of places a media item is used: product images, collection heroes, articles, CMS blocks. */
export const usageSql = sql<number>`(
	(select count(*) from product_images pi where pi.media_id = "media"."id")
	+ (select count(*) from collections c where c.hero_media_id = "media"."id")
	+ (select count(*) from articles a where a.cover_media_id = "media"."id")
	+ (select count(*) from page_blocks b where strpos(b.data::text, "media"."storage_key") > 0)
)::int`;

export interface MediaListParams {
	q?: string;
	unused?: boolean;
	page?: number;
	pageSize?: number;
	sort?: 'new' | 'old' | 'usage';
}

export async function listMedia(db: Executor, p: MediaListParams = {}) {
	const pageSize = p.pageSize ?? 48;
	const page = Math.max(1, p.page ?? 1);
	const conds: (SQL | undefined)[] = [isNull(media.deletedAt)];
	if (p.q) {
		const like = `%${p.q}%`;
		conds.push(or(ilike(media.storageKey, like), sql`${media.alt}->>'nl' ilike ${like}`, sql`${media.alt}->>'fr' ilike ${like}`));
	}
	if (p.unused) conds.push(sql`${usageSql} = 0`);
	const where = and(...conds);
	const order = p.sort === 'old' ? [asc(media.createdAt)] : p.sort === 'usage' ? [desc(usageSql), desc(media.createdAt)] : [desc(media.createdAt)];
	const [rows, [{ n }]] = await Promise.all([
		db
			.select({
				id: media.id,
				key: media.storageKey,
				mime: media.mime,
				width: media.width,
				height: media.height,
				bytes: media.bytes,
				alt: media.alt,
				createdAt: media.createdAt,
				usage: usageSql
			})
			.from(media)
			.where(where)
			.orderBy(...order)
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db.select({ n: sql<number>`count(*)::int` }).from(media).where(where)
	]);
	return { rows, total: n, page, pageSize };
}

export async function mediaUsage(db: Executor, id: string): Promise<number> {
	const [row] = await db.select({ usage: usageSql }).from(media).where(eq(media.id, id));
	return row?.usage ?? 0;
}

export async function updateMediaAlt(db: Executor, actor: Actor, id: string, alt: I18n) {
	const [before] = await db.select({ alt: media.alt }).from(media).where(and(eq(media.id, id), isNull(media.deletedAt)));
	if (!before) throw new MediaError('Afbeelding niet gevonden');
	await db.update(media).set({ alt, updatedAt: new Date() }).where(eq(media.id, id));
	await audit(db, actor, { action: 'update', entity: 'media', entityId: id, diff: { alt: [before.alt, alt] } });
}

/** Soft-deletes unused media and queues the object deletion. Throws when the media is still in use. */
export async function deleteMedia(db: Executor, actor: Actor, id: string) {
	const [row] = await db
		.select({ key: media.storageKey, usage: usageSql })
		.from(media)
		.where(and(eq(media.id, id), isNull(media.deletedAt)))
		.for('update');
	if (!row) throw new MediaError('Afbeelding niet gevonden');
	if (row.usage > 0) throw new MediaError(`Deze afbeelding wordt nog ${row.usage}× gebruikt en kan niet verwijderd worden`);
	await db.update(media).set({ deletedAt: new Date() }).where(eq(media.id, id));
	await db
		.insert(jobs)
		.values({ type: 'storage.delete', payload: { key: row.key }, dedupeKey: `storage.delete:${row.key}` })
		.onConflictDoNothing();
	await audit(db, actor, { action: 'delete', entity: 'media', entityId: id, diff: { key: row.key } });
}

/** Registers uploads made from the media library (no product attached yet). */
export async function registerUploads(db: Executor, actor: Actor, items: NewMedia[]) {
	const ids: string[] = [];
	for (const item of items) ids.push(await ensureMedia(db, item));
	if (ids.length) await audit(db, actor, { action: 'create', entity: 'media', entityId: ids.length === 1 ? ids[0] : null, diff: { ids } });
	return ids;
}

export async function mediaByIds(db: Executor, ids: string[]) {
	if (!ids.length) return [];
	return db
		.select({ id: media.id, key: media.storageKey, width: media.width, height: media.height, bytes: media.bytes, alt: media.alt })
		.from(media)
		.where(and(inArray(media.id, ids), isNull(media.deletedAt)));
}
