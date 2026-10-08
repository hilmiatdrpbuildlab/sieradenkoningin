/** P2-03: discounts + shipping settings changes reflect in cart totals immediately; audit logged. */
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { adminLogin } from './fixtures.ts';

test.describe.configure({ mode: 'serial' });
const CODE = `E2E${Date.now().toString().slice(-6)}`;

async function firstVariantId() {
	const db = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin' });
	await db.connect();
	const { rows } = await db.query(
		`select v.id from variants v join products p on p.id = v.product_id where p.status = 'active' and v.stock > 2 order by p.price desc limit 1`
	);
	await db.end();
	return rows[0].id as string;
}

test('a discount created in the admin applies to the cart right away', async ({ page, request }) => {
	test.skip(test.info().project.name !== 'chromium-desktop', 'admin flow covered once');
	await adminLogin(page);
	await page.goto('/admin/discounts');
	await page.locator('input[name=code]').fill(CODE);
	await page.locator('select[name=type]').selectOption('percent');
	await page.locator('input[name=percent]').fill('10');
	await page.getByRole('button', { name: 'Opslaan' }).click();
	await expect(page.getByText(`Code ${CODE} opgeslagen`)).toBeVisible();

	const variantId = await firstVariantId();
	const add = await request.post('/api/cart?lang=nl', { data: { variantId, qty: 1 } });
	expect(add.ok()).toBeTruthy();
	const before = await add.json();
	const applied = await (await request.put('/api/cart?lang=nl', { data: { code: CODE.toLowerCase() } })).json();
	expect(applied.discountCode).toBe(CODE);
	expect(applied.discount).toBe(Math.round(before.subtotal * 0.1));

	const bad = await request.put('/api/cart?lang=nl', { data: { code: 'BESTAATNIET' } });
	expect(bad.status()).toBe(422);
	expect((await bad.json()).codeError).toBe('not_found');

	await page.goto('/admin/audit?entity=discount');
	await expect(page.getByRole('cell', { name: 'create' }).first()).toBeVisible();
});

test('shipping threshold change is reflected in the cart immediately', async ({ page, request }) => {
	test.skip(test.info().project.name !== 'chromium-desktop', 'admin flow covered once');
	const variantId = await firstVariantId();
	const cart = await (await request.post('/api/cart?lang=nl', { data: { variantId, qty: 1 } })).json();
	expect(cart.subtotal).toBeGreaterThan(0);

	await adminLogin(page);
	await page.goto('/admin/settings/shipping');
	const homeRate = page.locator('form.rate').first();
	const original = await homeRate.locator('input[name=freeFrom]').inputValue();
	await homeRate.locator('input[name=freeFrom]').fill('9999');
	await homeRate.getByRole('button', { name: 'Tarief opslaan' }).click();
	await expect(homeRate.getByText('Opgeslagen.')).toBeVisible();
	const after = await (await request.get('/api/cart?lang=nl')).json();
	expect(after.freeShippingFrom).toBe(999900);
	expect(after.shippingEstimate).toBeGreaterThan(0);

	await homeRate.locator('input[name=freeFrom]').fill(original);
	await homeRate.getByRole('button', { name: 'Tarief opslaan' }).click();
	await expect(homeRate.getByText('Opgeslagen.')).toBeVisible();
});
