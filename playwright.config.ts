import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromiumPath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
	testDir: 'tests/e2e',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	globalSetup: './tests/e2e/global-setup.ts',
	use: {
		baseURL,
		trace: 'retain-on-failure',
		locale: 'nl-BE',
		launchOptions: chromiumPath ? { executablePath: chromiumPath } : {}
	},
	projects: [
		{ name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
		{ name: 'webkit-mobile', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
		{ name: 'chromium-tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } }
	],
	webServer: process.env.E2E_BASE_URL
		? undefined
		: {
				command: 'npm run build && npx vite preview --port 4173 --strictPort',
				url: 'http://localhost:4173/nl',
				timeout: 300_000,
				reuseExistingServer: !process.env.CI
			}
});
