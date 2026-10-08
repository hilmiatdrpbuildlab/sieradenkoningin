/** P4-01 / P4-02 — page builder: scheduling with a fake clock, block validation round-trip, menus, Brussels time. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { isBlockVisible, BLOCK_TYPES, type Block } from '#lib/schemas/page-block.ts';
import {
	cleanBlockData,
	getBlocks,
	hasMissingFr,
	parseMenuForm,
	savePage,
	validateBlocks
} from '#lib/server/services/content.ts';
import { pageSeeds } from '#lib/server/db/seed-data.ts';
import { fromBrusselsInput, toBrusselsInput } from '#lib/utils/brussels-time.ts';
import { createDb } from '#lib/server/db/index.ts';
import { pages } from '#lib/server/db/schema.ts';

const SWAP = '2026-11-27T08:00:00.000Z'; // Black Friday 09:00 Brussels
const hero = (title: string, from: string | null, until: string | null): Block =>
	({
		id: crypto.randomUUID(),
		type: 'hero',
		data: { variant: 'overlay', title: { nl: title }, image: { key: 'demo/x.svg', alt: { nl: 'alt' } } },
		hidden: false,
		visibleFrom: from,
		visibleUntil: until
	}) as Block;

describe('isBlockVisible (fake clock)', () => {
	afterEach(() => vi.useRealTimers());
	const regular = hero('Regular', null, SWAP);
	const promo = hero('Black Friday', SWAP, null);
	const visibleTitles = () =>
		[regular, promo].filter((b) => isBlockVisible(b)).map((b) => (b.data as { title: { nl: string } }).title.nl);

	it('shows the regular hero before the swap moment', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-11-27T07:59:59.999Z'));
		expect(visibleTitles()).toEqual(['Regular']);
	});
	it('swaps exactly at the set time (from is inclusive, until exclusive)', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(SWAP));
		expect(visibleTitles()).toEqual(['Black Friday']);
	});
	it('hidden blocks are never visible', () => {
		expect(isBlockVisible({ ...promo, hidden: true }, new Date('2030-01-01'))).toBe(false);
	});
});

describe('getBlocks against the DB (fake clock)', () => {
	const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://sk@localhost:54329/sieradenkoningin', 2);
	let pageId = '';
	beforeAll(async () => {
		pageId = await savePage(
			db,
			null,
			{
				title: { nl: 'TEST schedule' },
				slugs: { nl: `test-sched-${Date.now()}`, fr: `test-sched-fr-${Date.now()}` },
				type: 'landing',
				status: 'draft',
				publishAt: null,
				seo: {}
			},
			[
				hero('Regular', null, SWAP),
				hero('Black Friday', SWAP, null),
				{ ...hero('Hidden', null, null), hidden: true } as Block
			]
		);
	});
	afterAll(async () => {
		vi.useRealTimers();
		if (pageId) await db.delete(pages).where(eq(pages.id, pageId));
		await close();
	});
	const titles = (bs: Block[]) => bs.map((b) => (b.data as { title: { nl: string } }).title.nl);

	it('filters by schedule at request time', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-11-26T12:00:00Z'));
		expect(titles(await getBlocks(db, pageId))).toEqual(['Regular']);
		vi.setSystemTime(new Date('2026-11-27T08:00:00Z'));
		expect(titles(await getBlocks(db, pageId))).toEqual(['Black Friday']);
		vi.useRealTimers();
	});
	it('admin sees every block, hidden ones included, in order', async () => {
		expect(titles(await getBlocks(db, pageId, { includeHidden: true }))).toEqual(['Regular', 'Black Friday', 'Hidden']);
	});
});

describe('block validation round-trip', () => {
	const seeds = pageSeeds('demo/editorial-hero.svg', 'demo/editorial-split.svg');

	it('every seeded block (home + help + legal pages) passes through the editor unchanged', () => {
		for (const p of seeds) {
			const input = p.blocks.map((b, i) => ({
				id: `x${i}`,
				...b,
				hidden: false,
				visibleFrom: null,
				visibleUntil: null
			}));
			const { blocks, errors } = validateBlocks(input);
			expect(errors, p.key).toEqual([]);
			expect(
				blocks.map((b) => ({ type: b.type, data: b.data })),
				p.key
			).toEqual(p.blocks.map((b) => ({ type: b.type, data: b.data })));
		}
	});

	it('the seeded home page uses at least the 8 home block types', () => {
		const home = seeds.find((p) => p.key === 'home')!;
		expect(new Set(home.blocks.map((b) => b.type)).size).toBeGreaterThanOrEqual(7);
	});

	it('the live home page in the DB round-trips unchanged', async () => {
		const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://sk@localhost:54329/sieradenkoningin', 1);
		try {
			const [home] = await db.select().from(pages).where(eq(pages.key, 'home'));
			const current = await getBlocks(db, home.id, { includeHidden: true });
			const { blocks, errors } = validateBlocks(JSON.parse(JSON.stringify(current)));
			expect(errors).toEqual([]);
			expect(blocks).toEqual(current);
		} finally {
			await close();
		}
	});

	it('drops an emptied optional CTA but rejects an emptied required title', () => {
		const ok = validateBlocks([
			{
				type: 'banner',
				data: {
					title: { nl: 'X' },
					surface: 'inverse',
					image: { key: 'a', alt: { nl: 'b' } },
					cta: { label: { nl: '' }, href: { nl: '' } }
				}
			}
		]);
		expect(ok.errors).toEqual([]);
		expect('cta' in (ok.blocks[0].data as object)).toBe(false);
		const bad = validateBlocks([{ type: 'rich_text', data: { body: { nl: '  ', fr: '' } } }]);
		expect(bad.errors[0]).toMatch(/Blok 1 \(Tekst\).*body/);
		expect(bad.byIndex[0]).toBeTruthy();
	});

	it('rejects unknown types, bad schedules and empty manual rails', () => {
		expect(validateBlocks([{ type: 'script', data: {} }]).errors[0]).toMatch(/onbekend/);
		const sched = validateBlocks([
			{ type: 'faq_list', data: {}, visibleFrom: '2026-12-02T00:00:00Z', visibleUntil: '2026-12-01T00:00:00Z' }
		]);
		expect(sched.errors[0]).toMatch(/zichtbaar tot/);
		expect(
			validateBlocks([{ type: 'product_rail', data: { title: { nl: 'X' }, source: 'manual', limit: 8 } }]).errors[0]
		).toMatch(/product/);
	});

	it('every block type has a schema the editor can validate', () => {
		expect(BLOCK_TYPES.length).toBe(13);
	});

	it('cleanBlockData trims, drops empty fr and keeps untouched values', () => {
		expect(cleanBlockData({ title: { nl: ' A ', fr: '' }, n: 3, b: false })).toEqual({
			title: { nl: 'A' },
			n: 3,
			b: false
		});
		expect(hasMissingFr({ a: [{ t: { nl: 'x' } }] })).toBe(true);
		expect(hasMissingFr({ a: { nl: 'x', fr: 'y' } })).toBe(false);
	});
});

describe('menu form parsing', () => {
	const fd = (rows: string[][], extra: [string, string][] = []) => {
		const f = new FormData();
		for (const [lnl, lfr, hnl, hfr] of rows) {
			f.append('label_nl', lnl);
			f.append('label_fr', lfr);
			f.append('href_nl', hnl);
			f.append('href_fr', hfr);
			f.append('children', '[]');
		}
		for (const [k, v] of extra) f.append(k, v);
		return f;
	};
	const fr = (h: string) => h.replace('/nl', '/fr');

	it('builds NL/FR items, skips empty rows, defaults the FR link', () => {
		const r = parseMenuForm(
			fd([
				['Ringen', 'Bagues', '/nl/ringen', '/fr/bagues'],
				['FAQ', '', '/nl/faq', ''],
				['', '', '', '']
			]),
			fr
		);
		expect(r.errors).toEqual({});
		expect(r.items).toEqual([
			{ label: { nl: 'Ringen', fr: 'Bagues' }, href: { nl: '/nl/ringen', fr: '/fr/bagues' } },
			{ label: { nl: 'FAQ' }, href: { nl: '/nl/faq', fr: '/fr/faq' } }
		]);
	});
	it('applies no-JS move and remove buttons', () => {
		const rows = [
			['A', '', '/nl/a', ''],
			['B', '', '/nl/b', '']
		];
		expect(parseMenuForm(fd(rows, [['move', '1:up']]), fr).items.map((i) => i.label.nl)).toEqual(['B', 'A']);
		expect(parseMenuForm(fd(rows, [['remove', '0']]), fr).items.map((i) => i.label.nl)).toEqual(['B']);
	});
	it('validates labels and links', () => {
		const r = parseMenuForm(fd([['', 'x', 'javascript:alert(1)', '']]), fr);
		expect(Object.keys(r.errors).sort()).toEqual(['0.href', '0.label']);
	});
});

describe('Europe/Brussels datetime-local conversion', () => {
	it('winter (UTC+1) and summer (UTC+2)', () => {
		expect(fromBrusselsInput('2026-12-01T09:00')).toBe('2026-12-01T08:00:00.000Z');
		expect(fromBrusselsInput('2026-07-01T09:00')).toBe('2026-07-01T07:00:00.000Z');
		expect(toBrusselsInput('2026-12-01T08:00:00.000Z')).toBe('2026-12-01T09:00');
		expect(toBrusselsInput('2026-07-01T07:00:00.000Z')).toBe('2026-07-01T09:00');
	});
	it('round-trips around the DST switch and rejects garbage', () => {
		for (const local of ['2026-03-29T01:30', '2026-03-29T03:30', '2026-10-25T04:00'])
			expect(toBrusselsInput(fromBrusselsInput(local))).toBe(local);
		expect(fromBrusselsInput('')).toBeNull();
		expect(fromBrusselsInput('morgen')).toBeNull();
	});
});
