/** Combined label PDF for bulk printing: GET /admin/orders/labels?s=<shipmentId>&s=… (max 100). */
import { error } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import type { RequestHandler } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { shipments } from '#lib/server/db/schema.ts';
import { uuid } from '#lib/schemas/order-admin.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, 'orders:read');
	const ids = [...new Set(url.searchParams.getAll('s'))].filter((s) => uuid.safeParse(s).success).slice(0, 100);
	if (!ids.length) error(400, 'Geen labels gekozen');
	const rows = await locals.db.select().from(shipments).where(inArray(shipments.id, ids));
	const out = await PDFDocument.create();
	for (const id of ids) {
		const s = rows.find((r) => r.id === id);
		if (!s?.labelKey) continue;
		const obj = await locals.storage.get(s.labelKey);
		if (!obj) continue;
		const src = await PDFDocument.load(obj.body);
		for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
	}
	if (!out.getPageCount()) error(404, 'Geen labels gevonden');
	return new Response(new Blob([new Uint8Array(await out.save())]), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="labels-${new Date().toISOString().slice(0, 10)}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
