/** Shared zod building blocks (client + server). */
import { z } from 'zod';

export const i18nSchema = z.object({
	nl: z.string().trim(),
	fr: z.string().trim().optional(),
	en: z.string().trim().optional()
});
export const i18nRequired = (message = 'Nederlandse tekst is verplicht') =>
	z.object({ nl: z.string().trim().min(1, message), fr: z.string().trim().optional(), en: z.string().trim().optional() });

export const slugSchema = z
	.string()
	.trim()
	.min(2, 'Minstens 2 tekens')
	.max(120)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Alleen kleine letters, cijfers en koppeltekens');

/** "49,95" or "49.95" or "49" (€) → 4995 cents. Empty → undefined. */
export const euroToCents = z
	.string()
	.trim()
	.transform((v, ctx) => {
		if (v === '') return undefined;
		const n = Number(v.replace(/\s/g, '').replace(',', '.'));
		if (!Number.isFinite(n) || n < 0) {
			ctx.addIssue({ code: 'custom', message: 'Ongeldig bedrag' });
			return z.NEVER;
		}
		return Math.round(n * 100);
	});

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Ongeldig e-mailadres')).pipe(z.string().max(254));

export const checkbox = z
	.union([z.literal('on'), z.literal('true'), z.literal('1'), z.literal(''), z.undefined(), z.null()])
	.transform((v) => v === 'on' || v === 'true' || v === '1');

/** Turns zod issues into { field: [messages] } keyed by dotted path. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || '_';
		(out[key] ??= []).push(issue.message);
	}
	return out;
}
