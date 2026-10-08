/** Admin order forms (P2-09, P3-05, P3-06). */
import { z } from 'zod';
import { checkbox, euroToCents } from './common.ts';

export const uuid = z.uuid();

export const statusForm = z.object({
	to: z.enum(['processing', 'delivered', 'cancelled']),
	reason: z.string().trim().max(500).optional()
});

export const shipForm = z.object({
	carrier: z.string().trim().max(40).optional(),
	trackingNumber: z.string().trim().max(80).optional(),
	trackingUrl: z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(500)]).optional()
});

export const noteForm = z.object({
	text: z.string().trim().min(1, 'Schrijf een notitie').max(2000, 'Maximaal 2000 tekens')
});

export const refundForm = z
	.object({
		mode: z.enum(['amount', 'lines']),
		amount: euroToCents.optional(),
		shipping: checkbox,
		restock: checkbox,
		reason: z.string().trim().max(500).optional(),
		lines: z.array(z.object({ orderLineId: z.uuid(), qty: z.coerce.number().int().min(0).max(1000) })).default([])
	})
	.superRefine((v, ctx) => {
		if (v.mode === 'amount' && !v.amount)
			ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Geef een bedrag in' });
		if (v.mode === 'lines' && !v.lines.some((l) => l.qty > 0))
			ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Kies minstens één artikel' });
	});

/** Form data → refund input (line quantities come as `qty_<orderLineId>` fields). */
export function refundFormInput(fd: FormData) {
	const lines: { orderLineId: string; qty: string }[] = [];
	for (const [k, v] of fd.entries())
		if (k.startsWith('qty_') && typeof v === 'string' && v.trim()) lines.push({ orderLineId: k.slice(4), qty: v });
	const str = (k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : undefined);
	return {
		mode: str('mode'),
		amount: str('amount'),
		shipping: str('shipping'),
		restock: str('restock'),
		reason: str('reason'),
		lines
	};
}
