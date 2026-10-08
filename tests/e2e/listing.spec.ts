/** P1-07 / P1-09 / P1-10 — category listing, filters, search and wishlist (DEMO seed data). */
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

test.describe('category listing', () => {
	test('renders NL and FR with breadcrumb, grid and canonical without filters', async ({ page }) => {
		await open(page, '/nl/ringen?metal=gold&sort=price_asc');
		await expect(page.getByRole('heading', { level: 1, name: 'Ringen' })).toBeVisible();
		await expect(
			page
				.getByRole('navigation', { name: /kruimel|breadcrumb/i })
				.or(page.locator('nav ol'))
				.first()
		).toBeVisible();
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/nl\/ringen$/);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
		await expect(page.locator('link[hreflang="fr-BE"]')).toHaveAttribute('href', /\/fr\/bagues$/);
		expect(await page.locator('.grid > li').count()).toBeGreaterThan(0);

		const res = await open(page, '/fr/bagues');
		expect(res?.headers()['cache-control']).toContain('s-maxage=600');
		await expect(page.getByRole('heading', { level: 1, name: 'Bagues' })).toBeVisible();
	});

	test('filters combine via URL params and Back restores the previous state', async ({ page, isMobile }) => {
		test.skip(!!isMobile, 'desktop popovers; the bottom sheet is covered below');
		await open(page, '/nl/ringen');
		const all = await page.locator('.grid > li').count();

		await page.getByText('Op voorraad', { exact: true }).first().click();
		await expect(page).toHaveURL(/stock=1/);
		await page.locator('summary', { hasText: 'Metaal' }).click();
		await page.locator('.pop[open] label', { hasText: /^\s*Goud\s*$/ }).click();
		await expect(page).toHaveURL(/metal=gold/);
		await expect(page).toHaveURL(/stock=1/);
		const filtered = await page.locator('.grid > li').count();
		expect(filtered).toBeLessThanOrEqual(all);
		await expect(page.locator('.chips a', { hasText: 'Goud' })).toBeVisible();

		await page.goBack();
		await expect(page).not.toHaveURL(/metal=/);
		await expect(page).toHaveURL(/stock=1/);
		await expect(page.locator('input[name="stock"]').first()).toBeChecked();
	});

	test('sort changes the order (price ascending)', async ({ page }) => {
		await open(page, '/nl/ringen?sort=price_asc');
		const prices = await page.locator('.grid .price').allInnerTexts();
		const cents = prices.map(
			(p) => Number(p.split('€')[1]?.trim().split(/\s/)[0].replace('.', '').replace(',', '.')) || 0
		);
		expect(cents.length).toBeGreaterThan(1);
		expect([...cents].sort((a, b) => a - b)).toEqual(cents);
	});

	test('mobile bottom sheet shows the applied-filter badge', async ({ page, isMobile }) => {
		test.skip(!isMobile, 'mobile only');
		await open(page, '/nl/ringen?metal=gold&stock=1');
		const btn = page.getByRole('button', { name: /Filter/ });
		await expect(btn).toContainText('2');
		await btn.click();
		const sheet = page.getByRole('dialog', { name: 'Filters' });
		await expect(sheet).toBeVisible();
		await sheet.locator('label', { hasText: 'Zilver' }).click();
		await expect(page).toHaveURL(/metal=silver/);
		await sheet.getByRole('button', { name: /Toon resultaten/ }).click();
		await expect(sheet).toBeHidden();
	});

	test('impossible filter combination shows the empty state', async ({ page }) => {
		await open(page, '/nl/ringen?min=9000');
		await expect(page.getByText('Geen juwelen gevonden')).toBeVisible();
	});

	test('collection resolves in both languages and redirects the other slug', async ({ page }) => {
		await open(page, '/fr/collection/nieuw');
		await expect(page).toHaveURL(/\/fr\/collection\/nouveautes$/);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('CMS page resolves through the slug route; unknown slug is 404', async ({ page }) => {
		await open(page, '/fr/guide-des-tailles');
		await expect(page.locator('link[hreflang="nl-BE"]')).toHaveAttribute('href', /\/nl\/maatgids$/);
		const res = await open(page, '/nl/bestaat-niet-xyz');
		expect(res?.status()).toBe(404);
	});
});

test.describe('search', () => {
	test('typo tolerant results page and no-results suggestions', async ({ page }) => {
		await open(page, '/nl/zoeken?q=klavr');
		await expect(page.locator('.grid .name').first()).toContainText('Klaver');
		await open(page, '/fr/recherche?q=trefle');
		await expect(page.locator('.grid .name').first()).toContainText('trèfle');
		await open(page, '/nl/zoeken?q=xqzwv');
		await expect(page.getByText(/Geen resultaten/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'klaver' })).toBeVisible();
	});

	test('overlay opens from the header and shows instant results', async ({ page }) => {
		await open(page, '/nl/ringen');
		await page.getByRole('link', { name: 'Zoeken' }).first().click();
		const dialog = page.getByRole('dialog', { name: 'Zoek in de collectie' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('link', { name: 'klaver' })).toBeVisible();
		await dialog.getByRole('searchbox').fill('klaver');
		await expect(dialog.locator('.hits li').first()).toContainText('Klaver');
		await dialog.getByRole('searchbox').press('Enter');
		await expect(page).toHaveURL(/\/nl\/zoeken\?q=klaver/);
	});
});

test.describe('wishlist', () => {
	test('works as a guest, hearts stay consistent and the share link is read-only', async ({ page, context }) => {
		await open(page, '/nl/ringen');
		const heart = page.getByRole('button', { name: /DEMO Klaverring bewaren/ });
		await heart.click();
		await expect(page.getByRole('button', { name: /DEMO Klaverring verwijderen/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await open(page, '/nl/p/demo-klaver-ring');
		await expect(page.locator('.buybox .wish')).toHaveAttribute('aria-pressed', 'true');

		await open(page, '/nl/verlanglijst');
		await expect(page.locator('.grid .name', { hasText: 'DEMO Klaverring' })).toBeVisible();
		await page.getByRole('button', { name: 'Deel je verlanglijst' }).click();
		const link = await page.locator('#wl-share').inputValue();
		expect(link).toMatch(/\/nl\/verlanglijst\?share=/);

		const other = await context.browser()!.newContext();
		const p2 = await other.newPage();
		await open(p2, link);
		await expect(p2.getByRole('heading', { level: 1, name: 'Gedeelde verlanglijst' })).toBeVisible();
		await expect(p2.locator('.grid .name', { hasText: 'DEMO Klaverring' })).toBeVisible();
		await other.close();

		await page.getByRole('button', { name: /DEMO Klaverring verwijderen/ }).click();
		await expect(page.getByText('Je verlanglijst is nog leeg')).toBeVisible();
	});
});
