import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from '#lib/utils/slug.ts';
import { slugSchema } from '#lib/schemas/common.ts';

describe('slugify', () => {
	it('lowercases and hyphenates', () => {
		expect(slugify('Klaver Ring Goud')).toBe('klaver-ring-goud');
	});

	it('strips accents (FR) and ligatures', () => {
		expect(slugify('Bague trèfle — Or rosé')).toBe('bague-trefle-or-rose');
		expect(slugify('Cœur & Âme')).toBe('coeur-en-ame');
		expect(slugify('Ærø')).toBe('aero');
	});

	it('drops apostrophes instead of splitting words', () => {
		expect(slugify("Boucles d'oreilles")).toBe('boucles-doreilles');
		expect(slugify('L’or du soir')).toBe('lor-du-soir');
	});

	it('collapses separators and trims hyphens', () => {
		expect(slugify('  --Hello,,,  World!!  ')).toBe('hello-world');
		expect(slugify('18k / 925 zilver')).toBe('18k-925-zilver');
	});

	it('returns an empty string when nothing is left', () => {
		expect(slugify('—!?')).toBe('');
	});

	it('limits length at a word boundary', () => {
		const s = slugify('een heel lange productnaam met heel veel woorden erin om af te kappen', 30);
		expect(s.length).toBeLessThanOrEqual(30);
		expect(s.endsWith('-')).toBe(false);
		expect(s).toBe('een-heel-lange-productnaam');
	});

	it('always satisfies slugSchema for non-trivial input', () => {
		for (const input of ['Klaverring', 'Ring № 5', 'Été 2027 – Collection', 'A  B', 'Ünïcödé Ring']) {
			expect(slugSchema.safeParse(slugify(input)).success, input).toBe(true);
		}
	});
});

describe('uniqueSlug', () => {
	it('returns the base when free', async () => {
		expect(await uniqueSlug('Klaver ring', () => false)).toBe('klaver-ring');
	});

	it('appends a counter when taken', async () => {
		const taken = new Set(['klaver-ring', 'klaver-ring-2']);
		expect(await uniqueSlug('klaver-ring', (s) => taken.has(s))).toBe('klaver-ring-3');
	});

	it('supports a suffix and async lookups', async () => {
		const taken = new Set(['klaver-ring-kopie']);
		expect(await uniqueSlug('klaver-ring', async (s) => taken.has(s), 'kopie')).toBe('klaver-ring-kopie-2');
	});
});
