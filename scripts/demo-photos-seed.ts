/**
 * `npm run demo:photos` — replaces the SVG placeholders of the DEMO catalogue with the real photos listed in
 * scripts/demo-photos.json (CC0 / public domain, see demo-photos-fetch.ts) and the mood photos of
 * scripts/brand-photos.json (Unsplash License). Run after `npm run db:seed`.
 *
 * - Downloads each photo once (Commons thumbnail service, cached in .data/demo-photos), crops it with sharp to
 *   the shop's ratios (product 4:5 → 1200×1500, hero 3:2 → 1920×1280) and uploads it as JPEG to the
 *   configured storage (mock .data/uploads or S3 / Neon object storage via STORAGE_* env vars).
 * - Points product_images (position 0 = product photo, 1 = second photo) and the home hero / editorial
 *   blocks at the new media. Idempotent; DEMO only — never run against the production catalogue.
 * Target another database with `--url <postgres url>` (same as db:seed).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import sharp from 'sharp';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { DATABASE_URL } from './env.ts';
import * as s from '../src/lib/server/db/schema.ts';
import { createStorage } from '../src/lib/server/adapters/storage.ts';
import { demoProducts } from '../src/lib/server/db/seed-data.ts';

interface Photo {
	/** Commons file name (demo-photos.json) … */
	file?: string;
	/** … or a direct image URL (brand-photos.json). */
	url?: string;
	license: string;
	source: string;
}
const manifest = JSON.parse(readFileSync('scripts/demo-photos.json', 'utf8')) as {
	categories: Record<string, Photo[]>;
	hero: Photo;
	editorial: Photo;
};
/** Mood photos for hero / editorial blocks (Unsplash License, DEMO until the shop's own photography). */
const brand = JSON.parse(readFileSync('scripts/brand-photos.json', 'utf8')) as Record<
	'hero' | 'editorial' | 'story' | 'story2',
	Photo
>;

