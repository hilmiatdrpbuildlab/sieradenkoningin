/** P0-10: security headers, admin guard, maintenance mode (admins bypass). */
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { adminLogin } from './fixtures.ts';

test.describe.configure({ mode: 'serial' });

test('storefront responses carry the security headers', async ({ request }) => {
	const res = await request.get('/nl');
	const h = res.headers();
	expect(h['content-security-policy']).toContain("default-src 'self'");
	expect(h['content-security-policy']).toContain('frame-ancestors');
	expect(h['strict-transport-security']).toContain('max-age=');
	expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
	expect(h['permissions-policy']).toContain('camera=()');
	expect(h['x-content-type-options']).toBe('nosniff');
});

test('admin is protected: pages redirect, API returns 401, responses are noindex', async ({ request }) => {
	const page = await request.get('/admin/products', { maxRedirects: 0 });
	expect(page.status()).toBe(303);
	expect(page.headers().location).toContain('/admin/login');
	const api = await request.post('/admin/api/uploads', { data: {}, maxRedirects: 0 });
	expect(api.status()).toBe(401);
	const login = await request.get('/admin/login');
	expect(login.headers()['x-robots-tag']).toContain('noindex');
});

test('maintenance mode returns 503 with Retry-After; admins bypass it', async ({ browser, request }) => {
	test.skip(!!process.env.E2E_BASE_URL && !process.env.E2E_BASE_URL.includes('localhost'), 'toggles settings directly in the local database');
	const db = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin' });
	await db.connect();
	const set = (enabled: boolean) =>
		db.query(`insert into settings (key, value) values ('maintenance', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify({ enabled })]);
	try {
		await set(true);
		const res = await request.get('/nl');
		expect(res.status()).toBe(503);
		expect(res.headers()['retry-after']).toBeTruthy();
		expect(await res.text()).toContain('Sieradenkoningin');

		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await adminLogin(page);
		const shop = await page.goto('/nl');
		expect(shop?.status()).toBe(200);
		await ctx.close();
	} finally {
		await set(false);
		await db.end();
	}
});
