/**
 * P1-09 acceptance: search p95 < 150 ms on 1,000 products.
 *   node --experimental-strip-types scripts/bench-search.ts [postgres-url]
 * Defaults to the TEST database; seeds 1,000 BENCH products there (idempotent) and times 200 queries
 * (prefix, full words, typos, accents, NL + FR) through the real `searchSuggest()` service.
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { like, sql } from 'drizzle-orm';
import './env.ts';
import * as s from '../src/lib/server/db/schema.ts';
import { searchSuggest } from '../src/lib/server/services/search.ts';

const url = process.argv[2] ?? process.env.TEST_DATABASE_URL ?? 'postgres://sk@localhost:54329/sieradenkoningin_test';
const pool = new pg.Pool({ connectionString: url, max: 4 });
const db = drizzle(pool, { schema: s });

const words = [
	['Klaver', 'Trèfle'],
	['Kroon', 'Couronne'],
	['Sparkle', 'Étincelle'],
	['Koord', 'Torsade'],
	['Parel', 'Perle'],
	['Hart', 'Cœur'],
	['Ster', 'Étoile'],
	['Maan', 'Lune'],
	['Bloem', 'Fleur'],
	['Robijn', 'Rubis']
];
const types = [
	['ring', 'bague'],
	['ketting', 'collier'],
	['armband', 'bracelet'],
	['oorbellen', "boucles d'oreilles"],
	['set', 'parure']
];

try {
	await migrate(db, { migrationsFolder: './drizzle' });
	await db.insert(s.categories).values({ key: 'bench', slugs: { nl: 'bench-nl', fr: 'bench-fr' }, name: { nl: 'Bench', fr: 'Bench' }, icon: 'ring' }).onConflictDoNothing();
	const [{ id: catId }] = await db.select({ id: s.categories.id }).from(s.categories).where(sql`${s.categories.key} = 'bench'`);
	const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.products).where(like(s.products.slug, 'bench-%'));
	if (n < 1000) {
		const rows = [];
		for (let i = n; i < 1000; i++) {
			const [wn, wf] = words[i % words.length];
			const [tn, tf] = types[Math.floor(i / words.length) % types.length];
			rows.push({
				slug: `bench-${i}`,
				name: { nl: `BENCH ${wn}${tn} ${i}`, fr: `BENCH ${tf} ${wf.toLowerCase()} ${i}` },
				description: { nl: `Verguld ${wn.toLowerCase()} juweel nummer ${i}`, fr: `Bijou ${wf.toLowerCase()} doré numéro ${i}` },
				categoryId: catId,
				status: 'active' as const,
				price: 1995 + (i % 50) * 100
			});
		}
		for (let i = 0; i < rows.length; i += 200) await db.insert(s.products).values(rows.slice(i, i + 200));
		await db.execute(sql`analyze products`);
	}
	const total = (await db.select({ n: sql<number>`count(*)::int` }).from(s.products))[0].n;

	const queries: [string, 'nl' | 'fr'][] = [
		['klaver', 'nl'], ['klavr', 'nl'], ['kroo', 'nl'], ['ketting', 'nl'], ['kettng', 'nl'], ['parel ring', 'nl'], ['robijn', 'nl'], ['bloemarmband', 'nl'],
		['trèfle', 'fr'], ['trefle', 'fr'], ['TRÈFLE', 'fr'], ['couronne', 'fr'], ['etoile', 'fr'], ['bracelet', 'fr'], ['perle', 'fr'], ['cœur', 'fr'],
		['zzzz', 'nl'], ['r', 'nl'], ['oorbellen', 'nl'], ['parure lune', 'fr']
	];
	for (const [q, l] of queries.slice(0, 5)) await searchSuggest(db, q, l); // warm-up
	const times: number[] = [];
	for (let round = 0; round < 10; round++) {
		for (const [q, l] of queries) {
			const t = performance.now();
			await searchSuggest(db, q, l);
			times.push(performance.now() - t);
		}
	}
	times.sort((a, b) => a - b);
	const pct = (p: number) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))].toFixed(1);
	const ok = Number(pct(95)) < 150;
	console.log(`${total} products · ${times.length} queries · p50 ${pct(50)} ms · p95 ${pct(95)} ms · max ${times.at(-1)!.toFixed(1)} ms → ${ok ? 'PASS' : 'FAIL'} (p95 < 150 ms)`);
	const sample = await searchSuggest(db, 'klavr', 'nl');
	console.log('sample "klavr":', JSON.stringify(sample).slice(0, 200));
	process.exitCode = ok ? 0 : 1;
} finally {
	await pool.end();
}
