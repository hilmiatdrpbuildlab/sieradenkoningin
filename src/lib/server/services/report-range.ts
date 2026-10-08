/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (Brussels calendar days, `to` inclusive) into a UTC range. */
import type { Range } from './reports.ts';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight Europe/Brussels for a calendar date, as a UTC Date (handles DST). */
export function brusselsMidnight(date: string): Date {
	const guess = new Date(`${date}T00:00:00Z`);
	const offset = (d: Date) => {
		const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', timeZoneName: 'shortOffset' }).formatToParts(d).find((x) => x.type === 'timeZoneName')?.value ?? 'GMT+1';
		const m = /GMT([+-]\d+)/.exec(p);
		return (m ? Number(m[1]) : 0) * 3600_000;
	};
	return new Date(guess.getTime() - offset(guess));
}

export function parseRange(url: URL, defaultDays = 30): { range: Range; from: string; to: string } {
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
	let to = url.searchParams.get('to') ?? '';
	let from = url.searchParams.get('from') ?? '';
	if (!DAY.test(to)) to = today;
	if (!DAY.test(from)) from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date(brusselsMidnight(to).getTime() - (defaultDays - 1) * 86400_000));
	if (from > to) [from, to] = [to, from];
	const end = new Date(brusselsMidnight(to).getTime() + 36 * 3600_000); // next day, then snap to its midnight
	const endDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(end);
	return { range: { from: brusselsMidnight(from), to: brusselsMidnight(endDay) }, from, to };
}
