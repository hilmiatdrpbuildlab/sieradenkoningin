import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { templateCsv } from '#lib/server/services/import.ts';

export const GET: RequestHandler = async ({ locals }) => {
	requirePermission(locals, 'catalog:write');
	return new Response(templateCsv(), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="sieradenkoningin-import-sjabloon.csv"',
			'cache-control': 'private, no-store'
		}
	});
};
