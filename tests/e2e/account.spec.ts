/**
 * P3-01 / P3-02 / P3-04 / P3-09 e2e — customer accounts with the MOCK email adapter: links are read
 * from `.data/emails/*.html`. Full auth flows (register → verify, logout, password login, magic link,
 * forgot → reset, single-use links), guest cart + order linking, account area (addresses, settings,
 * GDPR export, deletion with dialog + password), public order tracking and back-in-stock alerts.
 */
import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin';
const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret';
const PASSWORD = 'Kroon-en-klaver-2026';
const NEW_PASSWORD = 'Nieuwe-sterke-zin-2026';

async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
	const c = new pg.Client(DB_URL);
	await c.connect();
	try {
		return (await c.query<T>(sql, params)).rows;
	} finally {
		await c.end();
	}
}

/** Waits for the newest mock email `<template>` to `to` and returns the first link that matches `re`. */
async function emailLink(template: string, to: string, re: RegExp, after = 0): Promise<string> {
	const safe = to.replace(/[^a-z0-9@._-]/gi, '_');
	for (let i = 0; i < 50; i++) {
		const files = readdirSync('.data/emails')
			.filter((f) => f.endsWith(`-${template}-${safe}.html`))
			.map((f) => ({ f, t: Number(/^mock-(\d+)-/.exec(f)?.[1] ?? 0) }))
			.filter((x) => x.t >= after)
			.sort((a, b) => b.t - a.t);
		if (files.length) {
			const html = readFileSync(`.data/emails/${files[0].f}`, 'utf8');
			const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
			const hit = hrefs.find((h) => re.test(h));
			if (hit) {
				const u = new URL(hit);
				return u.pathname + u.search;
			}
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`no ${template} email to ${to}`);
}

const uniqueEmail = (tag: string) => `e2e-acct-${tag}-${Date.now()}@example.invalid`;
const passwordForm = (page: Page) => page.locator('main form[action="?/password"]');

async function register(page: Page, email: string) {
	await page.goto('/nl/account/registreren');
	await page.locator('main input[name=firstName]').fill('Ann');
	await page.locator('main input[name=lastName]').fill('DEMO');
	await page.locator('main input[name=email]').fill(email);
	await page.locator('main input[name=password]').fill(PASSWORD);
	await page.getByRole('button', { name: 'Account aanmaken' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check je mailbox');
}

async function verify(page: Page, email: string) {
	await page.goto(await emailLink('account_verify', email, /\/nl\/account\/bevestigen\?token=/));
	await page.getByRole('button', { name: 'Bevestig mijn e-mailadres' }).click();
	await page.waitForURL(/\/nl\/account\?notice=verified/);
	await expect(page.getByRole('status').filter({ hasText: 'Je e-mailadres is bevestigd' })).toBeVisible();
}

async function passwordLogin(page: Page, email: string, password: string) {
	await page.goto('/nl/account/inloggen');
	await passwordForm(page).locator('input[name=email]').fill(email);
	await passwordForm(page).locator('input[name=password]').fill(password);
	await passwordForm(page).getByRole('button', { name: 'Inloggen' }).click();
}

async function logout(page: Page) {
	await page.getByRole('navigation', { name: 'Accountmenu' }).getByRole('button', { name: 'Uitloggen' }).click();
	await page.waitForURL(/\/nl\/account\/inloggen\?out=1/);
}

async function guestOrder(email: string) {
	const number = `SK-1999-${String(Date.now()).slice(-6)}`;
	const addr = JSON.stringify({ name: 'Ann DEMO', line1: 'Demostraat 1', postalCode: '9000', city: 'Gent', country: 'BE' });
	const [o] = await query<{ id: string }>(
		`insert into orders (number, access_token, email, status, payment_status, subtotal, vat_total, total, shipping_address, billing_address, paid_at)
		 values ($1, 'e2e', $2, 'shipped', 'paid', 4900, 850, 4900, $3, $3, now()) returning id`,
		[number, email, addr]
	);
	await query(`insert into order_lines (order_id, sku, name, unit_price, qty, vat_amount, line_total) values ($1, 'DEMO-E2E', '{"nl":"DEMO Klaverring","fr":"DEMO Bague trèfle"}', 4900, 1, 850, 4900)`, [o.id]);
	await query(`insert into shipments (order_id, carrier, tracking_number, tracking_url, status) values ($1, 'bpost', '3SDEMO123', 'https://track.example/3SDEMO123', 'shipped')`, [o.id]);
	await query(`insert into order_events (order_id, type, actor) values ($1, 'shipped', 'e2e')`, [o.id]);
	return number;
}

test.describe('customer accounts', () => {
	// The flows share server-side state (emails, rate limits); one viewport is enough for them.
	test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-desktop', 'flows run on desktop; layouts are checked below'));

	test('register → verify → logout → password login, with guest cart merge and guest order linking', async ({ page, context, baseURL }) => {
		const email = uniqueEmail('main');
		const number = await guestOrder(email);
		// Guest cart before logging in.
		const [v] = await query<{ id: string }>("select v.id from variants v join products p on p.id = v.product_id where p.status = 'active' and v.stock > 2 order by v.stock desc limit 1");
		const r = await context.request.post('/api/cart?lang=nl', { data: { variantId: v.id, qty: 1 }, headers: { origin: baseURL! } });
		expect(r.ok()).toBe(true);

		await register(page, email);
		// Unverified: password login is refused with a fresh verification link.
		await passwordLogin(page, email, PASSWORD);
		await expect(page.getByRole('alert')).toContainText('nog niet bevestigd');

		await verify(page, email);
		// Guest order with the verified email is now in the account.
		await page.getByRole('navigation', { name: 'Accountmenu' }).getByRole('link', { name: 'Bestellingen' }).click();
		await expect(page.getByRole('link', { name: new RegExp(number) })).toBeVisible();
		await page.getByRole('link', { name: new RegExp(number) }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Bestelling ${number}`);
		await expect(page.locator('ol li[aria-current=step]')).toContainText('Verzonden');
		await expect(page.getByRole('link', { name: /Volg je pakje/ })).toHaveAttribute('href', 'https://track.example/3SDEMO123');
		// Guest cart now belongs to the customer.
		const [cart] = await query<{ customer_id: string | null }>(
			'select c.customer_id from carts c join customers cu on cu.id = c.customer_id where cu.email = $1',
			[email]
		);
		expect(cart?.customer_id).toBeTruthy();

		await logout(page);
		await page.goto('/nl/account/bestellingen');
		await expect(page).toHaveURL(/\/nl\/account\/inloggen\?next=%2Fnl%2Faccount%2Fbestellingen/);

		// Wrong password and unknown email give the same message.
		await passwordLogin(page, email, 'not-the-password');
		const wrong = await page.getByRole('alert').textContent();
		await passwordLogin(page, uniqueEmail('nobody'), PASSWORD);
		expect(await page.getByRole('alert').textContent()).toBe(wrong);

		await page.goto('/nl/account/inloggen?next=%2Fnl%2Faccount%2Fadressen');
		await passwordForm(page).locator('input[name=email]').fill(email);
		await passwordForm(page).locator('input[name=password]').fill(PASSWORD);
		await passwordForm(page).getByRole('button', { name: 'Inloggen' }).click();
		await page.waitForURL(/\/nl\/account\/adressen$/);
	});

	test('register with a known email gives the same response and mails the owner instead', async ({ page }) => {
		const email = uniqueEmail('dup');
		await register(page, email);
		const t = Date.now();
		await register(page, email);
		await emailLink('account_exists', email, /\/nl\/account\/inloggen/, t);
	});

	test('magic link login; links are single-use', async ({ page }) => {
		const email = uniqueEmail('magic');
		await register(page, email);
		await page.goto('/nl/account/inloggen');
		const magic = page.locator('form[action="?/magic"]');
		await magic.locator('input[name=email]').fill(email);
		await magic.getByRole('button', { name: 'Stuur mij een inloglink' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'inloglink' })).toBeVisible();

		const link = await emailLink('account_login_link', email, /\/nl\/account\/magische-link\?token=/);
		await page.goto(link);
		await page.getByRole('button', { name: 'Inloggen' }).click();
		await page.waitForURL(/\/nl\/account$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overzicht');
		// Magic link proved the email → account verified.
		const [c] = await query<{ email_verified_at: Date | null }>('select email_verified_at from customers where email = $1', [email]);
		expect(c.email_verified_at).not.toBeNull();

		await logout(page);
		await page.goto(link);
		await expect(page.getByRole('alert')).toContainText('verlopen of werd al gebruikt');
	});

	test('unknown email on forgot/magic gets the same confirmation; forgot → reset password', async ({ page }) => {
		await page.goto('/nl/account/wachtwoord-vergeten');
		await page.locator('main input[name=email]').fill(uniqueEmail('ghost'));
		await page.getByRole('button', { name: 'Stuur mij een link' }).click();
		await expect(page.getByRole('status')).toContainText('Als er een account bestaat');

		const email = uniqueEmail('reset');
		await register(page, email);
		await verify(page, email);
		await logout(page);

		await page.goto('/nl/account/wachtwoord-vergeten');
		await page.locator('main input[name=email]').fill(email);
		await page.getByRole('button', { name: 'Stuur mij een link' }).click();
		await expect(page.getByRole('status')).toContainText('Als er een account bestaat');
		const link = await emailLink('account_reset', email, /\/nl\/account\/wachtwoord-herstellen\//);

		await page.goto(link);
		await page.locator('main input[name=password]').fill('short');
		await page.locator('main input[name=confirm]').fill('short');
		await page.getByRole('button', { name: 'Wachtwoord opslaan' }).click();
		await expect(page.getByText('Je wachtwoord moet minstens 10 tekens lang zijn.')).toBeVisible();
		await page.locator('main input[name=password]').fill(NEW_PASSWORD);
		await page.locator('main input[name=confirm]').fill(NEW_PASSWORD);
		await page.getByRole('button', { name: 'Wachtwoord opslaan' }).click();
		await page.waitForURL(/\/nl\/account\?notice=password/);

		await logout(page);
		await page.goto(link);
		await expect(page.getByRole('alert')).toContainText('verlopen of werd al gebruikt');
		await passwordLogin(page, email, PASSWORD);
		await expect(page.getByRole('alert')).toContainText('horen niet bij elkaar');
		await passwordLogin(page, email, NEW_PASSWORD);
		await page.waitForURL(/\/nl\/account$/);
	});

	test('account area: addresses with one default, settings, GDPR export, deletion with dialog + password', async ({ page }) => {
		const email = uniqueEmail('area');
		await guestOrder(email);
		await register(page, email);
		await verify(page, email);

		// Addresses: the first one becomes the default; a second one can take over.
		await page.goto('/nl/account/adressen');
		const fill = async (name: string, line1: string, def = false) => {
			await page.locator('main input[name=name]').fill(name);
			await page.locator('main input[name=line1]').fill(line1);
			await page.locator('main input[name=postalCode]').fill('9000');
			await page.locator('main input[name=city]').fill('Gent');
			if (def) await page.locator('main input[name=isDefault]').check({ force: true });
			await page.getByRole('button', { name: 'Adres opslaan' }).click();
			await expect(page.getByRole('status')).toContainText('opgeslagen');
		};
		await fill('Ann DEMO', 'Demostraat 1');
		await page.getByRole('link', { name: 'Adres toevoegen' }).click();
		await fill('Ann DEMO', 'Werkstraat 2', true);
		const cards = page.locator('ul.book > li');
		await expect(cards).toHaveCount(2);
		await expect(cards.first()).toContainText('Werkstraat 2');
		await expect(page.locator('ul.book > li.default')).toHaveCount(1);
		await cards.nth(1).getByRole('button', { name: /Verwijderen/ }).click();
		await expect(page.getByRole('status')).toContainText('verwijderd');
		await expect(cards).toHaveCount(1);

		// Settings: profile + newsletter (double opt-in → pending).
		await page.goto('/nl/account/instellingen');
		await page.locator('main input[name=phone]').fill('+32 470 00 00 00');
		await page.locator('main select[name=locale]').selectOption('fr');
		await page.getByRole('button', { name: 'Wijzigingen opslaan' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Je gegevens zijn opgeslagen' })).toBeVisible();
		await page.getByRole('button', { name: 'Inschrijven op de nieuwsbrief' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'bevestig je inschrijving' })).toBeVisible();
		const [sub] = await query<{ status: string }>('select status from newsletter_subscribers where email = $1', [email]);
		expect(sub.status).toBe('pending');

		// GDPR export.
		const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Gegevens downloaden' }).click()]);
		const data = JSON.parse(readFileSync((await download.path())!, 'utf8'));
		expect(data.profile.email).toBe(email);
		expect(data.profile.phone).toBe('+32 470 00 00 00');
		expect(data.profile).not.toHaveProperty('passwordHash');
		expect(data.addresses).toHaveLength(1);
		expect(data.orders).toHaveLength(1);
		expect(data.orders[0].lines).toHaveLength(1);
		expect(Array.isArray(data.wishlist)).toBe(true);

		// Deletion: dialog + password + explicit confirmation.
		await page.getByRole('link', { name: 'Mijn account verwijderen' }).click();
		const dialog = page.getByRole('dialog', { name: 'Account definitief verwijderen?' });
		await expect(dialog).toBeVisible();
		await dialog.locator('input[name=password]').fill('wrong password!');
		await dialog.locator('input[name=confirm]').check({ force: true });
		await dialog.getByRole('button', { name: 'Definitief verwijderen' }).click();
		await expect(dialog.getByText('Dit wachtwoord klopt niet.')).toBeVisible();
		await dialog.locator('input[name=password]').fill(PASSWORD);
		await dialog.locator('input[name=confirm]').check({ force: true });
		await dialog.getByRole('button', { name: 'Definitief verwijderen' }).click();
		await page.waitForURL(/\/nl\/account\/inloggen\?deleted=1/);
		await expect(page.getByRole('status').filter({ hasText: 'definitief verwijderd' })).toBeVisible();

		const gone = await query('select 1 from customers where email = $1', [email]);
		expect(gone).toHaveLength(0);
		const [order] = await query<{ customer_id: string | null; email: string }>('select customer_id, email from orders where email = $1', [email]);
		expect(order.customer_id).toBeNull(); // invoice data kept, unlinked
		await passwordLogin(page, email, PASSWORD);
		await expect(page.getByRole('alert')).toContainText('horen niet bij elkaar');
	});

	test('order tracking: status + tracking link; a wrong email reveals nothing (same response as no order)', async ({ page, request }) => {
		const email = uniqueEmail('track');
		const number = await guestOrder(email);
		await page.goto('/nl/bestelling-volgen');
		await page.locator('main input[name=number]').fill(number.toLowerCase());
		await page.locator('main input[name=email]').fill(email);
		await page.getByRole('button', { name: 'Bestelling opzoeken' }).click();
		await expect(page.getByRole('heading', { name: `Bestelling ${number}` })).toBeVisible();
		await expect(page.getByRole('link', { name: /Volg je pakje/ })).toHaveAttribute('href', 'https://track.example/3SDEMO123');

		const post = async (n: string, e: string) => {
			const res = await request.post('/nl/bestelling-volgen', {
				form: { number: n, email: e },
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true', origin: new URL(page.url()).origin }
			});
			return { status: res.status(), body: (await res.text()).replaceAll(n, 'N').replaceAll(e, 'E') };
		};
		const wrongEmail = await post(number, uniqueEmail('stranger'));
		const unknownOrder = await post('SK-1999-000001', uniqueEmail('stranger2'));
		expect(wrongEmail.body).not.toContain('3SDEMO123');
		expect(wrongEmail).toEqual(unknownOrder);
	});

	test('back-in-stock: "mail me" on a sold-out variant, one email when restocked', async ({ page, request }) => {
		const slug = 'e2e-bis-demo-ring';
		const email = uniqueEmail('bis');
		const [cat] = await query<{ id: string }>('select id from categories order by position limit 1');
		await query('delete from products where slug = $1', [slug]);
		const [p] = await query<{ id: string }>(
			`insert into products (slug, name, category_id, price, status) values ($1, '{"nl":"DEMO Uitverkochte ring","fr":"DEMO Bague épuisée"}', $2, 5900, 'active') returning id`,
			[slug, cat.id]
		);
		const [v] = await query<{ id: string }>(`insert into variants (product_id, sku, metal, size, stock) values ($1, 'DEMO-E2E-BIS', 'gold', '54', 0) returning id`, [p.id]);
		try {
			await page.goto(`/nl/p/${slug}`);
			await expect(page.getByText('Mail mij als het terug is')).toBeVisible();
			await page.locator('form[action="/api/stock-alerts"] input[name=email]').fill(email);
			await page.getByRole('button', { name: 'Verwittig mij' }).click();
			await expect(page.getByRole('status').filter({ hasText: 'Genoteerd' })).toBeVisible();
			const alerts = await query<{ locale: string; notified_at: Date | null }>('select locale, notified_at from stock_alerts where email = $1', [email]);
			expect(alerts).toEqual([{ locale: 'nl', notified_at: null }]);

			// Restock + queue job (same as the cron scan) → exactly one email, never twice.
			await query('update variants set stock = 3 where id = $1', [v.id]);
			const cron = () => request.post('/api/jobs', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
			await query(`insert into jobs (type, payload) values ('stock.alert', $1)`, [JSON.stringify({ variantIds: [v.id] })]);
			expect((await cron()).ok()).toBe(true);
			await query(`insert into jobs (type, payload) values ('stock.alert', $1)`, [JSON.stringify({ variantIds: [v.id] })]);
			expect((await cron()).ok()).toBe(true);
			const link = await emailLink('back_in_stock', email, new RegExp(`/nl/p/${slug}\\?variant=`));
			expect(link).toContain(v.id);
			const safe = email.replace(/[^a-z0-9@._-]/gi, '_');
			expect(readdirSync('.data/emails').filter((f) => f.endsWith(`-back_in_stock-${safe}.html`))).toHaveLength(1);
		} finally {
			await query('delete from products where slug = $1', [slug]);
		}
	});
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-desktop', 'desktop only'));

	test('login error and order tracking work as plain form posts', async ({ page }) => {
		await page.goto('/fr/compte/connexion');
		await passwordForm(page).locator('input[name=email]').fill(uniqueEmail('nojs'));
		await passwordForm(page).locator('input[name=password]').fill('whatever-password');
		await passwordForm(page).getByRole('button', { name: 'Se connecter' }).click();
		await expect(page.getByRole('alert')).toContainText('ne correspondent pas');

		await page.goto('/fr/suivi-commande');
		await page.locator('main input[name=number]').fill('SK-1999-000002');
		await page.locator('main input[name=email]').fill(uniqueEmail('nojs'));
		await page.getByRole('button', { name: 'Rechercher ma commande' }).click();
		await expect(page.getByRole('alert')).toContainText('Nous ne trouvons aucune commande');
	});
});

test('auth and tracking pages fit the viewport (390/768/1440) and account pages are not indexable', async ({ page }) => {
	for (const path of ['/nl/account/inloggen', '/fr/compte/inscription', '/nl/account/wachtwoord-vergeten', '/fr/suivi-commande']) {
		if (path.includes('account') || path.includes('compte')) {
			const res = await page.request.get(path);
			expect(res.headers()['cache-control']).toBe('private, no-store');
			expect(res.headers()['x-robots-tag']).toContain('noindex');
		}
		await page.goto(path);
		// Measured inside <main> (the shared footer is out of scope here).
		const overflow = await page.evaluate(() => {
			const vw = document.documentElement.clientWidth;
			return Math.max(0, ...Array.from(document.querySelectorAll('main *')).map((el) => el.getBoundingClientRect().right - vw));
		});
		expect(overflow, path).toBeLessThanOrEqual(1);
	}
});
