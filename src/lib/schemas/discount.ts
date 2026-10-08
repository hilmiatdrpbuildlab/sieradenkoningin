import { z } from 'zod';
import { checkbox, euroToCents } from './common.ts';

/** datetime-local value ("2026-11-27T00:00", Europe/Brussels wall time) → Date (UTC). */
export function brusselsLocalToDate(value: string): Date | null {
	if (!value) return null;
	const [d, t = '00:00'] = value.split('T');
	const guess = new Date(`${d}T${t}:00Z`);
	const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', timeZoneName: 'shortOffset' }).formatToParts(guess).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1';
	const offset = Number(/GMT([+-]\d+)/.exec(part)?.[1] ?? 0);
	return new Date(guess.getTime() - offset * 3600_000);
}

/** Date → datetime-local value in Europe/Brussels. */
export function dateToBrusselsLocal(d: Date | null | undefined): string {
	if (!d) return '';
	const p = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
			.formatToParts(d)
			.map((x) => [x.type, x.value])
	);
	return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

const optionalInt = z
	.string()
	.trim()
	.transform((v, ctx) => {
		if (v === '') return null;
		const n = Number(v);
		if (!Number.isInteger(n) || n < 1) {
			ctx.addIssue({ code: 'custom', message: 'Geef een geheel getal ≥ 1' });
			return z.NEVER;
		}
		return n;
	});

export const discountSchema = z
	.object({
		code: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[A-Z0-9_-]{3,40}$/, '3–40 tekens: letters, cijfers, - of _'),
		type: z.enum(['percent', 'amount', 'free_shipping']),
		percent: z.string().trim().default(''),
		amount: euroToCents.optional(),
		minSubtotal: euroToCents.optional(),
		startsAt: z.string().default(''),
		endsAt: z.string().default(''),
		usageLimit: z.string().default('').pipe(optionalInt),
		perCustomerLimit: z.string().default('').pipe(optionalInt),
		active: checkbox
	})
	.transform((v, ctx) => {
		let value = 0;
		if (v.type === 'percent') {
			value = Number(v.percent.replace(',', '.'));
			if (!Number.isInteger(value) || value < 1 || value > 100) ctx.addIssue({ code: 'custom', path: ['percent'], message: 'Percentage tussen 1 en 100' });
		} else if (v.type === 'amount') {
			value = v.amount ?? 0;
			if (value <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Bedrag is verplicht' });
		}
		const startsAt = brusselsLocalToDate(v.startsAt);
		const endsAt = brusselsLocalToDate(v.endsAt);
		if (startsAt && endsAt && endsAt <= startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Einde moet na het begin liggen' });
		return {
			code: v.code,
			type: v.type,
			value,
			minSubtotal: v.minSubtotal ?? null,
			startsAt,
			endsAt,
			usageLimit: v.usageLimit,
			perCustomerLimit: v.perCustomerLimit,
			active: v.active
		};
	});
