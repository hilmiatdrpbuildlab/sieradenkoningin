/**
 * P2-09 / P3-03 / P3-05 / P3-06 e2e (mock payments + mock Sendcloud + mock storage):
 * place an order through the real checkout → it appears in /admin/orders → bulk "mark processing"
 * → create label → mark shipped (shipped email logged) → tracking webhook → partial refund
 * (refund email logged) → invoice download rules → packing slip; editor is read-only.
 * The admins are created here (own accounts → no shared login rate limits).
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import pg from 'pg';
import { adminLogin } from './fixtures.ts';
import { hashPassword } from '../../src/lib/server/auth/password.ts';
import { encrypt } from '../../src/lib/server/crypto.ts';
import { mockWebhookSignature } from '../../src/lib/server/adapters/shipping.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const DB_URL = process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin';
const PASSWORD = 'Ops-Orders-Password-2026';
const OWNER = {
	email: 'ops-orders-owner@example.invalid',
	password: PASSWORD,
	totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXQ'
};
const EDITOR = {
	email: 'ops-orders-editor@example.invalid',
	password: PASSWORD,
	totpSecret: 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU'
};

async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
	const c = new pg.Client(DB_URL);
	await c.connect();
	try {
		return (await c.query<T>(sql, params)).rows;
	} finally {
		await c.end();
	}
}

async function upsertAdmin(a: typeof OWNER, role: 'owner' | 'editor') {
	const key = process.env.TOTP_ENC_KEY;
	if (!key) throw new Error('TOTP_ENC_KEY missing');
	await query(
		`insert into admin_users (email, name, role, password_hash, totp_secret, totp_enabled_at, active)
		 values ($1, $2, $3, $4, $5, now(), true)
		 on conflict (email) do update set role = excluded.role, password_hash = excluded.password_hash,
		   totp_secret = excluded.totp_secret, totp_enabled_at = now(), active = true`,
		[a.email, `DEMO ${role}`, role, await hashPassword(a.password), await encrypt(a.totpSecret, key)]
	);
	await query(`delete from rate_limits where key like $1`, [`%${a.email}%`]).catch(() => {});
}

async function placePaidOrder(page: Page, ctx: BrowserContext, baseURL: string) {
	const [v] = await query<{ id: string; stock: number }>(
		"select v.id, v.stock from variants v join products p on p.id = v.product_id where p.status = 'active' and v.sku like 'DEMO-%' order by v.stock desc limit 1"
	);
	test.skip(!v || v.stock < 2, 'no stocked DEMO variant');
	const r = await ctx.request.post('/api/cart?lang=nl', {
		data: { variantId: v.id, qty: 1 },
		headers: { origin: baseURL }
	});
	expect(r.ok()).toBe(true);
	await page.goto('/nl/afrekenen');
	await page.locator('#co-email').fill('e2e.admin-orders@example.com');
	await page.locator('#co-firstName').fill('Ann');
	await page.locator('#co-lastName').fill('DEMO');
	await page.locator('#co-line1').fill('Demostraat 1');
	await page.locator('#co-postalCode').fill('9000');
	await page.locator('#co-city').fill('Gent');
	await page.locator('input[name=terms]').check({ force: true });
	await page.getByRole('button', { name: 'Bestellen met betaalverplichting' }).click();
	await page.waitForURL(/\/nl\/betalen\/mock\?id=mock_/);
	await page.getByRole('button', { name: 'Simuleer betaald' }).click();
	await page.waitForURL(/\/nl\/bedankt\/SK-\d{4}-\d{6}\?t=/);
	const url = new URL(page.url());
	return { number: url.pathname.split('/').pop()!, token: url.searchParams.get('t')! };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
	await upsertAdmin(OWNER, 'owner');
	await upsertAdmin(EDITOR, 'editor');
});

let order: { number: string; token: string; id: string; invoice: string };

test('order placed in the shop appears in the admin and can be marked processing', async ({
	page,
	context,
	baseURL
}) => {
	const placed = await placePaidOrder(page, context, baseURL!);
	const [row] = await query<{ id: string; status: string; invoice_number: string }>(
		'select id, status, invoice_number from orders where number = $1',
		[placed.number]
	);
	expect(row.status).toBe('paid');
	order = { ...placed, id: row.id, invoice: row.invoice_number };

	await adminLogin(page, OWNER);
	await page.goto(`/admin/orders?q=${placed.number}`);
	await page.waitForLoadState('networkidle'); // row selection needs hydration
	const tableRow = page.getByRole('row', { name: new RegExp(placed.number) });
	await expect(tableRow).toBeVisible();
	await expect(tableRow.getByText('Betaald').first()).toBeVisible();
	await tableRow.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Markeer in behandeling' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'In behandeling' })).toBeVisible();
	expect((await query<{ status: string }>('select status from orders where id = $1', [row.id]))[0].status).toBe(
		'processing'
	);
	await expect(tableRow.getByText('In behandeling')).toBeVisible();
});

test('detail: label → shipped email → tracking webhook → partial refund → invoice + packing slip', async ({
	page,
	baseURL
}) => {
	await adminLogin(page, OWNER);
	await page.goto(`/admin/orders/${order.id}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1, name: order.number })).toBeVisible();
	await expect(page.getByText('Bestelling geplaatst')).toBeVisible(); // timeline

	// internal note
	await page.getByLabel('Interne notitie (niet zichtbaar voor de klant)').fill('DEMO: inpakken met lint');
	await page.getByRole('button', { name: 'Notitie toevoegen' }).click();
	await expect(page.locator('.timeline').getByText('DEMO: inpakken met lint')).toBeVisible();

	// label
	await page.getByRole('button', { name: 'Label aanmaken' }).click();
	await expect(page.getByRole('status')).toHaveText('Label aangemaakt.');
	const [ship] = await query<{ id: string; provider_ref: string; tracking_number: string }>(
		'select id, provider_ref, tracking_number from shipments where order_id = $1',
		[order.id]
	);
	expect(ship.tracking_number).toMatch(/^DEMO\d+/);
	const label = await page.request.get(`/admin/orders/${order.id}/label/${ship.id}`);
	expect(label.headers()['content-type']).toBe('application/pdf');

	// shipped (manual hand-over) → email with track & trace
	await page.getByText('Markeer verzonden', { exact: true }).first().click(); // <summary>
	await page.getByRole('button', { name: 'Markeer verzonden' }).click();
	await expect(page.getByRole('status')).toContainText('Gemarkeerd als verzonden');
	expect((await query<{ status: string }>('select status from orders where id = $1', [order.id]))[0].status).toBe(
		'shipped'
	);
	await expect
		.poll(
			async () =>
				(
					await query('select 1 from email_log where ref_id = $1 and template = $2 and status = $3', [
						order.number,
						'order_shipped',
						'sent'
					])
				).length
		)
		.toBe(1);

	// Sendcloud webhook: bad signature rejected, signed "delivered" applied, replay is a no-op
	const body = JSON.stringify({
		action: 'parcel_status_changed',
		parcel: { id: ship.provider_ref, status: { id: 11 } }
	});
	const bad = await page.request.post('/api/webhooks/sendcloud', {
		data: body,
		headers: { 'content-type': 'application/json', 'sendcloud-signature': 'nope' }
	});
	expect(bad.status()).toBe(401);
	const sig = await mockWebhookSignature(body);
	for (const expected of ['updated', 'noop']) {
		const res = await page.request.post('/api/webhooks/sendcloud', {
			data: body,
			headers: { 'content-type': 'application/json', 'sendcloud-signature': sig }
		});
		expect(await res.json()).toMatchObject({ ok: true, outcome: expected });
	}
	expect((await query<{ status: string }>('select status from orders where id = $1', [order.id]))[0].status).toBe(
		'delivered'
	);

	// partial refund of € 1,00 (by amount) → refund email
	await page.reload();
	await page.waitForLoadState('networkidle');
	await page.getByText('Terugbetaling maken').click();
	await page.getByLabel('Vrij bedrag').check();
	await page.getByLabel('Bedrag (€)').fill('1,00');
	await page.getByRole('button', { name: 'Terugbetalen' }).click();
	await expect(page.getByRole('status')).toHaveText('Gedeeltelijke terugbetaling uitgevoerd.');
	const [o] = await query<{ refunded_total: number; payment_status: string }>(
		'select refunded_total, payment_status from orders where id = $1',
		[order.id]
	);
	expect(o).toMatchObject({ refunded_total: 100, payment_status: 'partially_refunded' });
	await expect
		.poll(
			async () =>
				(await query('select 1 from email_log where ref_id = $1 and template = $2', [order.number, 'refund_issued']))
					.length
		)
		.toBe(1);

	// invoice: admin may download
	const inv = await page.request.get(`/api/invoices/${order.invoice}`);
	expect(inv.status()).toBe(200);
	expect(inv.headers()['content-type']).toBe('application/pdf');
	expect((await inv.body()).subarray(0, 5).toString()).toBe('%PDF-');

	// packing slip (outside the admin shell, print button)
	await page.goto(`/admin/orders/${order.id}/packing-slip`);
	await expect(page.getByRole('heading', { name: 'Pakbon' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Afdrukken' })).toBeVisible();
	await expect(page.locator('nav[aria-label]').filter({ hasText: 'Bestellingen' })).toHaveCount(0);
	void baseURL;
});

test('invoice download: guest with token yes, anonymous no', async ({ playwright, baseURL }) => {
	const anon = await playwright.request.newContext({ baseURL });
	expect((await anon.get(`/api/invoices/${order.invoice}`)).status()).toBe(404);
	expect((await anon.get(`/api/invoices/${order.invoice}?t=wrong`)).status()).toBe(404);
	const ok = await anon.get(`/api/invoices/${order.number}?t=${order.token}`);
	expect(ok.status()).toBe(200);
	expect(ok.headers()['content-disposition']).toContain(`${order.invoice}.pdf`);
	await anon.dispose();
});

test('editor sees the order read-only and cannot change it', async ({ page }) => {
	await adminLogin(page, EDITOR);
	await page.goto(`/admin/orders/${order.id}`);
	await expect(page.getByRole('heading', { level: 1, name: order.number })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Notitie toevoegen' })).toHaveCount(0);
	await expect(page.getByText('Terugbetaling maken')).toHaveCount(0);
	await page.goto('/admin/orders');
	await expect(page.getByRole('checkbox', { name: 'Alles selecteren' })).toHaveCount(0);
	const res = await page.request.post(`/admin/orders/${order.id}?/note`, {
		form: { text: 'mag niet' },
		headers: { origin: new URL(page.url()).origin, 'x-sveltekit-action': 'true' }
	});
	expect(res.status()).toBe(403);
});
