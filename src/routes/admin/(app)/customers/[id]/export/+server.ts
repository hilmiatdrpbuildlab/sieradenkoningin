/** GDPR data export for a customer (owner only), downloaded as JSON. */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { exportCustomerData } from '#lib/server/services/customers.ts';
import { audit } from '#lib/server/services/audit.ts';

export const GET: RequestHandler = async ({ locals, params }) => {
	const admin = requirePermission(locals, 'customers:read');
	if (admin.role !== 'owner') error(403, 'Alleen de eigenaar kan klantgegevens exporteren.');
	const data = await exportCustomerData(locals.db, params.id);
	if (!data) error(404);
	await audit(locals.db, locals, { action: 'gdpr_export', entity: 'customer', entityId: params.id });
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="klantgegevens-${params.id.slice(0, 8)}.json"`,
			'cache-control': 'private, no-store'
		}
	});
};
