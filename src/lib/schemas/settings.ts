import { z } from 'zod';
import { checkbox } from './common.ts';

/** Belgian enterprise number: 10 digits starting with 0 or 1, mod-97 check on the first 8. */
export function isValidBeEnterpriseNumber(input: string) {
	const digits = input.replace(/\D/g, '');
	if (!/^[01]\d{9}$/.test(digits)) return false;
	return 97 - (Number(digits.slice(0, 8)) % 97) === Number(digits.slice(8));
}

const optionalText = (max = 200) => z.string().trim().max(max).default('');

export const storeSettingsSchema = z.object({
	name: z.string().trim().min(1, 'Winkelnaam is verplicht').max(100),
	legalName: optionalText(),
	street: optionalText(),
	postalCode: optionalText(10),
	city: optionalText(100),
	country: z.string().trim().length(2).default('BE'),
	kbo: optionalText(20).refine((v) => !v || isValidBeEnterpriseNumber(v), 'Ongeldig ondernemingsnummer (bv. 0123.456.749)'),
	vat: optionalText(20).refine((v) => !v || /^BE\s?[01]\d{3}\.?\d{3}\.?\d{3}$/i.test(v.replace(/\s/g, '')) && isValidBeEnterpriseNumber(v), 'Ongeldig btw-nummer (bv. BE0123456749)'),
	email: z.union([z.literal(''), z.string().trim().email('Ongeldig e-mailadres')]).default(''),
	phone: optionalText(30)
});

export const generalSettingsSchema = z.object({
	returnDays: z.coerce.number().int().min(14, 'Minstens 14 dagen (wettelijk minimum)').max(365),
	maintenanceEnabled: checkbox,
	maintenanceNl: optionalText(500),
	maintenanceFr: optionalText(500)
});
