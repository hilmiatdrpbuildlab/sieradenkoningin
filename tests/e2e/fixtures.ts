/**
 * Shared e2e helpers. The e2e admin is created by global-setup with a KNOWN TOTP secret so tests can
 * pass 2FA. Against a preview deployment the credentials come from E2E_ADMIN_* secrets instead.
 */
import { existsSync, readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { totpCode } from '../../src/lib/server/auth/totp.ts';

export const E2E_ADMIN = {
	email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-owner@example.invalid',
	password: process.env.E2E_ADMIN_PASSWORD ?? 'E2E-Owner-Password-2026',
	totpSecret: process.env.E2E_ADMIN_TOTP_SECRET ?? 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
};

/** Session saved by auth.setup.ts (setup project). */
export const ADMIN_STATE = '.data/e2e-admin-state.json';

/** Full login: password + TOTP. Used once by the setup project (and as a fallback). */
export async function freshAdminLogin(page: Page, admin = E2E_ADMIN) {
	await page.goto('/admin/login');
	await page.locator('input[name=email]').fill(admin.email);
	await page.locator('input[name=password]').fill(admin.password);
	await page.getByRole('button', { name: 'Inloggen' }).click();
	await page.waitForURL(/\/admin\/login\/2fa/);
	await page.locator('input[name=code]').fill(await totpCode(admin.totpSecret));
	await page.getByRole('button', { name: 'Verifiëren' }).click();
	await expect(page).not.toHaveURL(/\/admin\/login/);
}

/**
 * Signs the page's context in as the e2e owner. Reuses the stored session cookie when it is still
 * valid; otherwise performs a fresh login.
 */
export async function adminLogin(page: Page, admin = E2E_ADMIN) {
	if (admin === E2E_ADMIN && existsSync(ADMIN_STATE)) {
		const state = JSON.parse(readFileSync(ADMIN_STATE, 'utf8')) as { cookies: Parameters<ReturnType<Page['context']>['addCookies']>[0] };
		await page.context().addCookies(state.cookies.filter((c) => c.name === 'sk_admin'));
		await page.goto('/admin/audit');
		if (!new URL(page.url()).pathname.startsWith('/admin/login')) return;
	}
	await freshAdminLogin(page, admin);
}
