/**
 * Account: address book (P3-02). `?new` / `?edit=<id>` show the form; actions save / delete /
 * default. Exactly one default address whenever the book is not empty (services/account.ts).
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addressSchema } from '#lib/schemas/account.ts';
import { fieldErrors } from '#lib/schemas/common.ts';
import { deleteAddress, listAddresses, saveAddress, setDefaultAddress } from '#lib/server/services/account.ts';
import { loginRedirect } from '#lib/server/services/customer-auth.ts';
import { localizeHref } from '#lib/i18n/paths.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, url }) => {
	const addresses = await listAddresses(locals.db, locals.customer!.id);
	const editId = url.searchParams.get('edit');
	const editing = editId ? addresses.find((a) => a.id === editId) : null;
	if (editId && !editing) error(404, 'Not found');
	const saved = url.searchParams.get('saved');
	return {
		addresses,
		mode: editing ? ('edit' as const) : url.searchParams.has('new') || addresses.length === 0 ? ('new' as const) : null,
		editing: editing ?? null,
		saved: saved === 'deleted' || saved === 'default' || saved === '1' ? saved : null
	};
};

function me(locals: App.Locals, url: URL, lang: 'nl' | 'fr') {
	if (!locals.customer) redirect(303, loginRedirect(url, lang));
	return locals.customer.id;
}

export const actions: Actions = {
	save: async ({ request, locals, url, params }) => {
		const id = me(locals, url, params.lang);
		const form = await request.formData();
		const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
		const parsed = addressSchema.safeParse({ ...raw, isDefault: raw.isDefault ?? undefined });
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values: { ...raw, isDefault: raw.isDefault === 'on' } });
		const { id: addressId, ...input } = parsed.data;
		const r = await saveAddress(locals.db, id, addressId, input);
		if (!r.ok) return fail(r.reason === 'limit' ? 400 : 404, { error: r.reason, values: { ...raw, isDefault: raw.isDefault === 'on' } });
		redirect(303, `${localizeHref('/account/addresses', params.lang)}?saved=1`);
	},
	delete: async ({ request, locals, url, params }) => {
		const id = me(locals, url, params.lang);
		const addressId = String((await request.formData()).get('id') ?? '');
		if (!UUID.test(addressId) || !(await deleteAddress(locals.db, id, addressId))) return fail(404, { error: 'not_found' as const });
		redirect(303, `${localizeHref('/account/addresses', params.lang)}?saved=deleted`);
	},
	makeDefault: async ({ request, locals, url, params }) => {
		const id = me(locals, url, params.lang);
		const addressId = String((await request.formData()).get('id') ?? '');
		if (!UUID.test(addressId) || !(await setDefaultAddress(locals.db, id, addressId))) return fail(404, { error: 'not_found' as const });
		redirect(303, `${localizeHref('/account/addresses', params.lang)}?saved=default`);
	}
};
