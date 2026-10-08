/** Dutch admin labels for order / payment / shipment states (P2-09). */
import type { OrderStatus, PaymentStatus } from '#lib/types.ts';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	pending: 'In afwachting',
	paid: 'Betaald',
	processing: 'In behandeling',
	shipped: 'Verzonden',
	delivered: 'Geleverd',
	cancelled: 'Geannuleerd',
	refunded: 'Terugbetaald'
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	open: 'Open',
	paid: 'Betaald',
	failed: 'Mislukt',
	canceled: 'Afgebroken',
	expired: 'Verlopen',
	partially_refunded: 'Deels terugbetaald',
	refunded: 'Terugbetaald'
};

export const PAYMENT_TONES: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
	open: 'warning',
	paid: 'success',
	failed: 'danger',
	canceled: 'neutral',
	expired: 'neutral',
	partially_refunded: 'info',
	refunded: 'info'
};

export const SHIPMENT_LABELS: Record<string, string> = {
	created: 'Label aangemaakt',
	shipped: 'Onderweg',
	delivered: 'Geleverd',
	exception: 'Probleem bij levering'
};

export const METHOD_LABELS: Record<string, string> = {
	bancontact: 'Bancontact',
	creditcard: 'Kredietkaart',
	applepay: 'Apple Pay',
	googlepay: 'Google Pay',
	kbc: 'KBC/CBC',
	belfius: 'Belfius'
};
