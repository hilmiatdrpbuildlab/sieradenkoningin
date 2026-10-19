# Sieradenkoningin — online store & admin CMS

Bilingual (NL/FR) luxury jewellery store for Belgium with a full back office: catalogue, inventory, orders,
payments (Mollie), shipping (Sendcloud), invoices, customer accounts, CMS page builder, reports.

**Stack:** SvelteKit 3 · Svelte 5 (runes) · Tailwind 4 · Drizzle ORM + PostgreSQL (Neon) · Cloudflare Workers ·
Paraglide i18n · zod 4. Plan and conventions: [`EXECUTION_PLAN.md`](EXECUTION_PLAN.md), [`CLAUDE.md`](CLAUDE.md),
design: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md), owner handbook: [`docs/RUNBOOK.md`](docs/RUNBOOK.md) (Dutch).

## Quick start (local)

```bash
npm install && npx svelte-kit sync
cp .env.example .env            # fill SESSION_SECRET, TOTP_ENC_KEY (32-byte base64), CRON_SECRET
npm run db:migrate && npm run db:seed   # prints the owner password once
npm run dev                     # http://localhost:5173/nl  ·  admin: /admin
```

Every external service falls back to a **mock adapter** when its key is empty: uploads go to `.data/uploads`,
e-mails to `.data/emails/*.html`, payments to a "simulate paid/failed" page, labels are fake PDFs. Use any
PostgreSQL ≥ 14 (`DATABASE_URL`); the seed creates 24 clearly marked **DEMO** products.

## Scripts

| Script                                           | What it does                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `npm run dev` / `build` / `preview`              | Vite dev server · Cloudflare build · local preview of the build        |
| `npm run check`                                  | svelte-check (must be 0 errors / 0 warnings)                           |
| `npm run lint` / `format`                        | Prettier + ESLint                                                      |
| `npm run test`                                   | Vitest unit + integration tests (uses `TEST_DATABASE_URL`)             |
| `npm run test:e2e`                               | Playwright on 1440 Chromium, 390 WebKit, 768 Chromium                  |
| `npm run db:generate` / `db:migrate` / `db:seed` | Drizzle migrations and idempotent seed (`-- --no-demo` for production) |
| `npm run admin:reset -- <email>`                 | Emergency admin password + 2FA reset                                   |
| `npm run bench:search`                           | Search latency benchmark (1,000 products)                              |

## Deploy (Cloudflare Workers + Neon)

**Staging** (2026-10-08): https://sieradenkoningin.goosebumpsevents.workers.dev — `PUBLIC_STAGING=1` (noindex,
staging notice), DEMO products, simulated payments/e-mails/labels. Neon project `sieradenkoningin`
(`rapid-dawn-54238519`, aws-eu-central-1): Postgres + private object-storage bucket `sieradenkoningin-media`
(S3 API; media and uploads are proxied through the Worker while `PUBLIC_MEDIA_URL` is empty).

1. Secrets: `npx wrangler secret bulk <file.json>` or `wrangler secret put <NAME>` — DATABASE_URL (Neon _pooled_
   URL, `sslmode=require`, no `channel_binding`), SESSION_SECRET, TOTP_ENC_KEY, CRON_SECRET, STORAGE_* (from
   `neon env pull -s object-storage`: AWS_ENDPOINT_URL_S3 → STORAGE_ENDPOINT, AWS_* keys, bucket name) and the
   provider keys from `.env.example`.
2. `npm run db:migrate` against the Neon _direct_ URL, then `npm run db:seed` (`-- --no-demo` for production).
3. `npx wrangler deploy` (runs `npm run build` first via `build.command`; Cloudflare Workers Builds: build command
   empty, deploy command `npx wrangler deploy`, root `/`) — `wrangler.jsonc` deploys `cloudflare/worker.js`, which wraps the
   SvelteKit worker and runs the Cron Trigger (`/api/jobs` every 5 min; the 05:00 UTC tick also runs the daily jobs).
   Public vars (`PUBLIC_SITE_URL`, `PUBLIC_STAGING`) live in `wrangler.jsonc` → `vars`.

See `docs/RUNBOOK.md` part 2 for rollbacks, secret rotation, backups and monitoring.

## Project layout

```
src/routes/[lang=lang]/(shop)/   storefront (localized URLs, see src/lib/i18n/paths.ts)
src/routes/admin/                 back office (Dutch UI, role-based, mandatory 2FA)
src/routes/api/                   cart, search, wishlist, webhooks (Mollie, Sendcloud), jobs, health
src/lib/server/services/          business logic (catalog, cart, checkout, orders, refunds, invoices …)
src/lib/server/adapters/          storage, payments, shipping, email, newsletter (+ mocks)
src/lib/components/               ui primitives · storefront · admin · CMS blocks · email templates
messages/<area>/{nl,fr}.json      translations (Paraglide)
drizzle/                          SQL migrations
tests/unit · tests/e2e            Vitest · Playwright
```
