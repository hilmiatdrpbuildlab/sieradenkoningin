import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as s from '#lib/server/db/schema.ts';

/** Every column that holds money (EUR cents) — must be an integer column, never numeric/float. */
const MONEY: [keyof typeof s, string[]][] = [
	['products', ['price', 'compareAtPrice']],
	['priceHistory', ['price']],
	['variants', ['priceOverride']],
	['orders', ['subtotal', 'discountTotal', 'shippingTotal', 'vatTotal', 'total', 'refundedTotal']],
	['orderLines', ['unitPrice', 'vatAmount', 'lineTotal', 'discountAmount']],
	['payments', ['amount']],
	['refunds', ['amount']],
	['discounts', ['minSubtotal']],
	['discountRedemptions', ['amount']],
	['giftCards', ['initial', 'balance']],
	['giftCardTransactions', ['delta']],
	['shippingRates', ['price', 'freeFrom']]
];

describe('schema', () => {
	it('stores every money column as integer cents', () => {
		for (const [table, cols] of MONEY) {
			const columns = getTableColumns(s[table] as never) as Record<string, { columnType: string }>;
			for (const col of cols) {
				expect(columns[col], `${String(table)}.${col}`).toBeDefined();
				expect(columns[col].columnType, `${String(table)}.${col}`).toBe('PgInteger');
			}
		}
	});

	it('forbids negative stock with a check constraint', () => {
		const cfg = getTableConfig(s.variants);
		expect(cfg.checks.map((c) => c.name)).toContain('variants_stock_nonneg');
	});

	it('has the indexes required by §6', () => {
		const names = (t: Parameters<typeof getTableConfig>[0]) => getTableConfig(t).indexes.map((i) => i.config.name);
		expect(names(s.products)).toEqual(expect.arrayContaining(['products_cat_status_idx', 'products_name_trgm_idx', 'products_slug_uq']));
		expect(names(s.orders)).toEqual(expect.arrayContaining(['orders_status_placed_idx', 'orders_number_uq']));
	});
});
