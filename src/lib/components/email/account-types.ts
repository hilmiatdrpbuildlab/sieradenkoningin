/** Data for the customer-account emails (P3-01) and the back-in-stock alert (P3-09). */

export type AccountEmailKind = 'verify' | 'login' | 'reset' | 'exists';

export interface AccountEmailData {
	kind: AccountEmailKind;
	firstName: string | null;
	/** Main call-to-action (verify / login / reset link, or the login page for `exists`). */
	url: string;
	/** `exists` only: link to "forgot password". */
	secondaryUrl?: string | null;
	shopUrl: string;
	storeName: string;
	storeEmail: string | null;
}

export interface BackInStockEmailData {
	productName: string;
	variantLabel: string;
	productUrl: string;
	shopUrl: string;
	storeName: string;
	storeEmail: string | null;
}
