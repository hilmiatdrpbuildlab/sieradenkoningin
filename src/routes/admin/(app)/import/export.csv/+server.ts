import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/services/audit.ts';
import { exportCsv } from '#lib/server/services/import.ts';

export const GET: RequestHandler = async ({ locals }) => {
	requirePermission(locals, 'catalog:read');
	requirePermission(locals, 'inventory:read');
	const csv = await exportCsv(locals.db);
	await audit(locals.db, locals, { action: 'export', entity: 'product', entityId: null, diff: { bytes: csv.length } });
	const date = new Date().toISOString().slice(0, 10);
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="sieradenkoningin-producten-${date}.csv"`,
			'cache-control': 'private, no-store'
		}
	});
};