const UA = 'SieradenkoninginDemoSeed/1.0 (demo catalogue; contact via repository owner)';
const CACHE = '.data/demo-photos';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(p: Photo): Promise<Buffer> {
	const file = p.file ?? `${new URL(p.url!).pathname.slice(1)}.jpg`;
	const cached = `${CACHE}/${file.replace(/[^a-z0-9._-]/gi, '_')}`;
	if (existsSync(cached)) return readFileSync(cached);
	const url = p.url ?? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=2000`;
	for (let attempt = 0; ; attempt++) {
		await sleep(1000);
		const res = await fetch(url, { headers: { 'user-agent': UA } });
		if (res.ok) {
			const buf = Buffer.from(await res.arrayBuffer());
			mkdirSync(CACHE, { recursive: true });
			writeFileSync(cached, buf);
			return buf;
		}
		if (res.status !== 429 || attempt === 5) throw new Error(`Download ${file}: ${res.status}`);
		await sleep(Number(res.headers.get('retry-after') ?? 0) * 1000 || 10_000 * (attempt + 1));
	}
}

const args = process.argv.slice(2);
const urlArg = args.indexOf('--url');
const e = process.env;
const pool = new pg.Pool({ connectionString: urlArg >= 0 ? args[urlArg + 1] : DATABASE_URL, max: 1 });
const db = drizzle(pool, { schema: s });
const storage = createStorage({
	STORAGE_ENDPOINT: e.STORAGE_ENDPOINT ?? '',
	STORAGE_BUCKET: e.STORAGE_BUCKET ?? '',
	STORAGE_ACCESS_KEY_ID: e.STORAGE_ACCESS_KEY_ID ?? '',
	STORAGE_SECRET_ACCESS_KEY: e.STORAGE_SECRET_ACCESS_KEY ?? '',
	STORAGE_REGION: e.STORAGE_REGION ?? 'auto',
	PUBLIC_MEDIA_URL: e.PUBLIC_MEDIA_URL ?? '',
	SESSION_SECRET: e.SESSION_SECRET ?? ''
});

/** Downloads, crops and uploads one photo; returns its media id (reuses an existing row for the key). */
async function photo(key: string, p: Photo, width: number, height: number, alt: s.I18n) {
	const [existing] = await db.select({ id: s.media.id }).from(s.media).where(eq(s.media.storageKey, key));
	if (existing) return existing.id;
	const jpeg = await sharp(await download(p))
		.rotate()
		.resize(width, height, { fit: 'cover', position: sharp.strategy.attention })
		.jpeg({ quality: 82, mozjpeg: true })
		.toBuffer();
	await storage.put(key, new Uint8Array(jpeg), 'image/jpeg');
	const [row] = await db
		.insert(s.media)
		.values({ storageKey: key, mime: 'image/jpeg', width, height, bytes: jpeg.byteLength, alt })
		.onConflictDoNothing({ target: s.media.storageKey })
		.returning();
	return row.id;
}

try {
	let linked = 0;
	const byCategory = new Map<string, number>();
	for (const p of demoProducts()) {
		const i = byCategory.get(p.categoryKey) ?? 0;
		byCategory.set(p.categoryKey, i + 1);
		const [product] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.slug, p.slug));
		if (!product) continue;
		const photos = manifest.categories[p.categoryKey].slice(i * 2, i * 2 + 2);
		for (const [position, ph] of photos.entries()) {
			const mediaId = await photo(`demo/photos/${p.slug}-${position + 1}.jpg`, ph, 1200, 1500, p.name);
			const updated = await db
				.update(s.productImages)
				.set({ mediaId })
				.where(and(eq(s.productImages.productId, product.id), eq(s.productImages.position, position)))
				.returning({ id: s.productImages.id });
			if (!updated.length)
				await db.insert(s.productImages).values({
					productId: product.id,
					mediaId,
					alt: { nl: `${p.name.nl} — foto ${position + 1}`, fr: `${p.name.fr} — photo ${position + 1}` },
					position
				});
		}
		linked++;
	}
	console.log(`✓ photos linked to ${linked} DEMO products`);

	// Hero + editorial blocks reference media by storage key inside their JSON data. The seed writes the SVG
	// placeholder keys; earlier runs of this script used museum photos (demo/photos/editorial-*.jpg).
	const replaceKey = (oldKey: string, newKey: string, pageKey?: string) =>
		db.execute(
			sql`update page_blocks set data = replace(data::text, ${oldKey}, ${newKey})::jsonb
			    where data::text like ${'%' + oldKey + '%'}
			    ${pageKey ? sql`and page_id = (select id from pages where key = ${pageKey})` : sql``}`
		);
	// Keys are versioned (-2): media rows are reused by key, so a new photo needs a new key.
	const heroKey = 'demo/photos/brand-hero-2.jpg';
	const editorialKey = 'demo/photos/brand-editorial.jpg';
	const storyKey = 'demo/photos/brand-story-2.jpg';
	const story2Key = 'demo/photos/brand-story2.jpg';
	await photo(heroKey, brand.hero, 1920, 1280, {
		nl: 'DEMO sfeerbeeld — gouden collier op een zwarte blazer',
		fr: 'DEMO image d’ambiance — collier doré sur un blazer noir'
	});
	const editorialId = await photo(editorialKey, brand.editorial, 1200, 1500, {
		nl: 'DEMO sfeerbeeld — gelaagde gouden kettingen',
		fr: 'DEMO image d’ambiance — colliers dorés superposés'
	});
	await photo(storyKey, brand.story, 1200, 1500, {
		nl: 'DEMO sfeerbeeld — vrouw met gouden oorbellen',
		fr: 'DEMO image d’ambiance — femme aux boucles d’oreilles dorées'
	});
	const story2Id = await photo(story2Key, brand.story2, 1200, 1500, {
		nl: 'DEMO sfeerbeeld — gouden ketting, oorbellen en ring in warm zonlicht',
		fr: 'DEMO image d’ambiance — collier, boucles d’oreilles et bague dorés au soleil'
	});
	// Story page (seeded with its own placeholder keys) first, then the remaining placeholders site-wide.
	// The opening slot sits next to "Zahra, oprichtster", so it gets the photo WITHOUT a face — a stock model
	// there would read as Zahra. The portrait goes to the "Waarom juwelen?" chapter.
	await replaceKey('demo/editorial-story.svg', story2Key, 'story');
	await replaceKey('demo/editorial-story-2.svg', storyKey, 'story');
	for (const old of ['demo/editorial-hero.svg', 'demo/photos/editorial-hero.jpg', 'demo/photos/brand-hero.jpg'])
		await replaceKey(old, heroKey);
	for (const old of ['demo/editorial-split.svg', 'demo/photos/editorial-split.jpg'])
		await replaceKey(old, editorialKey);
	console.log('✓ hero + editorial mood photos');

	// Shop-menu tiles show the hero image of these collections — unless the owner has chosen her own image.
	const demoMedia = sql`(select id from media where storage_key like 'demo/%')`;
	for (const [slug, mediaId] of [
		['nieuw', story2Id],
		['onze-favorieten', editorialId]
	] as const)
		await db
			.update(s.collections)
			.set({ heroMediaId: mediaId })
			.where(
				and(
					sql`${s.collections.slugs}->>'nl' = ${slug}`,
					or(isNull(s.collections.heroMediaId), sql`${s.collections.heroMediaId} in ${demoMedia}`)
				)
			);
	console.log('✓ collection hero images');
} finally {
	await pool.end();
}
