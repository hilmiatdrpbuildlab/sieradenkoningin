import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { audit } from '#lib/server/services/audit.ts';
import {
	ORDER_SORTS,
	ORDER_STATUSES,
	PAYMENT_STATUSES,
	createLabel,
	listOrders,
	markProcessing,
	type OrderSort
} from '#lib/server/services/fulfilment.ts';
import { uuid } from '#lib/schemas/order-admin.ts';
import type { OrderStatus, PaymentStatus } from '#lib/types.ts';

const pick = <T extends string>(v: string | null, list: readonly T[]) =>
	v && (list as readonly string[]).includes(v) ? (v as T) : undefined;
const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

export const load: PageServerLoad = async ({ locals, url }) => {
	const admin = requirePermission(locals, 'orders:read');
	const sp = url.searchParams;
	const filters = {
		q: sp.get('q')?.trim().slice(0, 100) ?? '',
		status: (pick<OrderStatus>(sp.get('status'), ORDER_STATUSES) ?? '') as OrderStatus | '',
		payment: (pick<PaymentStatus>(sp.get('payment'), PAYMENT_STATUSES) ?? '') as PaymentStatus | '',
		from: day(sp.get('from')),
		to: day(sp.get('to'))
	};
	const r = await listOrders(locals.db, {
		q: filters.q || undefined,
		status: filters.status || undefined,
		payment: filters.payment || undefined,
		from: filters.from || undefined,
		to: filters.to || undefined,
		sort: pick<OrderSort>(sp.get('sort'), ORDER_SORTS) ?? 'placed',
		dir: sp.get('dir') === 'asc' ? 'asc' : 'desc',
		page: Math.max(1, Number(sp.get('page')) || 1)
	});
	return {
		...r,
		filters,
		canFulfil: can(admin.role, 'orders:fulfil'),
		crumbs: [{ label: 'Bestellingen' }]
	};
};

const selectedIds = (fd: FormData) =>
	[...new Set(fd.getAll('id').filter((v): v is string => typeof v === 'string' && uuid.safeParse(v).success))].slice(
		0,
		100
	);

export const actions: Actions = {
	/** Bulk "In behandeling" (paid → processing). */
	processing: async ({ request, locals }) => {
		const admin = requirePermission(locals, 'orders:fulfil');
		const ids = selectedIds(await request.formData());
		if (!ids.length) return fail(400, { bulkError: 'Selecteer minstens één bestelling.' });
		const changed = await markProcessing(locals.db, ids, admin);
		if (changed.length)
			await audit(locals.db, locals, {
				action: 'order.processing',
				entity: 'order',
				entityId: changed.length === 1 ? changed[0] : null,
				diff: { ids: changed }
			});
		return { bulk: { action: 'processing', changed: changed.length, skipped: ids.length - changed.length } };
	},
	/** Bulk "Label aanmaken": one label per order (idempotent), then one combined PDF to print. */
	labels: async ({ request, locals }) => {
		const admin = requirePermission(locals, 'orders:fulfil');
		const ids = selectedIds(await request.formData());
		if (!ids.length) return fail(400, { bulkError: 'Selecteer minstens één bestelling.' });
		const shipmentIds: string[] = [];
		const errors: string[] = [];
		for (const id of ids) {
			try {
				const { shipment, created } = await createLabel(
					{ db: locals.db, shipping: locals.shipping, storage: locals.storage },
					id,
					admin
				);
				shipmentIds.push(shipment.id);
				if (created)
					await audit(locals.db, locals, {
						action: 'order.label',
						entity: 'order',
						entityId: id,
						diff: { shipmentId: shipment.id, tracking: shipment.trackingNumber }
					});
			} catch (err) {
				errors.push(err instanceof Error ? err.message : String(err));
			}
		}
		return { bulk: { action: 'labels', changed: shipmentIds.length, skipped: errors.length, errors, shipmentIds } };
	}
};
