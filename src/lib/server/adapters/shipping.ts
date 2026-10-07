/**
 * Shipping adapter (decision D2: Sendcloud).
 * - `sendcloud`: Sendcloud Panel API v2 (parcels + labels) and Service Points API.
 * - `mock`: fake service points, a generated PDF label and a fake tracking number.
 * Webhooks are verified with HMAC-SHA256 of the raw body using the secret key
 * (`Sendcloud-Signature` header).
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { Address, ServicePoint } from '../db/schema.ts';
import { hmacHex, safeEqual } from '../crypto.ts';

export interface LabelInput {
	orderNumber: string;
	address: Address;
	email: string;
	method: 'home' | 'pickup';
	servicePoint?: ServicePoint | null;
	weightGrams: number;
}

export interface Label {
	providerRef: string;
	carrier: string;
	trackingNumber: string;
	trackingUrl: string;
	labelPdf: Uint8Array;
}

export type TrackingStatus = 'shipped' | 'delivered' | 'exception';

export interface ShippingAdapter {
	provider: 'sendcloud' | 'mock';
	servicePoints(postalCode: string, country: string): Promise<ServicePoint[]>;
	createLabel(input: LabelInput): Promise<Label>;
	verifyWebhook(rawBody: string, signature: string | null): Promise<boolean>;
	parseWebhook(body: unknown): { providerRef: string; status: TrackingStatus } | null;
}

/** Sendcloud parcel status ids → our shipment status. */
export function mapSendcloudStatus(id: number): TrackingStatus | null {
	if (id === 11) return 'delivered';
	if ([3, 4, 5, 6, 7, 12, 22, 91, 92].includes(id)) return 'shipped';
	if ([80, 1999, 2000, 62990, 62991, 62992].includes(id)) return 'exception';
	return null;
}

export function createShipping(publicKey: string, secretKey: string): ShippingAdapter {
	if (!publicKey || !secretKey) return createMockShipping();
	const auth = 'Basic ' + btoa(`${publicKey}:${secretKey}`);
	const api = async (url: string, init: RequestInit = {}) => {
		const res = await fetch(url, { ...init, headers: { authorization: auth, 'content-type': 'application/json', ...init.headers } });
		if (!res.ok) throw new Error(`Sendcloud ${url} → ${res.status}: ${await res.text()}`);
		return res;
	};
	return {
		provider: 'sendcloud',
		async servicePoints(postalCode, country) {
			const url = `https://servicepoints.sendcloud.sc/api/v2/service-points?country=${country}&postal_code=${encodeURIComponent(postalCode)}&carrier=bpost&radius=5000`;
			const list = (await (await api(url)).json()) as Record<string, any>[];
			return list.slice(0, 10).map((p) => ({
				id: String(p.id),
				name: p.name,
				street: `${p.street} ${p.house_number ?? ''}`.trim(),
				postalCode: p.postal_code,
				city: p.city,
				carrier: p.carrier
			}));
		},
		async createLabel(input) {
			const body = {
				parcel: {
					name: input.address.name,
					company_name: input.address.company ?? '',
					address: input.address.line1,
					address_2: input.address.line2 ?? '',
					postal_code: input.address.postalCode,
					city: input.address.city,
					country: input.address.country,
					telephone: input.address.phone ?? '',
					email: input.email,
					order_number: input.orderNumber,
					weight: (input.weightGrams / 1000).toFixed(3),
					request_label: true,
					to_service_point: input.servicePoint ? Number(input.servicePoint.id) : undefined,
					shipment: { id: 8 } // unstamped letter fallback; real shipping method id configured in Sendcloud
				}
			};
			const parcel = ((await (await api('https://panel.sendcloud.sc/api/v2/parcels', { method: 'POST', body: JSON.stringify(body) })).json()) as any).parcel;
			const pdf = await api(parcel.label.label_printer ?? parcel.label.normal_printer[0]);
			return {
				providerRef: String(parcel.id),
				carrier: parcel.carrier?.code ?? 'bpost',
				trackingNumber: parcel.tracking_number,
				trackingUrl: parcel.tracking_url,
				labelPdf: new Uint8Array(await pdf.arrayBuffer())
			};
		},
		async verifyWebhook(rawBody, signature) {
			if (!signature) return false;
			return safeEqual(await hmacHex(secretKey, rawBody), signature);
		},
		parseWebhook(body) {
			const b = body as { action?: string; parcel?: { id: number; status?: { id: number } } };
			if (b?.action !== 'parcel_status_changed' || !b.parcel?.status) return null;
			const status = mapSendcloudStatus(b.parcel.status.id);
			return status ? { providerRef: String(b.parcel.id), status } : null;
		}
	};
}

const MOCK_SECRET = 'mock-sendcloud-secret';

function createMockShipping(): ShippingAdapter {
	return {
		provider: 'mock',
		async servicePoints(postalCode) {
			const pc = postalCode.replace(/\D/g, '').slice(0, 4) || '1000';
			return [
				{ id: `${pc}01`, name: 'DEMO bpost punt — Krantenwinkel', street: 'Marktplein 1', postalCode: pc, city: 'Demostad', carrier: 'bpost' },
				{ id: `${pc}02`, name: 'DEMO Pakjesautomaat Station', street: 'Stationsstraat 12', postalCode: pc, city: 'Demostad', carrier: 'bpost' },
				{ id: `${pc}03`, name: 'DEMO Postkantoor', street: 'Kerkstraat 8', postalCode: pc, city: 'Demostad', carrier: 'bpost' }
			];
		},
		async createLabel(input) {
			const trackingNumber = `DEMO${Date.now().toString().slice(-10)}`;
			const doc = await PDFDocument.create();
			const page = doc.addPage([288, 432]); // 4×6 inch label
			const font = await doc.embedFont(StandardFonts.Helvetica);
			const lines = [
				'DEMO LABEL — not a real shipment',
				`Order ${input.orderNumber}`,
				input.address.name,
				input.address.line1,
				`${input.address.postalCode} ${input.address.city}`,
				input.address.country,
				input.servicePoint ? `Pickup: ${input.servicePoint.name}` : 'Home delivery',
				`Tracking ${trackingNumber}`
			];
			lines.forEach((t, i) => page.drawText(t, { x: 20, y: 400 - i * 22, size: i === 0 ? 11 : 13, font }));
			return {
				providerRef: `mockparcel_${crypto.randomUUID().slice(0, 8)}`,
				carrier: 'bpost',
				trackingNumber,
				trackingUrl: `https://track.bpost.cloud/btr/web/#/search?itemCode=${trackingNumber}`,
				labelPdf: await doc.save()
			};
		},
		async verifyWebhook(rawBody, signature) {
			return !!signature && safeEqual(await hmacHex(MOCK_SECRET, rawBody), signature);
		},
		parseWebhook(body) {
			const b = body as { action?: string; parcel?: { id: string | number; status?: { id: number } } };
			if (b?.action !== 'parcel_status_changed' || !b.parcel?.status) return null;
			const status = mapSendcloudStatus(b.parcel.status.id);
			return status ? { providerRef: String(b.parcel.id), status } : null;
		}
	};
}

/** Lets e2e tests sign a mock webhook. */
export const mockWebhookSignature = (rawBody: string) => hmacHex(MOCK_SECRET, rawBody);
