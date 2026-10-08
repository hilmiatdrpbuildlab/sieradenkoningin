/**
 * `<input type="datetime-local">` ⇄ UTC conversion in Europe/Brussels (§2.4: stored in UTC, entered and
 * shown in Brussels time). Works on server and client without a timezone library, DST-safe.
 */
import { TIME_ZONE } from './format.ts';

function parts(d: Date) {
	const p = new Intl.DateTimeFormat('en-GB', {
		timeZone: TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(d);
	const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
	return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** Offset of Brussels vs UTC at `d`, in ms (+1h in winter, +2h in summer). */
function offsetAt(d: Date) {
	const p = parts(d);
	return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC instant → "YYYY-MM-DDTHH:mm" in Brussels time ('' for empty). */
export function toBrusselsInput(value: Date | string | null | undefined): string {
	if (!value) return '';
	const d = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return '';
	const p = parts(d);
	return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** "YYYY-MM-DDTHH:mm" in Brussels time → ISO UTC string (null for empty/invalid). */
export function fromBrusselsInput(local: string | null | undefined): string | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec((local ?? '').trim());
	if (!m) return null;
	const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
	let t = wall - offsetAt(new Date(wall));
	t = wall - offsetAt(new Date(t)); // second pass settles DST transitions
	return new Date(t).toISOString();
}

/** Human Brussels date-time for admin lists ("8 okt. 2026 14:00"). */
export function formatBrussels(value: Date | string | null | undefined): string {
	if (!value) return '';
	return new Intl.DateTimeFormat('nl-BE', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(value)
	);
}
