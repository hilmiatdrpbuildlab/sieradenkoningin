/**
 * `npm run demo:photos:fetch` — builds scripts/demo-photos.json: real jewellery photos for the DEMO catalogue.
 *
 * Source: Wikimedia Commons, restricted to CC0 / public-domain files (mostly The Met Open Access), so no
 * attribution is legally required; the manifest still records source page, author and license per photo.
 * DEMO use only — replace with the shop's own photography (P4-08) before launch.
 * Re-running picks the same files as long as Commons search results are stable; review the manifest diff.
 */
import { writeFileSync } from 'node:fs';

const UA = 'SieradenkoninginDemoSeed/1.0 (demo catalogue; contact via repository owner)';
const FREE = /^(CC0|Public domain|PD|No restrictions)/i;

/** Commons search per category; 8 photos per category = 2 per DEMO product (4 products each). */
const QUERIES: Record<string, string[]> = {
	rings: ['gold ring MET', 'ring with stone MET', 'finger ring MET'],
	bracelets: ['gold bracelet MET', 'bracelet MET', 'bangle MET'],
	necklaces: ['gold necklace MET', 'necklace MET', 'pendant MET'],
	earrings: ['gold earrings MET', 'earring MET', 'pair of earrings MET'],
	sets: ['necklace and earrings MET', 'collier en oorhangers', 'collier oorbellen', 'parure necklace earrings'],
	accessories: ['gold brooch MET', 'brooch MET', 'hair ornament MET', 'hairpin MET']
};
/** The file title must name the right kind of jewellery (search alone also returns coins, adverts, portraits). */
const TITLE: Record<string, RegExp> = {
	rings: /(?<!neck |ear)ring(?!s? stone)/i,
	bracelets: /bracelet|bangle/i,
	necklaces: /necklace|pendant/i,
	earrings: /earring/i,
	sets: /(necklace|collier).*(earring|oorhanger|oorbel)/i,
	accessories: /brooch/i,
	hero: /necklace|jewel/i,
	editorial: /pendant|necklace/i
};
const EDITORIAL: Record<string, string[]> = {
	hero: ['gold necklace MET', 'necklace MET', 'jewelry MET'],
	editorial: ['gold pendant MET', 'pendant MET', 'necklace MET']
};

interface Photo {
	file: string;
	url: string;
	width: number;
	height: number;
	license: string;
	artist: string;
	source: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cache = new Map<string, Photo[]>();

async function search(query: string, limit = 100): Promise<Photo[]> {
	const hit = cache.get(query);
	if (hit) return hit;
	const params = new URLSearchParams({
		action: 'query',
		format: 'json',
		generator: 'search',
		gsrnamespace: '6',
		gsrsearch: `${query} filetype:bitmap`,
		gsrlimit: String(limit),
		prop: 'imageinfo',
		iiprop: 'url|size|extmetadata',
		iiextmetadatafilter: 'LicenseShortName|Artist'
	});
	let res: Response;
	for (let attempt = 0; ; attempt++) {
		await sleep(1500); // be polite: Commons rate-limits anonymous API clients
		res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'user-agent': UA } });
		if (res.status !== 429 || attempt === 5) break;
		await sleep(Number(res.headers.get('retry-after') ?? 0) * 1000 || 10_000 * (attempt + 1));
	}
	if (!res.ok) throw new Error(`Commons ${res.status}`);
	const json = (await res.json()) as {
		query?: {
			pages: Record<
				string,
				{
					index: number;
					title: string;
					imageinfo: {
						url: string;
						descriptionurl: string;
						width: number;
						height: number;
						extmetadata: Record<string, { value: string }>;
					}[];
				}
			>;
		};
	};
	const photos = Object.values(json.query?.pages ?? {})
		.sort((a, b) => a.index - b.index)
		.map((p) => {
			const i = p.imageinfo[0];
			return {
				file: p.title.replace(/^File:/, ''),
				url: i.url,
				width: i.width,
				height: i.height,
				license: i.extmetadata.LicenseShortName?.value ?? '',
				artist: (i.extmetadata.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim(),
				source: i.descriptionurl
			};
		});
	cache.set(query, photos);
	return photos;
}

async function pick(kind: string, queries: string[], count: number, used: Set<string>, ratio: [number, number]) {
	const out: Photo[] = [];
	for (const q of queries) {
		for (const p of await search(q)) {
			const r = p.width / p.height;
			if (out.length >= count) break;
			if (used.has(p.file) || !FREE.test(p.license) || !TITLE[kind].test(p.file)) continue;
			if (Math.min(p.width, p.height) < 1200) continue;
			if (r < ratio[0] || r > ratio[1]) continue;
			used.add(p.file);
			out.push(p);
		}
	}
	if (out.length < count) throw new Error(`Only ${out.length}/${count} free photos for "${queries.join(' / ')}"`);
	return out;
}

const used = new Set<string>();
const manifest: { categories: Record<string, Photo[]>; hero: Photo; editorial: Photo } = {
	categories: {},
	hero: (await pick('hero', EDITORIAL.hero, 1, used, [1.2, 2]))[0],
	editorial: (await pick('editorial', EDITORIAL.editorial, 1, used, [0.6, 1]))[0]
};
for (const [cat, queries] of Object.entries(QUERIES)) {
	manifest.categories[cat] = await pick(cat, queries, 8, used, [0.6, 1.4]);
	console.log(`✓ ${cat}: ${manifest.categories[cat].length}`);
}
writeFileSync('scripts/demo-photos.json', JSON.stringify(manifest, null, '\t') + '\n');
console.log('✓ scripts/demo-photos.json');
