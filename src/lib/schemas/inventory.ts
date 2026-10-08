/** Inventory adjustments (P1-04). Stock is never set blindly: every change is a delta with a reason. */
import { z } from 'zod';

/** Reasons an admin may pick by hand ('sale' / 'reservation_release' are written by checkout only). */
export const MANUAL_STOCK_REASONS = ['adjust', 'return', 'import'] as const;
export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number];

export const STOCK_REASON_LABELS: Record<string, string> = {
	adjust: 'Correctie / telling',
	return: 'Retour',
	import: 'Import / levering',
	sale: 'Verkoop',
	reservation_release: 'Reservatie vrijgegeven'
};

export const stockAdjustSchema = z.object({
	variantId: z.uuid({ error: 'Onbekende variant' }),
	delta: z
		.string()
		.trim()
		.min(1, 'Geef een aantal op')
		.transform((v, ctx) => {
			const n = Number(v.replace(/^\+/, ''));
			if (!Number.isInteger(n) || n === 0) {
				ctx.addIssue({ code: 'custom', message: 'Geef een geheel getal verschillend van 0 (bv. +5 of -2)' });
				return z.NEVER;
			}
			if (Math.abs(n) > 100_000) {
				ctx.addIssue({ code: 'custom', message: 'Aantal is te groot' });
				return z.NEVER;
			}
			return n;
		}),
	reason: z.enum(MANUAL_STOCK_REASONS, { error: 'Kies een reden' }),
	note: z
		.string()
		.trim()
		.max(200, 'Maximaal 200 tekens')
		.optional()
		.transform((v) => v || null)
});
export type StockAdjustInput = z.output<typeof stockAdjustSchema>;
