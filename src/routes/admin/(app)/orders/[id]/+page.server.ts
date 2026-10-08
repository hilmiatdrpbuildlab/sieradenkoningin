import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { audit } from '#lib/server/services/audit.ts';
import {
	FulfilmentError,
	TRANSITIONS,
	addNote,
	cancelOrder,
	createLabel,
	getOrderDetail,
	markDelivered,
	markProcessing,
	markShipped
} from '#lib/server/services/fulfilment.ts';
import { RefundError, createRefund, lineRefundAmount, refundable } from '#lib/server/services/refunds.ts';
import { generateInvoice } from '#lib/server/services/invoices.ts';
import { runJobs } from '#lib/server/jobs/index.ts';
import { noteForm, refundForm, refundFormInput, shipForm, statusForm, uuid } from '#lib/schemas/order-admin.ts';
import { fieldErrors } from '#lib/schemas/common.ts';

const CAPTURED = ['paid', 'partially_refunded', 'refunded'];

export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = requirePermission(locals, 'orders:read');
	const d = await getOrderDetail(locals.db, params.id);
	if (!d) error(404, 'Bestelling niet gevonden');
	const captured = d.payments.find((p) => CAPTURED.includes(p.status)) ?? null;
	const { accessToken: _t, ...order } = d.order;
	return {
		...d,
		order,
		lines: d.lines.map((l) => ({
			...l,
			refundableQty: l.qty - l.refundedQty,
			/** Amount for refunding ONE more unit (UI hint; the server recomputes). */
			unitRefund: l.qty > l.refundedQty ? lineRefundAmount(l, 1) : 0
		})),
		captured: captured?.amount ?? 0,
		refundable: captured ? refundable(captured.amount, d.order.refundedTotal) : 0,
		transitions: TRANSITIONS[d.order.status],
		can: {
			fulfil: can(admin.role, 'orders:fulfil'),
			refund: can(admin.role, 'orders:refund'),
			customers: can(admin.role, 'customers:read')
		},
		crumbs: [{ label: 'Bestellingen', href: '/admin/orders' }, { label: d.order.number }]
	};
};

/** Runs the jobs a transition queued (emails, invoice) right away; the cron retries on failure. */
async function runInline(event: RequestEvent, ids: string[]) {
	if (!ids.length) return;
	const { locals, url } = event;
	try {
		await runJobs(
			{ db: locals.db, email: locals.email, siteUrl: url.origin, payments: locals.payments, storage: locals.storage },
			{ ids }
		);
	} catch (err) {
		console.error('[orders] inline jobs failed', err);
	}
}

const orderId = (id: string) => {
	if (!uuid.safeParse(id).success) error(404, 'Bestelling niet gevonden');
	return id;
};

const fulfilmentFail = (err: unknown) => {
	if (err instanceof FulfilmentError || err instanceof RefundError) return fail(400, { actionError: err.message });
	throw err;
};

