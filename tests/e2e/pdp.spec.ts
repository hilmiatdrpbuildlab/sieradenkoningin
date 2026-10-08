/** P1-08 — product detail page (DEMO seed data). */
import { expect, test, type Page } from '@playwright/test';

/** Navigate and wait until the app has hydrated (dev servers can be slow to load modules). */
const open = async (page: Page, url: string) => {
	const res = await page.goto(url, { waitUntil: 'networkidle' });
	// dismiss the cookie banner (P4) so it never covers the controls under test
	const reject = page.getByRole('button', { name: /^(Alles weigeren|Tout refuser|Refuser)/ });
	if (
		await reject
			.first()
			.isVisible()
			.catch(() => false)
	)
		await reject.first().click();
	return res;
};

test.describe('PDP', () => {
	test('switching variant updates price, stock and URL without a reload', async ({ page }) => {
		await open(page, '/nl/p/demo-klaver-ring');
		await expect(page.getByRole('heading', { level: 1, name: 'DEMO Klaverring' })).toBeVisible();
		await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));

		await page.locator('.buybox label', { hasText: 'Zilver' }).click();
		await expect(page).toHaveURL(/\?variant=[0-9a-f-]{36}/);
		const first = new URL(page.url()).searchParams.get('variant');
		const size = page.getByLabel('Maat', { exact: true });
		const options = await size.locator('option').allInnerTexts();
		await size.selectOption({ index: options.length - 1 });
		await expect.poll(() => new URL(page.url()).searchParams.get('variant')).not.toBe(first);
		await expect(page.locator('.buybox .stock')).toHaveText(/voorraad|uitverkocht/);
		expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

		// a deep link selects that variant server-side
		const url = page.url();
		await open(page, url);
		await expect(size).toHaveValue(options[options.length - 1].split(' ')[0]);
	});

	test('sale price shows the Omnibus 30-day lowest price', async ({ page }) => {
		await open(page, '/nl/p/demo-koord-ring');
		await expect(page.locator('.buybox .was')).toBeVisible();
		await expect(page.getByText(/Laagste prijs van de voorbije 30 dagen/)).toBeVisible();
	});

	test('structured data: Product with Offers + BreadcrumbList', async ({ page }) => {
		await open(page, '/fr/p/demo-klaver-ring');
		const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
		const ld = blocks.map((b) => JSON.parse(b));
		const product = ld.find((j) => j['@type'] === 'Product');
		expect(product.name).toBe('DEMO bague trèfle');
		expect(product.offers.length).toBeGreaterThan(1);
		expect(product.offers[0]).toMatchObject({ '@type': 'Offer', priceCurrency: 'EUR' });
		expect(ld.find((j) => j['@type'] === 'BreadcrumbList').itemListElement).toHaveLength(3);
	});

	test('size guide opens in a dialog and closes with Escape', async ({ page }) => {
		await open(page, '/nl/p/demo-klaver-ring');
		await page.getByRole('button', { name: 'Maatgids' }).click();
		const dialog = page.getByRole('dialog', { name: 'Maatgids' });
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	test('add to cart (JS) shows a toast', async ({ page }) => {
		await open(page, '/nl/p/demo-klaver-ketting');
		await page.getByRole('button', { name: 'In winkelmand' }).click();
		await expect(page.getByText(/Toegevoegd/).first()).toBeVisible();
	});

	test('rails: complete the set + related; recently viewed after visiting two products', async ({ page }) => {
		await open(page, '/nl/p/demo-kroon-ring');
		await expect(page.getByRole('heading', { name: 'Misschien vind je dit ook mooi' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Maak de set compleet' })).toBeVisible();
		await open(page, '/nl/p/demo-klaver-ring');
		await expect(page.getByRole('heading', { name: 'Onlangs bekeken' })).toBeVisible();
	});
});

test.describe('PDP without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test('add-to-cart form posts to ?/add and lands on the cart page', async ({ page }) => {
		await open(page, '/nl/p/demo-klaver-ketting');
		await page.getByRole('button', { name: 'In winkelmand' }).click();
		await expect(page).toHaveURL(/\/nl\/winkelmand/);
	});
});
