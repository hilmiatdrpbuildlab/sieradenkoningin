/**
 * P5-02: axe (WCAG 2.2 A/AA rules) on every key route, in NL and FR, plus a CSP check: the page must not
 * report any `securitypolicyviolation` events. Accept: 0 serious/critical axe violations.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { adminLogin } from './fixtures.ts';

const STORE_ROUTES = [
	'/nl',
	'/fr',
	'/nl/ringen',
	'/fr/bagues',
	'/nl/collectie/nieuw',
	'/nl/p/demo-klaver-ring',
	'/fr/p/demo-klaver-ring',
	'/nl/zoeken?q=klaver',
	'/nl/zoeken?q=zzzzzz',
	'/nl/winkelmand',
	'/nl/verlanglijst',
	'/nl/faq',
	'/nl/contact',
	'/nl/ons-verhaal',
	'/nl/maatgids',
	'/nl/voorwaarden',
	'/nl/herroeping',
	'/nl/wettelijke-vermeldingen',
	'/nl/account/inloggen',
	'/nl/account/registreren',
	'/nl/bestelling-volgen',
	'/fr/suivi-commande',
	'/nl/nieuwsbrief',
	'/nl/bestaat-niet'
];
const ADMIN_ROUTES = [
	'/admin',
	'/admin/orders',
	'/admin/products',
	'/admin/products/nieuw',
	'/admin/inventory',
	'/admin/media',
	'/admin/customers',
	'/admin/discounts',
	'/admin/reports',
	'/admin/content/pages',
	'/admin/settings/store',
	'/admin/users',
	'/admin/audit'
];

async function audit(page: Page, path: string) {
	const violations: string[] = [];
	await page.addInitScript(() => {
		(window as unknown as { __csp: string[] }).__csp = [];
		document.addEventListener('securitypolicyviolation', (e) =>
			(window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`)
		);
	});
	// Measure at rest: reveal animations are disabled under reduced motion (contrast is sampled mid-fade otherwise).
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(path);
	await page.waitForLoadState('networkidle').catch(() => {});
	// Close the consent banner the way a visitor would, so it doesn't hide content during the scan.
	const reject = page.getByRole('button', { name: /Alles weigeren|Tout refuser/ });
	if (await reject.isVisible().catch(() => false)) await reject.click();
	const result = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	for (const v of result.violations) {
		if (v.impact === 'serious' || v.impact === 'critical') {
			violations.push(
				`${path}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes
					.slice(0, 3)
					.map((n) => n.target.join(' '))
					.join(' | ')})`
			);
		}
	}
	const csp = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
	for (const c of csp) violations.push(`${path}: CSP violation ${c}`);
	return violations;
}

test.describe('accessibility', () => {
	test.skip(
		({ browserName }) => browserName === 'webkit',
		'axe results are engine-independent; run on chromium (desktop + tablet)'
	);

	test('storefront has no serious/critical axe violations and no CSP violations', async ({ page }) => {
		test.setTimeout(240_000);
		const all: string[] = [];
		for (const path of STORE_ROUTES) all.push(...(await audit(page, path)));
		expect(all, all.join('\n')).toEqual([]);
	});

	test('admin has no serious/critical axe violations and no CSP violations', async ({ page }) => {
		test.setTimeout(240_000);
		await adminLogin(page);
		const all: string[] = [];
		for (const path of ADMIN_ROUTES) all.push(...(await audit(page, path)));
		expect(all, all.join('\n')).toEqual([]);
	});
});
