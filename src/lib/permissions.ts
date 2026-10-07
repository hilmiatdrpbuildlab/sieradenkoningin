/**
 * Permission matrix (EXECUTION_PLAN §7.4). Lives outside `server/` so the admin UI can hide
 * navigation and buttons the role cannot use; the server still enforces it in every load/action.
 */
export const ROLES = ['owner', 'editor', 'fulfilment', 'support'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
	'dashboard',
	'reports',
	'catalog:read',
	'catalog:write',
	'content:read',
	'content:write',
	'inventory:read',
	'inventory:write',
	'orders:read',
	'orders:fulfil',
	'orders:refund',
	'customers:read',
	'customers:write',
	'discounts:read',
	'discounts:write',
	'settings',
	'users',
	'audit'
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
	owner: new Set(PERMISSIONS),
	editor: new Set<Permission>([
		'catalog:read',
		'catalog:write',
		'content:read',
		'content:write',
		'inventory:read',
		'inventory:write',
		'orders:read',
		'discounts:read',
		'discounts:write'
	]),
	fulfilment: new Set<Permission>([
		'catalog:read',
		'content:read',
		'inventory:read',
		'inventory:write',
		'orders:read',
		'orders:fulfil',
		'customers:read'
	]),
	support: new Set<Permission>([
		'catalog:read',
		'content:read',
		'inventory:read',
		'orders:read',
		'orders:fulfil',
		'orders:refund',
		'customers:read',
		'customers:write'
	])
};

export function can(role: Role | string | undefined | null, permission: Permission): boolean {
	return !!role && role in MATRIX && MATRIX[role as Role].has(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
	owner: 'Eigenaar',
	editor: 'Redacteur',
	fulfilment: 'Fulfilment',
	support: 'Klantendienst'
};
