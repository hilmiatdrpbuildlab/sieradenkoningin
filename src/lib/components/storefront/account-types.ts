/** Customer-facing order view types (account area P3-02, order tracking P3-04). */

export type TimelineStepKey = 'placed' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface TimelineStep {
	key: TimelineStepKey;
	state: 'done' | 'current' | 'upcoming';
	/** ISO timestamp when known. */
	at: string | null;
}

export interface ShipmentView {
	carrier: string;
	trackingNumber: string | null;
	trackingUrl: string | null;
	status: string;
}

export type CustomerOrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface AddressView {
	name: string;
	company?: string;
	line1: string;
	line2?: string;
	postalCode: string;
	city: string;
	country: string;
	phone?: string;
}
