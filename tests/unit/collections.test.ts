import { describe, expect, it } from 'vitest';
import { describeRule, matchesRule, type RuleProduct } from '#lib/server/services/collections.ts';
import { collectionSchema } from '#lib/schemas/collection.ts';

const NOW = new Date('2026-10-08T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const product = (p: Partial<RuleProduct> = {}): RuleProduct => ({
	categoryKey: 'rings',
	tags: ['klaver'],
	createdAt: daysAgo(5),
	price: 4995,
	compareAtPrice: null,
	...p
});

describe('matchesRule', () => {
	it('empty rule matches everything', () => {
		expect(matchesRule(product(), {}, NOW)).toBe(true);
	});

	it('"Nieuw" (newWithinDays 30) lists products created in the last 30 days only', () => {
		const rule = { newWithinDays: 30 };
		expect(matchesRule(product({ createdAt: daysAgo(0) }), rule, NOW)).toBe(true);
		expect(matchesRule(product({ createdAt: daysAgo(29.9) }), rule, NOW)).toBe(true);
		expect(matchesRule(product({ createdAt: daysAgo(30) }), rule, NOW)).toBe(true);
		expect(matchesRule(product({ createdAt: daysAgo(30.01) }), rule, NOW)).toBe(false);
		expect(matchesRule(product({ createdAt: daysAgo(400) }), rule, NOW)).toBe(false);
	});

	it('matches category by key', () => {
		expect(matchesRule(product(), { category: 'rings' }, NOW)).toBe(true);
		expect(matchesRule(product(), { category: 'necklaces' }, NOW)).toBe(false);
	});

	it('matches tags case-insensitively', () => {
		expect(matchesRule(product({ tags: ['Klaver', 'rood'] }), { tag: 'klaver' }, NOW)).toBe(true);
		expect(matchesRule(product({ tags: [] }), { tag: 'klaver' }, NOW)).toBe(false);
	});

	it('onSale requires a compare-at price above the price', () => {
		expect(matchesRule(product({ compareAtPrice: 5995 }), { onSale: true }, NOW)).toBe(true);
		expect(matchesRule(product({ compareAtPrice: 4995 }), { onSale: true }, NOW)).toBe(false);
		expect(matchesRule(product({ compareAtPrice: null }), { onSale: true }, NOW)).toBe(false);
		expect(matchesRule(product({ compareAtPrice: null }), { onSale: false }, NOW)).toBe(true);
	});

	it('priceLt is a strict upper bound in cents', () => {
		expect(matchesRule(product({ price: 4999 }), { priceLt: 5000 }, NOW)).toBe(true);
		expect(matchesRule(product({ price: 5000 }), { priceLt: 5000 }, NOW)).toBe(false);
	});

	it('combines conditions with AND', () => {
		const rule = { category: 'rings', tag: 'klaver', newWithinDays: 30, priceLt: 5000 };
		expect(matchesRule(product(), rule, NOW)).toBe(true);
		expect(matchesRule(product({ categoryKey: 'bracelets' }), rule, NOW)).toBe(false);
		expect(matchesRule(product({ price: 6000 }), rule, NOW)).toBe(false);
		expect(matchesRule(product({ createdAt: daysAgo(60) }), rule, NOW)).toBe(false);
	});

	it('describes rules in Dutch', () => {
		expect(describeRule({ newWithinDays: 30 })).toBe('nieuw (≤ 30 dagen)');
		expect(describeRule({ category: 'rings', priceLt: 5000, onSale: true }, () => 'Ringen')).toBe('categorie Ringen · in solden · prijs < € 50,00');
		expect(describeRule({})).toBe('alle producten');
	});
});

describe('collectionSchema', () => {
	const base = { name: { nl: 'Nieuw', fr: 'Nouveautés' }, slugs: { nl: 'nieuw', fr: 'nouveautes' }, type: 'rule' };

	it('parses a rule collection with euro price and day count', () => {
		const r = collectionSchema.safeParse({ ...base, rule: { newWithinDays: '30', priceLt: '50', onSale: 'on', category: '', tag: ' Klaver ' } });
		expect(r.success).toBe(true);
		expect(r.data!.rule).toEqual({ newWithinDays: 30, priceLt: 5000, onSale: true, tag: 'klaver' });
	});

	it('requires at least one rule for rule collections', () => {
		const r = collectionSchema.safeParse({ ...base, rule: {} });
		expect(r.success).toBe(false);
		expect(r.error!.issues[0].path).toEqual(['rule']);
	});

	it('rejects reserved slugs and keeps manual product order', () => {
		const ids = ['8b1f7a52-6d8e-4c63-9f2e-0d3c2b1a0e01', '8b1f7a52-6d8e-4c63-9f2e-0d3c2b1a0e02'];
		const ok = collectionSchema.safeParse({ ...base, type: 'manual', products: [ids[1], ids[0], ids[1], 'nope'] });
		expect(ok.data!.products).toEqual([ids[1], ids[0]]);
		const bad = collectionSchema.safeParse({ ...base, slugs: { nl: 'winkelmand', fr: 'x-y' }, type: 'manual' });
		expect(bad.success).toBe(false);
		expect(bad.error!.issues.some((i) => i.path.join('.') === 'slugs.nl')).toBe(true);
	});
});
