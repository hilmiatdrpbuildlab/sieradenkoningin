/**
 * P5-03: authorization matrix — every admin route × every role. Sessions are created directly in the
 * database (2FA-verified) so the suite doesn't depend on, or trip, the login rate limits.
 */
import { createHash, randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { can, ROLES, type Permission, type Role } from '../../src/lib/permissions.ts';

test.skip(
	!!process.env.E2E_BASE_URL && !process.env.E2E_BASE_URL.includes('localhost'),
	'creates sessions in the local database'
);
test.skip(({ browserName }) => browserName !== 'chromium', 'route matrix is browser-independent');

/** Admin routes and the permission that gates their GET (from §7.4). `dashboard` redirects instead of 403. */
const ROUTES: [string, Permission][] = [
	['/admin/orders', 'orders:read'],
	['/admin/customers', 'customers:read'],
	['/admin/discounts', 'discounts:read'],
	['/admin/reports', 'reports'],
	['/admin/reports/export?type=days', 'reports'],
	['/admin/products', 'catalog:read'],
	['/admin/products/nieuw', 'catalog:write'], // the create form
	['/admin/categories', 'catalog:read'],
	['/admin/collections', 'catalog:read'],
	['/admin/inventory', 'inventory:read'],
	['/admin/media', 'catalog:read'],
	['/admin/import', 'catalog:read'], // page also hosts the CSV export; import actions need catalog:write
	['/admin/content/pages', 'content:read'],
	['/admin/content/menus', 'content:read'],
	['/admin/content/faq', 'content:read'],
	['/admin/content/announcement', 'content:read'],
	['/admin/settings/store', 'settings'],
	['/admin/settings/shipping', 'settings'],
	['/admin/settings/payments', 'settings'],
	['/admin/settings/emails', 'settings'],
	['/admin/settings/legal', 'settings'],
	['/admin/settings/redirects', 'settings'],
	['/admin/users', 'users'],
	['/admin/audit', 'audit']
];

const db = () =>
	new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin' });
const tokens = {} as Record<Role, string>;

test.beforeAll(async () => {
	const c = db();
	await c.connect();
	for (const role of ROLES) {
		const email = `authz-${role}@example.invalid`;
		const { rows } = await c.query(
			`insert into admin_users (email, name, role, active, totp_enabled_at) values ($1, $2, $3, true, now())
			 on conflict (email) do update set role = excluded.role, active = true returning id`,
			[email, `Authz ${role}`, role]
		);
		const token = randomBytes(32).toString('base64url');
		await c.query(
			`insert into sessions (id, user_type, user_id, expires_at, idle_expires_at, two_factor_verified) values ($1, 'admin', $2, now() + interval '1 hour', now() + interval '1 hour', true)`,
			[createHash('sha256').update(token).digest('hex'), rows[0].id]
		);
		tokens[role] = token;
	}
	await c.end();
});

for (const role of ROLES) {
	test(`role ${role}: every admin route is allowed or forbidden exactly as §7.4 says`, async ({ request }) => {
		const headers = { cookie: `sk_admin=${tokens[role]}` };
		const failures: string[] = [];
		for (const [path, permission] of ROUTES) {
			const res = await request.get(path, { headers, maxRedirects: 0 });
			const allowed = can(role, permission);
			const ok = allowed ? res.status() === 200 : res.status() === 403;
			if (!ok) failures.push(`${path} (${permission}) → ${res.status()}, expected ${allowed ? 200 : 403}`);
		}
		// Dashboard: owner sees it, other roles are redirected to their first allowed page.
		const dash = await request.get('/admin', { headers, maxRedirects: 0 });
		if (role === 'owner' ? dash.status() !== 200 : dash.status() !== 303) failures.push(`/admin → ${dash.status()}`);
		expect(failures, failures.join('\n')).toEqual([]);
	});
}

test('mutations are refused for roles without write permission', async ({ request }) => {
	// An editor may not refund, a fulfilment user may not edit products, support may not change settings.
	const cases: [Role, string, Record<string, string>][] = [
		['fulfilment', '/admin/products/nieuw?/save', { nameNl: 'x' }],
		['support', '/admin/settings/store?/store', { name: 'x' }],
		['editor', '/admin/users?/invite', { email: 'x@example.invalid', name: 'x', role: 'owner' }],
		['fulfilment', '/admin/discounts?/save', { code: 'HACK', type: 'percent', percent: '50' }],
		['support', '/admin/import?/commit', { csv: 'x' }]
	];
	for (const [role, path, form] of cases) {
		const res = await request.post(path, {
			headers: { cookie: `sk_admin=${tokens[role]}`, origin: new URL(test.info().project.use.baseURL!).origin },
			form,
			maxRedirects: 0
		});
		expect(res.status(), `${role} POST ${path}`).toBe(403);
	}
});
