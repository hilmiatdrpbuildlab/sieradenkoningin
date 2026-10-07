/**
 * Environment variables (SvelteKit 3). Validated at startup; read server-side via
 * `import * as env from '$app/env/private'`, public ones via '$app/env/public'.
 * On Cloudflare: set secrets with `wrangler secret put DATABASE_URL` etc.
 *
 * Every external service is optional: when its key is empty the matching adapter in
 * src/lib/server/adapters/ falls back to a `mock` implementation (dev, tests, previews).
 */
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value ?? '';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Postgres connection string (Neon pooled URL in production, local cluster in dev)',
		schema: (v) => v || 'postgres://sk@localhost:54329/sieradenkoningin'
	},
	SESSION_SECRET: { description: 'Secret used to sign guest tokens', schema: optional },
	TOTP_ENC_KEY: { description: '32-byte base64 key that encrypts admin TOTP secrets', schema: optional },
	STORAGE_ENDPOINT: { description: 'S3-compatible object storage endpoint (empty → mock)', schema: optional },
	STORAGE_BUCKET: { schema: optional },
	STORAGE_ACCESS_KEY_ID: { schema: optional },
	STORAGE_SECRET_ACCESS_KEY: { schema: optional },
	STORAGE_REGION: { schema: (v) => v || 'auto' },
	MOLLIE_API_KEY: { description: 'Mollie API key (test_… or live_…). Empty → mock payments', schema: optional },
	SENDCLOUD_PUBLIC_KEY: { schema: optional },
	SENDCLOUD_SECRET_KEY: { description: 'Sendcloud secret; also verifies webhook signatures', schema: optional },
	POSTMARK_TOKEN: { description: 'Postmark server token. Empty → mock email writer', schema: optional },
	EMAIL_FROM: { schema: (v) => v || 'Sieradenkoningin <hallo@example.invalid>' },
	SHOP_INBOX: { schema: (v) => v || 'shop@example.invalid' },
	BREVO_API_KEY: { schema: optional },
	BREVO_LIST_ID: { schema: optional },
	TURNSTILE_SECRET: { description: 'Cloudflare Turnstile secret. Empty → always passes', schema: optional },
	CRON_SECRET: { description: 'Bearer token for /api/jobs/* endpoints', schema: optional },
	SENTRY_DSN: { schema: optional },
	PUBLIC_SITE_URL: { public: true, schema: (v) => v || 'http://localhost:5173' },
	PUBLIC_MEDIA_URL: {
		public: true,
		description: 'Public/CDN base URL for media (empty → /media served by the mock storage)',
		schema: optional
	},
	PUBLIC_TURNSTILE_SITE_KEY: { public: true, schema: optional },
	PUBLIC_PLAUSIBLE_DOMAIN: { public: true, schema: optional },
	PUBLIC_GA4_ID: { public: true, schema: optional }
});
