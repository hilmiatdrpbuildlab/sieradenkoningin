/** Admin navigation (§7.3), filtered per role with the §7.4 permission matrix. Dutch UI. */
import type { IconName } from './components/ui/icons.ts';
import { can, type Permission, type Role } from './permissions.ts';

export interface AdminNavItem {
	label: string;
	href: string;
	icon: IconName;
	permission: Permission;
	badgeKey?: 'ordersToProcess' | 'lowStock';
}
export interface AdminNavGroup {
	title?: string;
	items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
	{ items: [{ label: 'Dashboard', href: '/admin', icon: 'dashboard', permission: 'dashboard' }] },
	{
		title: 'Verkoop',
		items: [
			{ label: 'Bestellingen', href: '/admin/orders', icon: 'receipt', permission: 'orders:read', badgeKey: 'ordersToProcess' },
			{ label: 'Klanten', href: '/admin/customers', icon: 'users', permission: 'customers:read' },
			{ label: 'Kortingscodes', href: '/admin/discounts', icon: 'percent', permission: 'discounts:read' },
			{ label: 'Rapporten', href: '/admin/reports', icon: 'chart', permission: 'reports' }
		]
	},
	{
		title: 'Catalogus',
		items: [
			{ label: 'Producten', href: '/admin/products', icon: 'box', permission: 'catalog:read' },
			{ label: 'Categorieën', href: '/admin/categories', icon: 'tag', permission: 'catalog:read' },
			{ label: 'Collecties', href: '/admin/collections', icon: 'collection', permission: 'catalog:read' },
			{ label: 'Voorraad', href: '/admin/inventory', icon: 'inventory', permission: 'inventory:read', badgeKey: 'lowStock' },
			{ label: 'Media', href: '/admin/media', icon: 'image', permission: 'catalog:read' },
			{ label: 'Import / export', href: '/admin/import', icon: 'import', permission: 'catalog:write' }
		]
	},
	{
		title: 'Content',
		items: [
			{ label: "Pagina's", href: '/admin/content/pages', icon: 'file', permission: 'content:read' },
			{ label: "Menu's", href: '/admin/content/menus', icon: 'menu-list', permission: 'content:read' },
			{ label: 'FAQ', href: '/admin/content/faq', icon: 'question', permission: 'content:read' }
		]
	},
	{
		title: 'Instellingen',
		items: [
			{ label: 'Instellingen', href: '/admin/settings/store', icon: 'settings', permission: 'settings' },
			{ label: 'Gebruikers', href: '/admin/users', icon: 'shield', permission: 'users' },
			{ label: 'Auditlog', href: '/admin/audit', icon: 'history', permission: 'audit' }
		]
	}
];

export function navForRole(role: Role, badges: Partial<Record<NonNullable<AdminNavItem['badgeKey']>, number>> = {}) {
	return ADMIN_NAV.map((g) => ({
		title: g.title,
		items: g.items.filter((i) => can(role, i.permission)).map((i) => ({ label: i.label, href: i.href, icon: i.icon, badge: i.badgeKey ? badges[i.badgeKey] || undefined : undefined }))
	})).filter((g) => g.items.length);
}

/** First page a role may open (fulfilment/support/editor have no dashboard). */
export function homeForRole(role: Role) {
	for (const g of ADMIN_NAV) for (const i of g.items) if (can(role, i.permission)) return i.href;
	return '/admin/orders';
}
