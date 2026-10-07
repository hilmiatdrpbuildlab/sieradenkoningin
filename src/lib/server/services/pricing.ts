/**
 * Pricing & totals (pure functions, unit-tested). All amounts are integer cents, VAT-inclusive.
 * VAT is extracted per line with `vatIncluded()` and the order total reconciles to the cent:
 *   sum(line totals) − discount + shipping = total.
 */
import { BE_VAT_RATE, vatIncluded } from '../../utils/format.ts';

export const VAT_BP = 2100; // 21% in basis points

export interface ShippingRate {
	method: 'home' | 'pickup';
	price: number;
	freeFrom: number | null;
	active: boolean;
}

export function unitPrice(product: { price: number }, variant: { priceOverride: number | null }) {
	return variant.priceOverride ?? product.price;
}

/** Shipping price for a method after discounts (free above the threshold or with a free-shipping code). */
export function shippingPrice(
	rates: ShippingRate[],
	method: 'home' | 'pickup',
	merchandiseAfterDiscount: number,
	defaultFreeFrom: number,
	freeShippingCode = false
): number | null {
	const rate = rates.find((r) => r.method === method && r.active);
	if (!rate) return null;
	if (freeShippingCode) return 0;
	const threshold = rate.freeFrom ?? defaultFreeFrom;
	return merchandiseAfterDiscount >= threshold ? 0 : rate.price;
}

export interface TotalsLine {
	unitPrice: number;
	qty: number;
}

export interface Totals {
	subtotal: number;
	discount: number;
	shipping: number;
	total: number;
	vat: number;
	/** Discount allocated per line (same order as input) so each line's VAT is exact. */
	lineDiscounts: number[];
	lineVat: number[];
	shippingVat: number;
}

/**
 * Computes totals. The discount is allocated across lines proportionally (largest remainder) so the
 * per-line VAT is computed on what was actually paid; shipping VAT is computed separately.
 */
export function computeTotals(lines: TotalsLine[], discount: number, shipping: number, rate = BE_VAT_RATE): Totals {
	const lineTotals = lines.map((l) => l.unitPrice * l.qty);
	const subtotal = lineTotals.reduce((a, b) => a + b, 0);
	const d = Math.max(0, Math.min(discount, subtotal));
	const lineDiscounts = allocate(d, lineTotals);
	const lineVat = lineTotals.map((t, i) => vatIncluded(t - lineDiscounts[i], rate));
	const shippingVat = vatIncluded(shipping, rate);
	const total = subtotal - d + shipping;
	return { subtotal, discount: d, shipping, total, vat: lineVat.reduce((a, b) => a + b, 0) + shippingVat, lineDiscounts, lineVat, shippingVat };
}

/** Split `amount` over `weights` proportionally; the parts always sum exactly to `amount`. */
export function allocate(amount: number, weights: number[]): number[] {
	const sum = weights.reduce((a, b) => a + b, 0);
	if (amount <= 0 || sum <= 0) return weights.map(() => 0);
	const raw = weights.map((w) => (amount * w) / sum);
	const parts = raw.map(Math.floor);
	let rest = amount - parts.reduce((a, b) => a + b, 0);
	const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
	for (const [, i] of order) {
		if (rest <= 0) break;
		parts[i]++;
		rest--;
	}
	return parts;
}
