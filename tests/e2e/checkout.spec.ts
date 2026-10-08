/**
 * P2-04 / P2-06 / P2-08 e2e — checkout with the MOCK payments adapter (no MOLLIE_API_KEY):
 * error summary, paid path (stock decremented, confirmation email logged), failed path + retry,
 * and the no-JS form up to the payment redirect.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin';

async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
	const c = new pg.Client(DB_URL);
	await c.connect();
	try {
		return (await c.query<T>(sql, params)).rows;
	} finally {
		await c.end();
	}
}

/** The best-stocked active DEMO variant (each run consumes a few units). */
async function stockedVariant() {
	const [v] = await query<{ id: string; stock: number }>(
		"select v.id, v.stock from variants v join products p on p.id = v.product_id where p.status = 'active' and v.sku like 'DEMO-%' order by v.stock desc limit 1"
	);
	test.skip(!v || v.stock < 2, 'no stocked DEMO variant');
	return v;
}

async function addToCart(ctx: BrowserContext, baseURL: string, variantId: string, lang = 'nl') {
	const r = await ctx.request.post(`/api/cart?lang=${lang}`, { data: { variantId, qty: 1 }, headers: { origin: baseURL } });
	expect(r.ok()).toBe(true);
}

async function fillCheckout(page: Page, email: string) {
	await page.locator('#co-email').fill(email);
	await page.locator('#co-firstName').fill('Ann');
	await page.locator('#co-lastName').fill('DEMO');
	await page.locator('#co-line1').fill('Demostraat 1');
	await page.locator('#co-postalCode').fill('9000');
	await page.locator('#co-city').fill('Gent');
	await page.locator('input[name=terms]').check({ force: true });
}

const placeOrder = (page: Page) => page.getByRole('button', { name: 'Bestellen met betaalverplichting' }).click();

test.describe('checkout (mock payments)', () => {
	test('shows a focused error summary with links to the fields', async ({ page, context, baseURL }) => {
		const v = await stockedVariant();
		await addToCart(context, baseURL!, v.id);
		await page.goto('/nl/afrekenen');
		await placeOrder(page);
		const summary = page.locator('[role=alert][aria-labelledby=error-summary-title]');
		await expect(summary).toBeFocused();
		await expect(summary.getByRole('link', { name: /E-mailadres/ })).toBeVisible();
		await summary.getByRole('link', { name: /E-mailadres/ }).click();
		await expect(page.locator('#co-email')).toBeFocused();
	});

	test('paid: lands on the thank-you page, stock is decremented, confirmation email is logged', async ({ page, context, baseURL }) => {
		const v = await stockedVariant();
		await addToCart(context, baseURL!, v.id);
		await page.goto('/nl/afrekenen');
		await fillCheckout(page, 'e2e.paid@example.com');
		await placeOrder(page);
		await page.waitForURL(/\/nl\/betalen\/mock\?id=mock_/);
		await page.getByRole('button', { name: 'Simuleer betaald' }).click();
		await page.waitForURL(/\/nl\/bedankt\/SK-\d{4}-\d{6}\?t=/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bedankt voor je bestelling');
		await expect(page.getByRole('link', { name: 'Account aanmaken' })).toBeVisible();

		const number = /bedankt\/(SK-[\d-]+)/.exec(page.url())![1];
		const [order] = await query<{ status: string; invoice_number: string }>('select status, invoice_number from orders where number = $1', [number]);
		expect(order.status).toBe('paid');
		expect(order.invoice_number).toMatch(/^SK-INV-/);
		const [{ stock }] = await query<{ stock: number }>('select stock from variants where id = $1', [v.id]);
		expect(stock).toBe(v.stock - 1);
		const log = await query('select 1 from email_log where ref_id = $1 and template = $2 and status = $3', [number, 'order_confirmation', 'sent']);
		expect(log).toHaveLength(1);

		// Without the token the page is not accessible
		const res = await page.request.get(`/nl/bedankt/${number}`);
		expect(res.status()).toBe(404);
	});

	test('failed: shows the retry button, which starts a new payment', async ({ page, context, baseURL }) => {
		const v = await stockedVariant();
		await addToCart(context, baseURL!, v.id);
		await page.goto('/nl/afrekenen');
		await fillCheckout(page, 'e2e.failed@example.com');
		await placeOrder(page);
		await page.waitForURL(/\/nl\/betalen\/mock/);
		await page.getByRole('button', { name: 'Simuleer mislukt' }).click();
		await page.waitForURL(/\/nl\/bedankt\//);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Je betaling is niet gelukt');
		const number = /bedankt\/(SK-[\d-]+)/.exec(page.url())![1];
		expect((await query<{ status: string }>('select status from orders where number = $1', [number]))[0].status).toBe('cancelled');

		await page.getByRole('button', { name: 'Opnieuw betalen' }).click();
		await page.waitForURL(/\/nl\/betalen\/mock/);
		await page.getByRole('button', { name: 'Simuleer betaald' }).click();
		await page.waitForURL(/\/nl\/bedankt\//);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bedankt voor je bestelling');
	});
});

test.describe('checkout without JavaScript', () => {
	test.use({ javaScriptEnabled: false, locale: 'fr-BE' });

	test('reaches the payment redirect (FR, pickup point search)', async ({ page, context, baseURL }) => {
		const v = await stockedVariant();
		await addToCart(context, baseURL!, v.id, 'fr');
		await page.goto('/fr/commande');
		await page.locator('#co-email').fill('e2e.nojs@example.com');
		await page.locator('#co-firstName').fill('Marie');
		await page.locator('#co-lastName').fill('DEMO');
		await page.locator('#co-line1').fill('Rue Démo 1');
		await page.locator('#co-postalCode').fill('1000');
		await page.locator('#co-city').fill('Bruxelles');
		await page.locator('input[name=shippingMethod][value=pickup]').check();
		await page.locator('#co-spPostalCode').fill('1000');
		await page.getByRole('button', { name: /Chercher/ }).click();
		await page.locator('input[name=servicePointId]').first().check();
		await page.locator('input[name=terms]').check({ force: true });
		await page.getByRole('button', { name: 'Commander avec obligation de paiement' }).click();
		await expect(page).toHaveURL(/\/fr\/paiement\/mock\?id=mock_/);
	});
});
