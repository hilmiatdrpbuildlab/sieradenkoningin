/**
 * Typed access to the `settings` key/value table with safe defaults.
 * Defaults follow the decision register: D3 (BE only), D4 (14-day returns), D9 (€50 free-shipping
 * threshold, placeholder rates). Store/legal identity fields are EMPTY on purpose — the owner fills
 * them in /admin/settings/store; we never invent company data.
 */
import { inArray } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { settings } from '../db/schema.ts';
import type { I18n } from '../db/schema.ts';

export interface StoreSettings {
	name: string;
	legalName: string;
	street: string;
	postalCode: string;
	city: string;
	country: string;
	kbo: string;
	vat: string;
	email: string;
	phone: string;
}

export interface Settings {
	store: StoreSettings;
	shipping: { freeFrom: number; cutoffHour: number; deliveryDays: number; shipToCountries: string[] };
	return_days: number;
	maintenance: { enabled: boolean; message?: I18n; bypassToken?: string };
	announcement: { text: I18n; href?: string; from?: string | null; until?: string | null } | null;
	popular_searches: I18n[];
	payments: { methods: string[] };
	emails: { replyTo: string; bccOrders: boolean };
	analytics: { plausible: boolean; ga4: boolean };
	legal: Record<string, { body: I18n; reviewed: boolean }>;
}

export const DEFAULT_SETTINGS: Settings = {
	store: {
		name: 'Sieradenkoningin',
		legalName: '',
		street: '',
		postalCode: '',
		city: '',
		country: 'BE',
		kbo: '',
		vat: '',
		email: '',
		phone: ''
	},
	shipping: { freeFrom: 5000, cutoffHour: 16, deliveryDays: 1, shipToCountries: ['BE'] },
	return_days: 14,
	maintenance: { enabled: false },
	announcement: null,
	popular_searches: [
		{ nl: 'klaver', fr: 'trèfle' },
		{ nl: 'ring', fr: 'bague' },
		{ nl: 'ketting', fr: 'collier' },
		{ nl: 'oorbellen', fr: "boucles d'oreilles" }
	],
	payments: { methods: ['bancontact', 'creditcard', 'applepay', 'googlepay', 'kbc'] },
	emails: { replyTo: '', bccOrders: false },
	analytics: { plausible: true, ga4: false },
	legal: {}
};

export type SettingsKey = keyof Settings;

export async function getSettings<K extends SettingsKey>(db: Executor, keys: K[]): Promise<Pick<Settings, K>> {
	const rows = await db.select().from(settings).where(inArray(settings.key, keys));
	const out = {} as Pick<Settings, K>;
	for (const key of keys) {
		const row = rows.find((r) => r.key === key);
		const fallback = DEFAULT_SETTINGS[key];
		out[key] = (
			row
				? fallback && typeof fallback === 'object' && !Array.isArray(fallback)
					? { ...fallback, ...(row.value as object) }
					: row.value
				: fallback
		) as Settings[K];
	}
	return out;
}

export async function getSetting<K extends SettingsKey>(db: Executor, key: K): Promise<Settings[K]> {
	return (await getSettings(db, [key]))[key];
}

export async function setSetting<K extends SettingsKey>(db: Executor, key: K, value: Settings[K]) {
	await db
		.insert(settings)
		.values({ key, value: value as object, updatedAt: new Date() })
		.onConflictDoUpdate({ target: settings.key, set: { value: value as object, updatedAt: new Date() } });
}

/** True when an announcement/scheduled item is visible at `now`. */
export function isWithinWindow(from: string | Date | null | undefined, until: string | Date | null | undefined, now = new Date()) {
	if (from && new Date(from) > now) return false;
	if (until && new Date(until) <= now) return false;
	return true;
}
