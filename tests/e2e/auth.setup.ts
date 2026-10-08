/**
 * Logs the e2e owner in ONCE (password + TOTP) and stores the session cookie, so specs don't hit the
 * 2FA rate limit (5 attempts / 15 min) by logging in again and again. See adminLogin() in fixtures.ts.
 */
import { test as setup } from '@playwright/test';
import { ADMIN_STATE, freshAdminLogin } from './fixtures.ts';

setup('authenticate e2e owner', async ({ page }) => {
	await freshAdminLogin(page);
	await page.context().storageState({ path: ADMIN_STATE });
});
