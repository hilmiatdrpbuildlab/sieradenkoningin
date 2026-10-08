/** Localized labels for the account area: field error keys (schemas/account.ts), order statuses, steps. */
import { m } from '#lib/paraglide/messages.js';
import type { TimelineStepKey } from './account-types.ts';

const ERRORS: Record<string, () => string> = {
	required: () => m.acct_err_required(),
	email: () => m.acct_err_email(),
	password_short: () => m.acct_err_password_short({ min: 10 }),
	password_long: () => m.acct_err_password_long(),
	password_mismatch: () => m.acct_err_password_mismatch(),
	too_long: () => m.acct_err_too_long(),
	phone: () => m.acct_err_phone(),
	postal: () => m.acct_err_postal(),
	order_number: () => m.acct_err_order_number(),
	confirm_delete: () => m.acct_err_confirm_delete(),
	wrong_password: () => m.acct_err_wrong_password()
};

/** First error of a field as text (keys from the zod schemas → messages). */
export function errText(errors: Record<string, string[] | undefined> | null | undefined, field: string): string | undefined {
	const key = errors?.[field]?.[0];
	if (!key) return undefined;
	return (ERRORS[key] ?? (() => m.acct_err_generic()))();
}

export function statusLabel(status: string): string {
	switch (status) {
		case 'pending':
			return m.acct_status_pending();
		case 'paid':
			return m.acct_status_paid();
		case 'processing':
			return m.acct_status_processing();
		case 'shipped':
			return m.acct_status_shipped();
		case 'delivered':
			return m.acct_status_delivered();
		case 'cancelled':
			return m.acct_status_cancelled();
		case 'refunded':
			return m.acct_status_refunded();
		default:
			return status;
	}
}

export function stepLabel(key: TimelineStepKey): string {
	switch (key) {
		case 'placed':
			return m.acct_step_placed();
		case 'paid':
			return m.acct_step_paid();
		case 'processing':
			return m.acct_step_processing();
		case 'shipped':
			return m.acct_step_shipped();
		case 'delivered':
			return m.acct_step_delivered();
		case 'cancelled':
			return m.acct_step_cancelled();
		case 'refunded':
			return m.acct_step_refunded();
	}
}
