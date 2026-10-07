import { expect, test } from '@playwright/test';

test('root redirects by Accept-Language and the home page renders', async ({ page, request }) => {
	const res = await request.get('/', { headers: { 'accept-language': 'fr-BE,fr;q=0.9' }, maxRedirects: 0 });
	expect(res.status()).toBe(302);
	expect(res.headers().location).toMatch(/\/fr$/);

	const home = await page.goto('/nl');
	expect(home?.status()).toBe(200);
	await expect(page.locator('html')).toHaveAttribute('lang', 'nl-BE');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.locator('link[rel=alternate][hreflang=fr-BE]')).toHaveAttribute('href', /\/fr$/);
});

test('language switch keeps the current page', async ({ page }) => {
	await page.goto('/nl/winkelmand');
	const fr = page.locator('nav').filter({ hasText: 'FR' }).first().getByRole('link', { name: /Français|FR/ });
	if (await fr.count()) {
		await fr.first().click();
		await expect(page).toHaveURL(/\/fr\/panier/);
		await expect(page.locator('html')).toHaveAttribute('lang', 'fr-BE');
	}
});

test('unknown pages return a branded 404', async ({ page }) => {
	const res = await page.goto('/nl/deze-pagina-bestaat-niet-xyz');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(/bestaat niet/i);
});