export const actions: Actions = {
	status: async (event) => {
		const { request, locals, params } = event;
		const admin = requirePermission(locals, 'orders:fulfil');
		const id = orderId(params.id);
		const parsed = statusForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { actionError: 'Ongeldige status.' });
		const { to, reason } = parsed.data;
		try {
			if (to === 'processing') {
				const changed = await markProcessing(locals.db, [id], admin);
				if (!changed.length)
					return fail(400, { actionError: 'Alleen betaalde bestellingen kunnen in behandeling genomen worden.' });
				await audit(locals.db, locals, {
					action: 'order.processing',
					entity: 'order',
					entityId: id,
					diff: { status: ['paid', 'processing'] }
				});
			} else if (to === 'delivered') {
				const r = await markDelivered(locals.db, id, admin);
				await audit(locals.db, locals, {
					action: 'order.delivered',
					entity: 'order',
					entityId: id,
					diff: { status: [r.from, 'delivered'] }
				});
			} else {
				const r = await cancelOrder(locals.db, id, admin, reason);
				await audit(locals.db, locals, {
					action: 'order.cancel',
					entity: 'order',
					entityId: id,
					diff: { status: [r.from, 'cancelled'], reason: reason || null, restocked: r.restocked }
				});
				return {
					done: r.needsRefund
						? 'Bestelling geannuleerd. Vergeet niet het bedrag terug te betalen.'
						: 'Bestelling geannuleerd.'
				};
			}
		} catch (err) {
			return fulfilmentFail(err);
		}
		return { done: 'Status bijgewerkt.' };
	},

	label: async ({ locals, params }) => {
		const admin = requirePermission(locals, 'orders:fulfil');
		const id = orderId(params.id);
		try {
			const { shipment, created } = await createLabel(
				{ db: locals.db, shipping: locals.shipping, storage: locals.storage },
				id,
				admin
			);
			if (created)
				await audit(locals.db, locals, {
					action: 'order.label',
					entity: 'order',
					entityId: id,
					diff: { shipmentId: shipment.id, tracking: shipment.trackingNumber }
				});
			return {
				done: created ? 'Label aangemaakt.' : 'Er bestond al een label voor deze bestelling.',
				shipmentId: shipment.id
			};
		} catch (err) {
			if (err instanceof FulfilmentError) return fail(400, { actionError: err.message });
			console.error('[orders] label failed', err);
			return fail(502, {
				actionError: 'Het label kon niet aangemaakt worden bij de vervoerder. Probeer het later opnieuw.'
			});
		}
	},

	ship: async (event) => {
		const { request, locals, params } = event;
		const admin = requirePermission(locals, 'orders:fulfil');
		const id = orderId(params.id);
		const parsed = shipForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { shipErrors: fieldErrors(parsed.error) });
		try {
			const jobs = await markShipped(locals.db, id, admin, parsed.data);
			await audit(locals.db, locals, {
				action: 'order.shipped',
				entity: 'order',
				entityId: id,
				diff: { status: [null, 'shipped'], ...parsed.data }
			});
			await runInline(event, jobs);
		} catch (err) {
			return fulfilmentFail(err);
		}
		return { done: 'Gemarkeerd als verzonden. De klant krijgt een e-mail met track & trace.' };
	},

	note: async ({ request, locals, params }) => {
		const admin = requirePermission(locals, 'orders:fulfil');
		const id = orderId(params.id);
		const parsed = noteForm.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { noteErrors: fieldErrors(parsed.error) });
		await addNote(locals.db, id, admin, parsed.data.text);
		await audit(locals.db, locals, { action: 'order.note', entity: 'order', entityId: id });
		return { done: 'Notitie toegevoegd.', noteSaved: true };
	},

	refund: async (event) => {
		const { request, locals, params } = event;
		const admin = requirePermission(locals, 'orders:refund');
		const id = orderId(params.id);
		const raw = refundFormInput(await request.formData());
		const parsed = refundForm.safeParse(raw);
		if (!parsed.success) return fail(400, { refundErrors: fieldErrors(parsed.error), refundValues: raw });
		const v = parsed.data;
		try {
			const r = await createRefund(
				{ db: locals.db, payments: locals.payments },
				id,
				v.mode === 'amount'
					? { mode: 'amount', amount: v.amount!, reason: v.reason, restock: v.restock }
					: { mode: 'lines', lines: v.lines, shipping: v.shipping, reason: v.reason, restock: v.restock },
				admin
			);
			await audit(locals.db, locals, {
				action: 'order.refund',
				entity: 'order',
				entityId: id,
				diff: { refundId: r.refundId, amount: r.amount, full: r.full, restocked: r.restocked, reason: v.reason || null }
			});
			await runInline(event, r.jobIds);
			return { done: r.full ? 'Bestelling volledig terugbetaald.' : 'Gedeeltelijke terugbetaling uitgevoerd.' };
		} catch (err) {
			if (err instanceof RefundError) return fail(400, { refundError: err.message, refundValues: raw });
			throw err;
		}
	},

	invoice: async ({ locals, params }) => {
		requirePermission(locals, 'orders:fulfil');
		const id = orderId(params.id);
		try {
			const r = await generateInvoice({ db: locals.db, storage: locals.storage }, id);
			await audit(locals.db, locals, {
				action: 'order.invoice',
				entity: 'order',
				entityId: id,
				diff: { invoiceNumber: r.invoiceNumber }
			});
			return { done: `Factuur ${r.invoiceNumber} (opnieuw) aangemaakt.` };
		} catch (err) {
			console.error('[orders] invoice failed', err);
			return fail(400, { actionError: 'De factuur kon niet aangemaakt worden (is de bestelling betaald?).' });
		}
	}
};
