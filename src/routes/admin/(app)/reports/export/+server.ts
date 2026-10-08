/** CSV export for reports: ?type=days|categories|products|vat|discounts&from=&to= */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { byCategory, byDay, csvMoney, discountPerformance, toCsv, topProducts, vatByMonth } from '#lib/server/services/reports.ts';
import { parseRange } from '#lib/server/services/report-range.ts';
import { audit } from '#lib/server/services/audit.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, 'reports');
	const { range, from, to } = parseRange(url);
	const type = url.searchParams.get('type') ?? 'days';
	const db = locals.db;
	let csv: string;
	switch (type) {
		case 'days':
			csv = toCsv(
				(await byDay(db, range)).map((d) => ({ ...d, gross: csvMoney(d.gross), net: csvMoney(d.net) })),
				[{ key: 'day', label: 'Datum' }, { key: 'orders', label: 'Bestellingen' }, { key: 'gross', label: 'Bruto (incl. btw)' }, { key: 'net', label: 'Netto na terugbetalingen' }]
			);
			break;
		case 'categories':
			csv = toCsv(
				(await byCategory(db, range)).map((c) => ({ name: c.name?.nl ?? '', units: c.units, revenue: csvMoney(c.revenue) })),
				[{ key: 'name', label: 'Categorie' }, { key: 'units', label: 'Stuks' }, { key: 'revenue', label: 'Omzet (incl. btw)' }]
			);
			break;
		case 'products':
			csv = toCsv(
				(await topProducts(db, range, 1000)).map((p) => ({ name: p.name?.nl ?? '', units: p.units, revenue: csvMoney(p.revenue) })),
				[{ key: 'name', label: 'Product' }, { key: 'units', label: 'Stuks' }, { key: 'revenue', label: 'Omzet (incl. btw)' }]
			);
			break;
		case 'vat':
			csv = toCsv(
				(await vatByMonth(db, range)).map((v) => ({ month: v.month, orders: v.orders, gross: csvMoney(v.gross), vat: csvMoney(v.vat), net: csvMoney(v.netExVat), refunded: csvMoney(v.refunded) })),
				[
					{ key: 'month', label: 'Maand' },
					{ key: 'orders', label: 'Bestellingen' },
					{ key: 'gross', label: 'Omzet incl. btw' },
					{ key: 'vat', label: 'Btw 21%' },
					{ key: 'net', label: 'Omzet excl. btw' },
					{ key: 'refunded', label: 'Terugbetaald (incl. btw)' }
				]
			);
			break;
		case 'discounts':
			csv = toCsv(
				(await discountPerformance(db, range)).map((d) => ({ ...d, discount: csvMoney(d.discount), revenue: csvMoney(d.revenue) })),
				[{ key: 'code', label: 'Code' }, { key: 'type', label: 'Type' }, { key: 'uses', label: 'Gebruikt' }, { key: 'discount', label: 'Korting' }, { key: 'revenue', label: 'Omzet' }]
			);
			break;
		default:
			error(400, 'Onbekend rapport');
	}
	await audit(db, locals, { action: 'export', entity: 'report', entityId: type, diff: { from, to } });
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="sieradenkoningin-${type}-${from}_${to}.csv"`,
			'cache-control': 'private, no-store'
		}
	});
};
