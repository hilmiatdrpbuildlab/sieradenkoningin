/**
 * P1-01 admin product form: create / edit / duplicate / archive, with and without JavaScript,
 * inline Dutch validation, the activation rule and audit rows.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import pg from 'pg';
import { adminLogin } from './fixtures.ts';

const RUN = `demo-e2e-${Date.now().toString(36)}`;

function dbClient() {
	if (existsSync('.env')) process.loadEnvFile('.env');
	return new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin' });
}

async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
	const c = dbClient();
	await c.connect();
	try {
		return (await c.query(sql, params)).rows as T[];
	} finally {
		await c.end();
	}
}

/** A browser context that has the admin session but no JavaScript. */
async function noJsPage(browser: Browser, page: Page) {
	const state = await page.context().storageState();
	const ctx = await browser.newContext({ javaScriptEnabled: false, storageState: state, baseURL: test.info().project.use.baseURL });
	return ctx.newPage();
}

test.describe('admin products', () => {
	test.afterAll(async () => {
		await query(`delete from products where slug like $1`, [`${RUN}%`]);
	});

	test('validates inline in Dutch and enforces the activation rule (JS)', async ({ page }) => {
		await adminLogin(page);
		await page.goto('/admin/products/nieuw');
		await page.getByRole('button', { name: 'Product aanmaken' }).click();
		await expect(page.getByText('Naam (NL) is verplicht')).toBeVisible();
		await expect(page.getByText('Prijs is verplicht')).toBeVisible();
		await expect(page.getByRole('alert').filter({ hasText: 'Kies een categorie' })).toBeVisible();

		await page.getByLabel('Naam (NL)').fill(`${RUN} js`);
		await expect(page.locator('input[name=slug]')).toHaveValue(`${RUN}-js`);
		await page.locator('select[name=categoryId]').selectOption({ label: 'Ringen' });
		await page.locator('input[name=price]').fill('49,95');
		await page.locator('select[name=status]').selectOption('active');
		await page.getByRole('button', { name: 'Product aanmaken' }).click();
		await expect(page.getByText(/minstens één foto met Nederlandse alt-tekst/)).toBeVisible();
		await expect(page.getByText(/minstens één variant/)).toBeVisible();

		// draft + variants from the matrix → saved
		await page.locator('select[name=status]').selectOption('draft');
		await page.getByLabel('Goud', { exact: true }).check();
		await page.locator('input[name="matrix.sizes"]').fill('50, 52');
		await page.getByRole('button', { name: 'Genereer' }).click();
		await expect(page.locator('input[name="variants.1.sku"]')).toHaveValue(`${RUN}-JS-GO-52`.toUpperCase());
		await expect(page.getByText('Niet-opgeslagen wijzigingen')).toBeVisible();
		await page.getByRole('button', { name: 'Product aanmaken' }).click();
		await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\?saved=new/);
		await expect(page.getByText('Product aangemaakt.')).toBeVisible();
		await expect(page.locator('input[name="variants.0.sku"]')).toHaveValue(`${RUN}-JS-GO-50`.toUpperCase());
	});

	test('create, edit, duplicate and archive work without JavaScript', async ({ page, browser }) => {
		await adminLogin(page);
		const p = await noJsPage(browser, page);

		// create
		await p.goto('/admin/products/nieuw');
		await p.locator('input[name="name.nl"]').fill(`DEMO E2E ${RUN} nojs`);
		await p.locator('input[name=slug]').fill(`${RUN}-nojs`);
		await p.locator('select[name=categoryId]').selectOption({ label: 'Armbanden' });
		await p.locator('input[name=price]').fill('39,95');
		await p.locator('input[name="matrix.metals"][value=silver]').check();
		await p.locator('input[name="matrix.sizes"]').fill('S, M');
		await p.getByRole('button', { name: 'Product aanmaken' }).click();
		await expect(p).toHaveURL(/saved=new/);
		const id = new URL(p.url()).pathname.split('/').pop()!;
		await expect(p.locator('input[name="variants.1.sku"]')).toHaveValue(`${RUN}-NOJS-SI-M`.toUpperCase());

		// edit price + stock → price_history + stock movement
		await p.locator('input[name=price]').fill('44,95');
		await p.locator('input[name="variants.0.stock"]').fill('3');
		await p.getByRole('button', { name: 'Opslaan' }).click();
		await expect(p.getByText('Wijzigingen opgeslagen.')).toBeVisible();
		await expect(p.locator('input[name=price]')).toHaveValue('44,95');
		const history = await query<{ price: number }>(`select price from price_history where product_id = $1 order by valid_from`, [id]);
		expect(history.map((h) => h.price)).toEqual([3995, 4495]);

		// invalid edit without JS shows inline errors and keeps the typed values
		await p.locator('input[name=compareAtPrice]').fill('10');
		await p.getByRole('button', { name: 'Opslaan' }).click();
		await expect(p.getByText('Van-prijs moet hoger zijn dan de prijs')).toBeVisible();
		await expect(p.locator('input[name=compareAtPrice]')).toHaveValue('10');

		// duplicate
		await p.goto(`/admin/products/${id}`);
		await p.getByRole('button', { name: 'Dupliceren' }).click();
		await expect(p).toHaveURL(/saved=duplicate/);
		await expect(p.locator('input[name=slug]')).toHaveValue(`${RUN}-nojs-kopie`);
		await expect(p.locator('select[name=status]')).toHaveValue('draft');

		// archive (no confirm dialog without JS)
		await p.goto(`/admin/products/${id}`);
		await p.getByRole('button', { name: 'Archiveren' }).click();
		await expect(p).toHaveURL(/saved=archived/);
		await expect(p.getByText('Gearchiveerd').first()).toBeVisible();

		const audits = await query<{ action: string }>(`select action from audit_log where entity = 'product' and entity_id = $1 order by created_at`, [id]);
		expect(audits.map((a) => a.action)).toEqual(['create', 'update', 'archive']);
		await p.context().close();
	});

	test('list filters and sorts via URL parameters', async ({ page }) => {
		await adminLogin(page);
		await page.goto('/admin/products?q=klaver&sort=price&dir=asc');
		const rows = page.locator('tbody tr');
		await expect(rows.first()).toContainText('Klaverring');
		await page.locator('select[name=status]').selectOption('archived');
		await page.getByRole('button', { name: 'Filteren' }).click();
		await expect(page).toHaveURL(/status=archived.*sort=price|sort=price.*status=archived/);
	});
});
