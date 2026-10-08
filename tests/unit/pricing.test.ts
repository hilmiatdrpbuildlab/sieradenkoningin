import { describe, expect, it } from 'vitest';
import { allocate, computeTotals, shippingPrice, unitPrice, type ShippingRate } from '#lib/server/services/pricing.ts';
import { vatIncluded } from '#lib/utils/format.ts';

const rates: ShippingRate[] = [
	{ method: 'home', price: 495, freeFrom: 5000, active: true },
	{ method: 'pickup', price: 395, freeFrom: null, active: true }
];

/** Small deterministic PRNG so the "random" carts are reproducible. */
function rng(seed: number) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
}

describe('unitPrice', () => {
	it('uses the variant override when set', () => {
		expect(unitPrice({ price: 2995 }, { priceOverride: null })).toBe(2995);
		expect(unitPrice({ price: 2995 }, { priceOverride: 3495 })).toBe(3495);
	});
});

describe('shippingPrice', () => {
	it('charges the rate below the threshold and nothing from it', () => {
		expect(shippingPrice(rates, 'home', 4999, 5000)).toBe(495);
		expect(shippingPrice(rates, 'home', 5000, 5000)).toBe(0);
	});
	it('falls back to the default threshold when the rate has none', () => {
		expect(shippingPrice(rates, 'pickup', 2000, 3000)).toBe(395);
		expect(shippingPrice(rates, 'pickup', 3000, 3000)).toBe(0);
	});
	it('is free with a free-shipping code', () => {
		expect(shippingPrice(rates, 'home', 100, 5000, true)).toBe(0);
	});
	it('returns null for an unknown or inactive method', () => {
		expect(shippingPrice([{ ...rates[0], active: false }], 'home', 100, 5000)).toBeNull();
		expect(shippingPrice([rates[0]], 'pickup', 100, 5000)).toBeNull();
	});
	it('applies the threshold to the merchandise total AFTER discount', () => {
		expect(shippingPrice(rates, 'home', 5500 - 1000, 5000)).toBe(495);
	});
});

describe('allocate', () => {
	it('splits proportionally and always sums to the amount', () => {
		expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
		expect(allocate(1000, [3000, 1000])).toEqual([750, 250]);
		expect(allocate(1, [1, 1])).toEqual([1, 0]);
	});
	it('returns zeros when there is nothing to allocate', () => {
		expect(allocate(0, [10, 20])).toEqual([0, 0]);
		expect(allocate(50, [0, 0])).toEqual([0, 0]);
	});
});

describe('computeTotals', () => {
	it('computes a simple order', () => {
		const t = computeTotals([{ unitPrice: 2995, qty: 2 }], 0, 495);
		expect(t.subtotal).toBe(5990);
		expect(t.total).toBe(6485);
		expect(t.lineVat).toEqual([vatIncluded(5990)]);
		expect(t.shippingVat).toBe(vatIncluded(495));
		expect(t.vat).toBe(vatIncluded(5990) + vatIncluded(495));
	});
	it('caps the discount at the subtotal', () => {
		const t = computeTotals([{ unitPrice: 1000, qty: 1 }], 5000, 0);
		expect(t.discount).toBe(1000);
		expect(t.total).toBe(0);
		expect(t.vat).toBe(0);
	});

	it('100 random carts reconcile to the cent: sum(lines) + shipping − discount = total, and VAT per line sums correctly', () => {
		const r = rng(20261008);
		for (let n = 0; n < 100; n++) {
			const lines = Array.from({ length: 1 + Math.floor(r() * 5) }, () => ({
				unitPrice: 495 + Math.floor(r() * 25000),
				qty: 1 + Math.floor(r() * 4)
			}));
			const lineTotals = lines.map((l) => l.unitPrice * l.qty);
			const subtotal = lineTotals.reduce((a, b) => a + b, 0);
			const kind = Math.floor(r() * 3);
			const discount = kind === 0 ? 0 : kind === 1 ? Math.round(subtotal * (0.05 + r() * 0.3)) : Math.floor(r() * 3000);
			const shipping = subtotal - discount >= 5000 ? 0 : 495;
			const t = computeTotals(lines, discount, shipping);

			// Order-level identity
			expect(t.subtotal).toBe(subtotal);
			expect(t.total).toBe(t.subtotal + t.shipping - t.discount);
			// Line-level identity, as stored in order_lines (line_total, discount_amount, vat_amount)
			expect(t.lineDiscounts.reduce((a, b) => a + b, 0)).toBe(t.discount);
			const paid = lineTotals.map((lt, i) => lt - t.lineDiscounts[i]);
			expect(paid.reduce((a, b) => a + b, 0) + t.shipping).toBe(t.total);
			paid.forEach((p, i) => {
				expect(p).toBeGreaterThanOrEqual(0);
				expect(t.lineVat[i]).toBe(vatIncluded(p));
			});
			expect(t.lineVat.reduce((a, b) => a + b, 0) + t.shippingVat).toBe(t.vat);
			// Per-line VAT and VAT on the grand total differ by rounding only (at most ½ cent per line)
			expect(Math.abs(t.vat - vatIncluded(t.total))).toBeLessThanOrEqual(Math.ceil((lines.length + 1) / 2));
			for (const v of [t.subtotal, t.discount, t.shipping, t.total, t.vat, ...t.lineVat, ...t.lineDiscounts])
				expect(Number.isInteger(v)).toBe(true);
		}
	});
});
