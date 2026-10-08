import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vite';

/** Third-party hosts allowed by the CSP (P0-10). Keep in sync with docs/RUNBOOK.md. */
const MOLLIE = 'https://*.mollie.com' as const;
const TURNSTILE = 'https://challenges.cloudflare.com' as const;
const ANALYTICS = ['https://plausible.io', 'https://www.googletagmanager.com', 'https://*.google-analytics.com'] as const;

export default defineConfig({
	plugins: [
		tailwindcss(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// Locale = first path segment (/fr/… → fr); everything else (admin, api) → nl.
			// Language switching does a full page load, so the client locale is fixed per document.
			strategy: ['custom-path', 'baseLocale'],
			emitTsDeclarations: true
		}),
		sveltekit({
			adapter: adapter(),
			// Built-in origin check off: it rejects Mollie webhooks (no Origin header). The same rule is
			// re-applied in hooks.server.ts (src/lib/server/csrf.ts) with /api/webhooks/* exempted.
			csrf: { trustedOrigins: ['*'] },
			csp: {
				// Hashes (not nonces) so CDN-cached HTML stays valid (§4.6).
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self', TURNSTILE, ...ANALYTICS],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:', 'https:'],
					'font-src': ['self'],
					'connect-src': ['self', 'https:', ...ANALYTICS],
					'frame-src': ['self', TURNSTILE, MOLLIE],
					'form-action': ['self', MOLLIE],
					'frame-ancestors': ['self'],
					'base-uri': ['self'],
					'object-src': ['none']
				}
			}
		})
	],
	server: { port: 5173, watch: { ignored: ['**/.data/**', '**/test-results/**', '**/playwright-report/**'] } }
});
