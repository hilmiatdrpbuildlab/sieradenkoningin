import { z } from 'zod';

export const addToCartSchema = z.object({
	variantId: z.string().uuid(),
	qty: z.coerce.number().int().min(1).max(10).default(1),
	giftWrap: z.boolean().optional()
});

export const updateLineSchema = z.object({
	lineId: z.string().uuid(),
	qty: z.coerce.number().int().min(0).max(10).optional(),
	giftWrap: z.boolean().optional()
});

export const discountCodeSchema = z.object({ code: z.string().trim().min(2).max(40) });
