import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import {
	getMenus,
	MENU_KEYS,
	MENU_LABELS,
	parseMenuForm,
	saveMenu,
	type MenuKey
} from '#lib/server/services/content.ts';
import { audit } from '#lib/server/services/audit.ts';
import { localizeHref } from '#lib/i18n/paths.ts';
import { can } from '#lib/permissions.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requirePermission(locals, 'content:read');
	const menus = await getMenus(locals.db, [...MENU_KEYS]);
	const asI18n = (h: string | { nl: string; fr?: string }) => (typeof h === 'string' ? { nl: h, fr: h } : h);
	return {
		menus: MENU_KEYS.map((key) => ({
			key,
			label: MENU_LABELS[key],
			items: menus[key].map((i) => ({ label: i.label, href: asI18n(i.href), children: i.children }))
		})),
		canWrite: can(admin.role, 'content:write'),
		crumbs: [{ label: 'Content', href: '/admin/content' }, { label: "Menu's" }]
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requirePermission(locals, 'content:write');
		const form = await request.formData();
		const key = String(form.get('key')) as MenuKey;
		if (!MENU_KEYS.includes(key)) return fail(400, { key, errors: { _: ['Onbekend menu'] } });
		const { items, errors } = parseMenuForm(form, (href) => localizeHref(href, 'fr'));
		if (Object.keys(errors).length) return fail(400, { key, errors });
		const before = (await getMenus(locals.db, [key]))[key];
		await saveMenu(locals.db, key, items);
		await audit(locals.db, locals, {
			action: 'update',
			entity: 'menu',
			entityId: key,
			diff: { items: [before.length, items.length], labels: items.map((i) => i.label.nl) }
		});
		return { key, saved: true };
	}
};
