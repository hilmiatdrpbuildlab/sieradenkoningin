/** Daily summary e-mail to the shop inbox (P5-04): yesterday's sales, orders to process, low stock. */
import { and, eq, lte, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { emailLog, orders, products, variants } from '../db/schema.ts';
import type { EmailAdapter } from '../adapters/email.ts';
import { summary, type Range } from './reports.ts';
import { formatPrice } from '../../utils/format.ts';

/** Yesterday as a Brussels calendar day, in UTC. */
export function yesterdayRange(now = new Date()): Range {
	const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' });
	const today = fmt.format(now);
	const midnight = (d: string) => {
		const guess = new Date(`${d}T00:00:00Z`);
		const off = Number(
			/GMT([+-]\d+)/.exec(
				new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', timeZoneName: 'shortOffset' }).format(guess)
			)?.[1] ?? 0
		);
		return new Date(guess.getTime() - off * 3600_000);
	};
	const to = midnight(today);
	return { from: midnight(fmt.format(new Date(to.getTime() - 12 * 3600_000))), to };
}

export async function sendDailyReport(
	deps: { db: Executor; email: EmailAdapter; to: string; siteUrl: string },
	now = new Date()
) {
	const r = yesterdayRange(now);
	const s = await summary(deps.db, r);
	const [{ n: queue }] = await deps.db
		.select({ n: sql<number>`count(*)::int` })
		.from(orders)
		.where(eq(orders.status, 'paid'));
	const [{ n: low }] = await deps.db
		.select({ n: sql<number>`count(*)::int` })
		.from(variants)
		.innerJoin(products, eq(products.id, variants.productId))
		.where(and(lte(variants.stock, variants.lowStockThreshold), eq(products.status, 'active')));
	const day = new Intl.DateTimeFormat('nl-BE', {
		timeZone: 'Europe/Brussels',
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).format(r.from);
	const rows = [
		['Bestellingen', String(s.orders)],
		['Netto-omzet (incl. btw)', formatPrice(s.net)],
		['Gem. orderwaarde', formatPrice(s.aov)],
		['Te verwerken', String(queue)],
		['Varianten met lage voorraad', String(low)]
	];
	const html = `<div style="font-family:Arial,sans-serif;color:#492520;max-width:520px"><h1 style="font-family:Georgia,serif;font-weight:400;color:#391617">Dagrapport — ${day}</h1><table style="border-collapse:collapse;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e4d9cf">${k}</td><td style="padding:8px 0;border-bottom:1px solid #e4d9cf;text-align:right"><strong>${v}</strong></td></tr>`).join('')}</table><p><a href="${deps.siteUrl.replace(/\/$/, '')}/admin" style="color:#875543">Open het beheer</a></p></div>`;
	const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
	let status = 'sent';
	let providerId: string | null = null;
	try {
		providerId = (
			await deps.email.send({ to: deps.to, subject: `Dagrapport ${day}`, html, text, template: 'daily-report' })
		).id;
	} catch {
		status = 'failed';
	}
	await deps.db
		.insert(emailLog)
		.values({ to: deps.to, template: 'daily-report', locale: 'nl', subject: `Dagrapport ${day}`, providerId, status });
	return { ...s, queue, low };
}
