/**
 * Role-based permissions for the admin (EXECUTION_PLAN §7.4).
 * Enforced in EVERY admin `load` and action via `requirePermission()`; tested in tests/unit/guard.test.ts.
 */
import { error } from '@sveltejs/kit';
import type { Permission, Role } from '#lib/permissions.ts';
import { can } from '#lib/permissions.ts';

export { can, PERMISSIONS, ROLES, ROLE_LABELS } from '#lib/permissions.ts';
export type { Permission, Role } from '#lib/permissions.ts';

/** Throws 401 when not signed in and 403 when the role lacks the permission. Returns the admin. */
export function requirePermission(locals: App.Locals, permission: Permission): NonNullable<App.Locals['admin']> {
	const admin = locals.admin;
	if (!admin) error(401, 'Niet aangemeld');
	if (!can(admin.role as Role, permission)) error(403, 'Je hebt geen toegang tot dit onderdeel');
	return admin;
}
