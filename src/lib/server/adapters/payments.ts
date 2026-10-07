/**
 * Payments adapter (decision D1: Mollie).
 * - `mollie`: Mollie Payments API v2 over fetch.
 * - `mock`: no network; the hosted "checkout" is our own `/checkout/pay/mock` page with
 *   "simulate paid / failed / canceled" buttons (dev, e2e, previews).
 *
 * The webhook NEVER trusts the request body: it only receives an id and fetches the payment
 * from the provider via `getPayment()` (see routes/api/webhooks/mollie).
 */
import { eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { payments } from '../db/schema.ts';

export type ProviderPaymentStatus = 'open' | 'pending' | 'authorized' | 'paid' | 'failed' | 'canceled' | 'expired';

export interface CreatePaymentInput {
	orderNumber: string;
	amount: number; // cents
	description: string;
	redirectUrl: string;
	webhookUrl: string;
	locale: 'nl' | 'fr';
	method?: string;
	metadata?: Record<string, string>;
}

export interface ProviderPayment {
	id: string;
	status: ProviderPaymentStatus;
	amount: number;
	amountRefunded: number;
	method: string | null;
	checkoutUrl: string | null;
	raw: unknown;
}

export interface PaymentsAdapter {
	provider: 'mollie' | 'mock';
	createPayment(input: CreatePaymentInput): Promise<ProviderPayment>;
	getPayment(id: string): Promise<ProviderPayment | null>;
	createRefund(paymentId: string, amount: number, description: string): Promise<{ id: string; status: string }>;
}

/** Methods offered at checkout, Bancontact first (Belgium). Values are Mollie method ids. */
export const PAYMENT_METHODS = ['bancontact', 'creditcard', 'applepay', 'googlepay', 'kbc', 'belfius'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const toMoney = (cents: number) => ({ currency: 'EUR', value: (cents / 100).toFixed(2) });
const fromMoney = (m: { value: string } | undefined) => (m ? Math.round(Number(m.value) * 100) : 0);

export function createPayments(apiKey: string, db: Executor): PaymentsAdapter {
	if (!apiKey) return createMockPayments(db);
	const api = async (path: string, init: RequestInit = {}) => {
		const res = await fetch(`https://api.mollie.com/v2${path}`, {
			...init,
			headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...init.headers }
		});
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`Mollie ${path} → ${res.status}: ${await res.text()}`);
		return res.json() as Promise<Record<string, any>>;
	};
	const map = (p: Record<string, any>): ProviderPayment => ({
		id: p.id,
		status: p.status,
		amount: fromMoney(p.amount),
		amountRefunded: fromMoney(p.amountRefunded),
		method: p.method ?? null,
		checkoutUrl: p._links?.checkout?.href ?? null,
		raw: p
	});
	return {
		provider: 'mollie',
		async createPayment(input) {
			const p = await api('/payments', {
				method: 'POST',
				body: JSON.stringify({
					amount: toMoney(input.amount),
					description: input.description,
					redirectUrl: input.redirectUrl,
					webhookUrl: input.webhookUrl,
					locale: input.locale === 'fr' ? 'fr_BE' : 'nl_BE',
					method: input.method,
					metadata: { orderNumber: input.orderNumber, ...input.metadata }
				})
			});
			return map(p!);
		},
		async getPayment(id) {
			if (!/^tr_[A-Za-z0-9]+$/.test(id)) return null;
			const p = await api(`/payments/${id}`);
			return p ? map(p) : null;
		},
		async createRefund(paymentId, amount, description) {
			const r = await api(`/payments/${paymentId}/refunds`, {
				method: 'POST',
				body: JSON.stringify({ amount: toMoney(amount), description })
			});
			return { id: r!.id as string, status: r!.status as string };
		}
	};
}

/** Mock provider: the payment's simulated state lives in `payments.raw.mock`. */
function createMockPayments(db: Executor): PaymentsAdapter {
	return {
		provider: 'mock',
		async createPayment(input) {
			const id = `mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
			const lang = input.locale;
			const pay = lang === 'fr' ? 'paiement' : 'betalen';
			return {
				id,
				status: 'open',
				amount: input.amount,
				amountRefunded: 0,
				method: input.method ?? null,
				checkoutUrl: `/${lang}/${pay}/mock?id=${id}`,
				raw: { mock: { status: 'open', refunded: 0 }, redirectUrl: input.redirectUrl, webhookUrl: input.webhookUrl }
			};
		},
		async getPayment(id) {
			if (!/^mock_[a-z0-9]+$/.test(id)) return null;
			const [row] = await db.select().from(payments).where(eq(payments.providerRef, id));
			if (!row) return null;
			const mock = (row.raw as { mock?: { status: ProviderPaymentStatus; refunded?: number } })?.mock;
			return {
				id,
				status: mock?.status ?? 'open',
				amount: row.amount,
				amountRefunded: mock?.refunded ?? 0,
				method: row.method,
				checkoutUrl: row.checkoutUrl,
				raw: row.raw
			};
		},
		async createRefund(paymentId, amount) {
			const [row] = await db.select().from(payments).where(eq(payments.providerRef, paymentId));
			if (!row) throw new Error('Unknown mock payment');
			const raw = (row.raw ?? {}) as { mock?: { status: string; refunded?: number } };
			const mock = { status: raw.mock?.status ?? 'paid', refunded: (raw.mock?.refunded ?? 0) + amount };
			await db
				.update(payments)
				.set({ raw: { ...raw, mock } })
				.where(eq(payments.id, row.id));
			return { id: `re_mock_${crypto.randomUUID().slice(0, 8)}`, status: 'refunded' };
		}
	};
}
