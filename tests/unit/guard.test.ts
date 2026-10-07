import { describe, expect, it } from 'vitest';
import { can, PERMISSIONS, ROLES, type Permission, type Role } from '#lib/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';

/** EXECUTION_PLAN §7.4, written out explicitly so a change to the matrix must also change this test. */
const EXPECTED: Record<Role, Permission[]> = {
	owner: [...PERMISSIONS],
	editor: ['catalog:read', 'catalog:write', 'content:read', 'content:write', 'inventory:read', 'inventory:write', 'orders:read', 'discounts:read', 'discounts:write'],
	fulfilment: ['catalog:read', 'content:read', 'inventory:read', 'inventory:write', 'orders:read', 'orders:fulfil', 'customers:read'],
	support: ['catalog:read', 'content:read', 'inventory:read', 'orders:read', 'orders:fulfil', 'orders:refund', 'customers:read', 'customers:write']
};

describe('permission matrix', () => {
	for (const role of ROLES) {
		for (const perm of PERMISSIONS) {
			const allowed = EXPECTED[role].includes(perm);
			it(`${role} ${allowed ? 'can' : 'cannot'} ${perm}`, () => expect(can(role, perm)).toBe(allowed));
		}
	}

	it('only the owner sees dashboard, reports, settings, users and audit', () => {
		for (const p of ['dashboard', 'reports', 'settings', 'users', 'audit'] as const) {
			expect(ROLES.filter((r) => can(r, p))).toEqual(['owner']);
		}
	});

	it('denies unknown roles and anonymous users', () => {
		expect(can(undefined, 'catalog:read')).toBe(false);
		expect(can('hacker', 'catalog:read')).toBe(false);
	});

	it('requirePermission throws 401 / 403', () => {
		const status = (fn: () => unknown) => {
			try {
				fn();
				return 200;
			} catch (e) {
				return (e as { status: number }).status;
			}
		};
		const admin = (role: Role) => ({ admin: { id: '1', name: 'x', email: 'x@y.z', role, sessionId: 's' } }) as App.Locals;
		expect(status(() => requirePermission({} as App.Locals, 'catalog:read'))).toBe(401);
		expect(status(() => requirePermission(admin('editor'), 'orders:refund'))).toBe(403);
		expect(status(() => requirePermission(admin('support'), 'orders:refund'))).toBe(200);
	});
});
