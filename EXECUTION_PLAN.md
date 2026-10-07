# EXECUTION_PLAN.md — Sieradenkoningin Online Store & Admin CMS

> Machine-oriented execution plan. Written so an AI coding agent (Claude Code or similar) can build the
> project task by task with minimal ambiguity.
> Human-readable version: the "Development Plan — Sieradenkoningin Online Store & Admin CMS" doc.
> Version 1.0 · 2026-10-07 · Target go-live **2027-02-08** (Valentine campaign).

---

## 0. Agent operating protocol (READ FIRST, EVERY SESSION)

### 0.1 Read order at session start
1. This file, sections 0–4 completely, then the **Progress log** (§12) to see where work stopped.
2. `docs/DESIGN_SYSTEM.md` (until P0-02 is done it lives at `design-system/DESIGN_SYSTEM.md`).
3. Only the files listed under the task you are about to execute.

### 0.2 Picking the next task
- Pick the **first unchecked task** in §9 whose `Depends` are all checked and whose `Type` is `DEV`.
- Tasks of type `HUMAN` are done by the project owner. Never attempt them. If a `DEV` task is blocked
  by an unchecked `HUMAN` task, use the **fallback** written in that task (mock, test keys, adapter
  stub). If there is no fallback, stop and report.
- Work on **one task at a time**. Never start the next task while the current one fails verification.

### 0.3 Per-task loop
1. Restate the task's acceptance criteria to yourself and list the files you will touch.
2. Before using any SvelteKit / Svelte / Tailwind / Drizzle API, **check the installed version's
   types** (e.g. `node_modules/@sveltejs/kit/types/index.d.ts`). SvelteKit 3 differs from SvelteKit 2.
   Do not rely on memory of older versions (see §2.1).
3. Implement. Keep the diff limited to the task's scope.
4. Write or extend the tests named in the task.
5. Run the **Verify** commands. All must pass (§10).
6. Tick the task's checkbox in §9, tick each satisfied acceptance item, and append one line to §12.
7. Commit: `<TASK-ID>: <imperative summary>` (e.g. `P1-07: add product detail page`).

### 0.4 Stop and ask the human when
- A secret, API key, account, domain or payment credential is needed and no test/mocked fallback exists.
- A decision in §4 marked `BLOCKING` is still `OPEN` for the task at hand.
- Legal text (terms, privacy, withdrawal form) must be written. Create the page with a clearly marked
  placeholder slot instead; never invent legal content.
- A requirement in this file contradicts the codebase or another requirement.
- Verification fails 3 times on the same cause.

### 0.5 Never
- Never commit secrets, `.env` files or real customer data.
- Never disable a test, a type check or a lint rule to make a task pass.
- Never use hard-coded hex colours in components; use tokens (§2.3).
- Never invent product data, prices, legal texts or brand copy for production. Seed/demo data must be
  obviously fake (prefix `DEMO`).
- Never build features from a later phase "while you're at it".

---

## 1. Project context (facts the agent must respect)

| Key | Value |
|---|---|
| Brand | Sieradenkoningin ("Jewelry Queen"). Tagline: *More than jewelry — it's a state of mind.* |
| Keywords | Elegant, feminine, luxurious, timeless, empowering, modern, high quality, accessible luxury, for every day, *met betekenis* |
| Market | Belgium (B2C). Ship-to at launch: **BE** (NL/LU pending decision D3) |
| Languages | `nl` (default, nl-BE), `fr` (fr-BE). `en` prepared but not shipped (V2) |
| Currency / tax | EUR, prices **VAT-inclusive**, standard VAT **21%**. Money stored as **integer cents** |
| Categories | rings/Ringen/Bagues · bracelets/Armbanden/Bracelets · necklaces/Kettingen/Colliers · earrings/Oorbellen/Boucles d'oreilles · sets/Sets/Parures · accessories/Accessoires/Accessoires |
| Variants | metal (`gold`, `rosegold`, `silver`) × size (ring sizes, bracelet S/M/L) → SKU |
| Stack | SvelteKit **3.0.x**, Svelte **5** (runes), Tailwind CSS **4**, Drizzle ORM 0.45+, zod 4, `@sveltejs/adapter-cloudflare` 8 |
| Runtime | Cloudflare Workers (+ Images, Cron Triggers, Queues, Turnstile) |
| Database | Neon PostgreSQL, **EU region**, pooled connection, branch per preview |
| Object storage | S3-compatible (Neon object storage per brief; **Cloudflare R2 is the fallback**, see D7) |
| Payments | Mollie (default, D1): Bancontact, cards, Apple Pay, Google Pay, KBC/CBC |
| Shipping | Sendcloud (default, D2): bpost home delivery, pickup points, labels, tracking |
| Existing assets | `design-system/`: tokens, brand icons, 11 components, schema draft, upload flow, previews |

---

## 2. Non-negotiable conventions

### 2.1 SvelteKit 3 specifics (verified against 3.0.1)
- Config lives in `vite.config.ts` → `sveltekit({ adapter: adapter(), ... })`. **No `svelte.config.js`**
  (SvelteKit 3 throws `config_file_unsupported`).
- `$lib` is removed. Use **`#lib/...`** via `package.json`:
  `"imports": { "#lib": "./src/lib", "#lib/*": "./src/lib/*" }`.
- Imports of `.ts` files use the **explicit extension**: `import { x } from '#lib/utils/format.ts'`.
  Svelte stores as runes live in `*.svelte.ts` → `'#lib/stores/cart.svelte.ts'`.
- `tsconfig.json` must `"extends": "$app/tsconfig"`. Do not override `types` without keeping `"$app/types"`.
- Env vars: declared in `src/env.ts` with `defineEnvVars` from `@sveltejs/kit/env`. Read private ones with
  `import * as env from '$app/env/private'` and public ones from `'$app/env/public'`.
  (`$env/*` modules are removed.)
- `Handle` type is imported from `@sveltejs/kit/hooks`.
- `goto()` options: `{ replace, reset, refreshAll, invalidate, state }` (no `keepFocus` / `noScroll`).
- `$service-worker` is removed (use `$app/manifest`, `$app/env`, `$app/paths`).
- **Remote functions are experimental** (`experimental.remoteFunctions`) → **do not use**. Use
  `+page.server.ts` form actions + `use:enhance`, and `+server.ts` endpoints.

### 2.2 Svelte 5
- Runes only: `$props`, `$state`, `$derived`, `$effect`, `$bindable`, snippets + `{@render}`.
  No `export let`, no `<slot>`, no `svelte/store` for new code.
- Types shared between components live in `src/lib/types.ts` (instance scripts can't export types).
- **No module-level mutable state** (Workers share modules across requests). Per-request state goes
  through context (`setContext`/`getContext`), as in `cart.svelte.ts`.

### 2.3 Styling
- Tokens: `src/lib/styles/tokens.css` (primitives `--sk-*`, semantic `--ui-*`, scales `--fs-*`,
  `--space-*`, `--elev-*`, `--r-*`, `--motion-*`, `--dur-*`). Components use **semantic tokens only**.
- Contexts: `data-surface="inverse"` (burgundy), `data-surface="espresso"`, `data-theme="admin"`.
- Tailwind v4 is for **route-level layout only**. Inside a component, responsive or visibility rules go in
  the scoped `<style>` with media queries. Svelte scoped CSS is unlayered and beats Tailwind's
  `@layer utilities`, so `class="lg:hidden"` on an element with scoped `display` silently fails.
- The custom utility is `eyebrow`, not `overline` (`overline` collides with Tailwind's built-in).
- Fonts are self-hosted via `@fontsource` (no Google Fonts CDN, for GDPR).
- Allura (script font): at most one word per viewport, ≥ 28px, never body text.
- Contrast: Soft Camel (`#B89985`) is **never** text on cream; Warm Cognac is **never** text on burgundy.

### 2.4 Data & server
- Database access only through `event.locals.db` (created per request in `hooks.server.ts`).
- Drizzle + `drizzle-orm/neon-http`. Multi-statement writes use `db.batch([...])`. Interactive
  transactions (checkout stock reservation, order creation) use `Pool` from `@neondatabase/serverless`,
  opened and closed inside the request.
- Money = integer cents everywhere (DB, API, props). Format only at render via `formatPrice()`.
- Translatable text = `jsonb { nl: string, fr?: string, en?: string }` typed as `I18n`.
- All timestamps `timestamptz`, stored in UTC, rendered in `Europe/Brussels`.
- Server-only code lives in `src/lib/server/**` (enforced by SvelteKit).
- Validation: zod schemas in `src/lib/schemas/*.ts`, shared by client and server.
- Every admin mutation writes an `audit_log` row (actor, action, entity, entity_id, diff jsonb).
- External services sit behind **adapters** (`src/lib/server/adapters/{payments,shipping,email,newsletter,storage}.ts`)
  with a `mock` implementation selected when keys are absent. This keeps tests and previews running
  without credentials.

### 2.5 i18n & copy
- Paraglide JS. Message files `messages/nl.json`, `messages/fr.json`. **No hard-coded UI strings** in
  components; use the `m.*()` functions.
- URL scheme: `/{lang}/{localized-segments}`. Root `/` redirects by `Accept-Language` (nl default).
  Every page renders `<link rel="alternate" hreflang>` for nl-BE, fr-BE and x-default.
- Prefer Paraglide's built-in localized-URL support if the installed version provides it. Otherwise use
  SvelteKit's `reroute` hook with the map in `src/lib/i18n/paths.ts`.

### 2.6 Quality bars
- TypeScript strict. `svelte-check` = **0 errors, 0 warnings**.
- A11y: WCAG 2.2 AA, 44×44px targets, visible focus, native `<dialog>` for modals and drawers, labels on
  every input, status never conveyed by colour alone.
- Performance: LCP < 2.0s (4G), CLS < 0.05, INP < 200ms, storefront JS < 90 kB gzip, Lighthouse ≥ 90.
- Security: CSP, `HttpOnly; Secure; SameSite=Lax` cookies, CSRF via SvelteKit defaults, Turnstile on
  public forms, rate-limited auth endpoints, role checks in **every** admin `load` and action.

---

## 3. Definition of Done (applies to every DEV task)
- [ ] Acceptance criteria of the task are all met.
- [ ] `npm run check` (svelte-check), `npm run lint`, and `npm run test` pass.
- [ ] New UI works at **390px, 768px and 1440px** widths, keyboard-only, and in both NL and FR.
- [ ] No hard-coded strings, hex colours or `$lib` imports added.
- [ ] Admin mutations write `audit_log`; admin routes check role permissions.
- [ ] Task checkbox ticked in §9 and a line appended to §12.

---

## 4. Decision register

The agent proceeds with the **Default** unless the status is `BLOCKING`. Once the human decides, the
agent updates this table.

| ID | Decision | Default the agent uses | Status | Blocks |
|---|---|---|---|---|
| D1 | Payment provider | Mollie behind `payments` adapter | OPEN (default OK) | P2-06 live keys only |
| D2 | Shipping integration | Sendcloud behind `shipping` adapter | OPEN (default OK) | P3-05 live keys only |
| D3 | Ship-to countries at launch | BE only; zones table supports NL, LU | OPEN (default OK) | — |
| D4 | Return window | 14 days (legal minimum), stored in `settings.return_days` | OPEN (default OK) | P4-03 copy |
| D5 | Email: transactional / marketing | Postmark / Brevo behind `email` + `newsletter` adapters | OPEN (default OK) | P2-08 live keys only |
| D6 | B2B / wholesale or physical store | Not in scope; optional VAT number at checkout only | OPEN (default OK) | — |
| D7 | Object storage vendor | S3-compatible adapter; R2 if Neon storage is not S3-compatible | OPEN (default OK) | P0-05 |
| D8 | Domain & default language | `nl` default; domain from env `PUBLIC_SITE_URL` | **BLOCKING** for P5-07 | P5-07 |
| D9 | Free-shipping threshold & rates | €50 threshold (`settings`), BE home €4.95, pickup €3.95 (placeholders) | OPEN (default OK) | P5-07 must confirm |

---

## 5. Target repository layout

```
/
├── EXECUTION_PLAN.md            # this file
├── docs/
│   ├── DESIGN_SYSTEM.md         # moved from design-system/ in P0-02
│   ├── RUNBOOK.md               # P5-05
│   └── brand/                   # brand_*.md + brand_identity_*.jpg (moved in P0-02)
├── messages/ nl.json fr.json    # Paraglide
├── drizzle/                     # generated migrations
├── drizzle.config.ts
├── static/                      # favicons, robots fallback, category icon exports
├── tests/
│   ├── unit/                    # vitest (*.test.ts)
│   └── e2e/                     # playwright (*.spec.ts)
├── src/
│   ├── app.css  app.d.ts  app.html  env.ts
│   ├── hooks.server.ts          # services, auth, admin guard, security headers, maintenance
│   ├── hooks.ts                 # reroute (localized paths) if needed
│   ├── lib/
│   │   ├── styles/tokens.css
│   │   ├── types.ts
│   │   ├── schemas/             # zod: product, checkout, address, auth, discount, page-block …
│   │   ├── i18n/                # paths.ts, helpers (localizeHref, hreflang)
│   │   ├── utils/               # format.ts, money.ts, slug.ts, images.ts (srcset)
│   │   ├── stores/              # *.svelte.ts rune classes via context
│   │   ├── actions/             # reveal.ts, clickOutside.ts
│   │   ├── components/
│   │   │   ├── ui/              # primitives (Button, Icon, Field, Input, Dialog, Toast …)
│   │   │   ├── storefront/      # SiteHeader, Hero, ProductCard, CartDrawer, ProductGrid …
│   │   │   ├── blocks/          # CMS block renderers (HeroBlock, ProductRailBlock …)
│   │   │   ├── email/           # email templates as Svelte components
│   │   │   └── admin/           # AdminSidebar, DataTable, StatCard, ImageUploader, ProductForm …
│   │   └── server/
│   │       ├── db/ index.ts schema.ts seed.ts
│   │       ├── auth/ password.ts session.ts totp.ts guard.ts
│   │       ├── adapters/ payments.ts shipping.ts email.ts newsletter.ts storage.ts
│   │       ├── services/ catalog.ts cart.ts checkout.ts orders.ts inventory.ts pricing.ts
│   │       │             discounts.ts invoices.ts search.ts content.ts reports.ts audit.ts
│   │       └── jobs/            # cron + queue handlers
│   └── routes/
│       ├── [lang=lang]/(shop)/… # storefront (see §7)
│       ├── api/…                # cart, webhooks, uploads
│       ├── admin/…              # back office (see §7)
│       ├── sitemap.xml/+server.ts
│       └── robots.txt/+server.ts
├── wrangler.jsonc
└── .github/workflows/ci.yml
```

---

## 6. Data model (target, built in P0-06)

Rules: uuid PKs (`defaultRandom()`), `created_at`/`updated_at` timestamptz, money in cents (int),
`I18n` jsonb for translatable fields, soft delete via `status`/`archived_at` where noted.

| Table | Key columns | Notes |
|---|---|---|
| `categories` | id, slug (unique per lang in `slugs` jsonb), name I18n, description I18n, icon, position | Seeded with the 6 categories |
| `products` | id, slug, name I18n, description I18n, meaning I18n, material, category_id, status (draft/active/archived), price, compare_at_price, featured, seo jsonb, engravable bool, gpsr jsonb (manufacturer info) | `slug` unique |
| `price_history` | product_id, price, valid_from | Feeds the Omnibus "lowest price in 30 days" rule |
| `variants` | id, product_id, sku (unique), metal, size, price_override, stock, low_stock_threshold, position | |
| `product_images` | id, product_id, media_id, alt I18n, position | First image = primary |
| `media` | id, storage_key, mime, width, height, bytes, alt I18n | Media library |
| `collections` | id, slug, name I18n, type (manual/rule), rule jsonb, seo jsonb, hero media_id | |
| `collection_products` | collection_id, product_id, position | Manual collections |
| `product_relations` | product_id, related_id, kind (related/complete_set) | |
| `stock_movements` | id, variant_id, delta, reason (sale/return/adjust/import/reservation_release), ref_id, actor | |
| `stock_reservations` | id, variant_id, cart_id, qty, expires_at | 15-minute TTL |
| `customers` | id, email (unique, citext), password_hash, first/last name, phone, locale, email_verified_at, marketing_opt_in, birthday | |
| `addresses` | id, customer_id, name, line1, line2, postal_code, city, country, phone, is_default | |
| `sessions` | id (hashed token), user_type (customer/admin), user_id, expires_at, ip, ua | |
| `magic_links` | token_hash, email, expires_at, used_at | |
| `wishlists` | id, customer_id nullable, guest_token nullable, product_id, variant_id | Merged into the account on login |
| `stock_alerts` | id, email, variant_id, locale, notified_at | Back-in-stock |
| `carts` | id, token (cookie), customer_id, locale, discount_code, updated_at | |
| `cart_lines` | id, cart_id, variant_id, qty, gift_wrap, engraving jsonb | |
| `orders` | id, number (SK-YYYY-NNNNNN), customer_id, email, locale, status, subtotal, discount_total, shipping_total, vat_total, total, currency, shipping_address jsonb, billing_address jsonb, vat_number, shipping_method, gift_message, payment_status, invoice_number, placed_at | Number from a sequence |
| `order_lines` | id, order_id, variant_id, sku, name snapshot I18n, unit_price, qty, vat_rate, line_total, engraving | Snapshots, never joined live for display |
| `order_events` | id, order_id, type, data jsonb, actor, created_at | Timeline |
| `payments` | id, order_id, provider, provider_ref, method, amount, status, raw jsonb | |
| `refunds` | id, order_id, payment_id, amount, reason, provider_ref, status, actor | |
| `shipments` | id, order_id, carrier, service_point jsonb, label_key, tracking_number, tracking_url, status | |
| `returns` / `return_lines` | id, order_id, status, reason, label_key / order_line_id, qty, condition | V1 portal; table created in P0-06 |
| `discounts` | id, code (unique, upper), type (percent/amount/free_shipping), value, min_subtotal, starts_at, ends_at, usage_limit, per_customer_limit, active | |
| `discount_redemptions` | discount_id, order_id, customer_id/email | |
| `gift_cards` / `gift_card_transactions` | code_hash, initial, balance, expires_at, recipient… / delta, order_id | V1 |
| `reviews` | id, product_id, order_line_id, customer_id, rating 1–5, title, body, media, status, reply | V1 |
| `pages` | id, slug, type (home/page/legal/landing), title I18n, seo jsonb, status, publish_at | |
| `page_blocks` | id, page_id, type, data jsonb, position, visible_from, visible_until | Block types in P4-01 |
| `menus` | id, key (main/footer_shop/footer_help/footer_legal), items jsonb | |
| `faqs` | id, question I18n, answer I18n, group, position | |
| `articles` | id, slug, title I18n, body I18n, cover media_id, status, published_at | V1 Journal |
| `redirects` | from_path (unique), to_path, code | |
| `newsletter_subscribers` | email, locale, status (pending/confirmed/unsubscribed), token, source | |
| `admin_users` | id, email, name, password_hash, role, totp_secret (encrypted), last_login_at, active | |
| `audit_log` | id, actor_id, action, entity, entity_id, diff jsonb, ip, created_at | Append-only |
| `email_log` | id, to, template, locale, provider_id, status, created_at | |
| `settings` | key (pk), value jsonb | Store info (KBO/VAT), shipping, thresholds, return_days, maintenance |
| `shipping_zones` / `shipping_rates` | country list / zone_id, method (home/pickup), price, free_from | |

Postgres extensions: `citext`, `pg_trgm`, `unaccent`. Search uses a generated `tsvector` per language
(`dutch`, `french` configs).

---

## 7. Route map

Internal routes are in English under `[lang=lang]`. Public paths are localized.

### 7.1 Storefront
| Internal route | NL path | FR path | Phase |
|---|---|---|---|
| `/` | `/nl` | `/fr` | P1 |
| `/c/[category]` | `/nl/ringen` … | `/fr/bagues` … | P1 |
| `/collections/[slug]` | `/nl/collectie/nieuw` | `/fr/collection/nouveautes` | P1 |
| `/p/[slug]` | `/nl/p/klaver-ring` | `/fr/p/bague-trefle` | P1 |
| `/search` | `/nl/zoeken` | `/fr/recherche` | P1 |
| `/wishlist` | `/nl/verlanglijst` | `/fr/liste-de-souhaits` | P1 |
| `/cart` | `/nl/winkelmand` | `/fr/panier` | P2 |
| `/checkout` | `/nl/afrekenen` | `/fr/commande` | P2 |
| `/checkout/thanks/[number]` | `/nl/bedankt/…` | `/fr/merci/…` | P2 |
| `/track` | `/nl/bestelling-volgen` | `/fr/suivi-commande` | P3 |
| `/account/login` · `/register` · `/forgot` · `/reset/[token]` | `/nl/account/inloggen` … | `/fr/compte/connexion` … | P3 |
| `/account` · `/orders` · `/orders/[number]` · `/addresses` · `/settings` | `/nl/account/…` | `/fr/compte/…` | P3 |
| `/account/returns` | `/nl/account/retouren` | `/fr/compte/retours` | V1 |
| `/page/[slug]` (Ons verhaal, Maatgids, Materiaal & onderhoud, Verzending, Retourneren) | `/nl/ons-verhaal` … | `/fr/notre-histoire` … | P4 |
| `/faq` · `/contact` | `/nl/faq` · `/nl/contact` | `/fr/faq` · `/fr/contact` | P4 |
| `/legal/[slug]` (voorwaarden, privacy, cookies, herroeping, wettelijke-vermeldingen, toegankelijkheid) | `/nl/voorwaarden` … | `/fr/conditions` … | P4 |
| `/journal` · `/journal/[slug]` · `/lookbook` · `/gift-guide` · `/gift-cards` | `/nl/journal` … | `/fr/journal` … | V1 |

Category slugs: nl `ringen, armbanden, kettingen, oorbellen, sets, accessoires` · fr `bagues, bracelets, colliers, boucles-d-oreilles, parures, accessoires`.

### 7.2 API & system
`/api/cart` (GET/POST/PATCH/DELETE) · `/api/webhooks/mollie` · `/api/webhooks/sendcloud` ·
`/admin/api/uploads` · `/sitemap.xml` · `/robots.txt` · `+error.svelte` (404/500) · maintenance via hook.

### 7.3 Admin (`/admin`, Dutch UI, `data-theme="admin"`)
`/admin/login` · `/admin` (dashboard) · `/admin/orders` · `/admin/orders/[id]` · `/admin/products` ·
`/admin/products/[id]` (`nieuw` = create) · `/admin/categories` · `/admin/collections` ·
`/admin/collections/[id]` · `/admin/inventory` · `/admin/media` · `/admin/customers` ·
`/admin/customers/[id]` · `/admin/discounts` · `/admin/content/pages` · `/admin/content/pages/[id]` ·
`/admin/content/menus` · `/admin/content/faq` · `/admin/reports` · `/admin/settings/{store,shipping,payments,emails,legal,redirects}` ·
`/admin/users` · `/admin/audit` · `/admin/import` · V1: `/admin/returns`, `/admin/reviews`, `/admin/gift-cards`.

### 7.4 Role permissions
| Permission | owner | editor | fulfilment | support |
|---|---|---|---|---|
| Dashboard, reports | ✓ | – | – | – |
| Products, categories, collections, media, content | ✓ | ✓ | read | read |
| Inventory | ✓ | ✓ | ✓ | read |
| Orders: view / fulfil | ✓ | read | ✓ | ✓ |
| Orders: refund | ✓ | – | – | ✓ |
| Customers | ✓ | – | read | ✓ |
| Discounts | ✓ | ✓ | – | – |
| Settings, users, audit log | ✓ | – | – | – |

Implement as a `can(role, permission)` map in `src/lib/server/auth/guard.ts`, enforced in `load` and in
every action. Test it in `tests/unit/guard.test.ts`.

---

## 8. Milestones & gates

| Gate | Week | Date (end) | Gate check (all must be true) |
|---|---|---|---|
| G0 Foundation | 1–2 | 2026-10-30 | CI green; preview deploy with Neon branch; admin login + 2FA works; design system builds in the app |
| G1 Catalog | 3–5 | 2026-11-20 | Owner can upload 20 real products via admin; they appear in NL+FR on category, search and PDP |
| G2 Checkout | 6–8 | 2026-12-11 | Test order paid via Bancontact (Mollie test mode); stock decremented; confirmation email logged |
| G3 Operations | 9–11 | 2027-01-08 | Order processed paid → label → shipped → refunded entirely from admin; customer sees it in account |
| G4 Content | 12–13 | 2027-01-22 | All MVP pages have final NL/FR copy; Lighthouse ≥ 90 on home, category, PDP, checkout |
| G5 Launch-ready | 14–15 | 2027-02-05 | 0 critical/high bugs; UAT signed; cutover checklist (P5-07) complete |
| 🚀 Launch | 16 | **2027-02-08** | Live with Valentine campaign |
| V1 | 17–22 | 2027-03-26 | See §9.6 |

---

## 9. Task backlog

Task format: **ID · Title** — Type (`DEV` | `HUMAN`) · Depends · Estimate (ideal dev-days), then Files,
Do, Accept and Verify.

### 9.0 Phase 0 — Foundation (weeks 1–2)

- [ ] **P0-01 · Scaffold SvelteKit 3 app at repo root** — DEV · Depends: — · 0.5d
  - Files: `package.json`, `vite.config.ts`, `tsconfig.json`, `wrangler.jsonc`, `src/app.html`, `.gitignore`, `.nvmrc` (Node 22), `.env.example`
  - Do: init a SvelteKit 3 + TS project; add `#lib` imports; `sveltekit({ adapter: adapter() })` + `@tailwindcss/vite`; `<html lang="%lang%">` placeholder for i18n; wrangler compatibility date = today, `nodejs_compat` flag.
  - Accept: [ ] `npm run build` succeeds · [ ] `npm run dev` serves `/` · [ ] no `svelte.config.js` exists
  - Verify: `npm run build && npm run check`

- [ ] **P0-02 · Integrate the existing design system** — DEV · Depends: P0-01 · 0.5d
  - Files: move `design-system/src/**` → `src/**` (merge, don't overwrite P0-01 files blindly); `design-system/DESIGN_SYSTEM.md` → `docs/DESIGN_SYSTEM.md`; `design-system/previews` → `docs/previews`; `design-system/assets/icons` → `static/brand/icons`; root `brand_*.md|jpg` → `docs/brand/`
  - Do: install `@fontsource-variable/playfair-display @fontsource-variable/montserrat @fontsource/allura`, import them in the root layout; delete the emptied `design-system/` folder only after the build passes.
  - Accept: [ ] all existing components compile · [ ] `svelte-check` 0 errors · [ ] a temporary `/dev/kitchen-sink` route renders Button, Icon (all 6 category icons), ProductCard, CartDrawer, DataTable, StatCard (route guarded to `dev` only)
  - Verify: `npm run check && npm run build`

- [ ] **P0-03 · Tooling & scripts** — DEV · Depends: P0-01 · 0.5d
  - Files: `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, `playwright.config.ts`, `package.json` scripts
  - Scripts: `dev, build, preview, check, lint, format, test, test:e2e, db:generate, db:migrate, db:seed, db:studio`.
  - Playwright projects: `chromium-desktop` (1440), `webkit-mobile` (390), `chromium-tablet` (768). Chromium path: `/opt/pw-browsers/chromium` if present, otherwise default.
  - Accept: [ ] one passing sample unit test and one passing e2e smoke test (`/` returns 200)

- [ ] **P0-04 · CI pipeline** — DEV · Depends: P0-03 · 0.5d
  - Files: `.github/workflows/ci.yml`
  - Do: on PR → install, lint, check, unit, build; on preview deploy → e2e against the preview URL. Cache npm.
  - Accept: [ ] workflow file valid (`actionlint` if available) · [ ] documents required repo secrets in comments

- [ ] **P0-05 · Provision cloud accounts & secrets** — HUMAN · Depends: — · —
  - Owner creates: Cloudflare account + Workers paid plan, Neon project (EU region, pooled URL), object storage bucket + keys (D7), GitHub repo, Sentry project.
  - Secrets: `DATABASE_URL`, `STORAGE_*`, `PUBLIC_MEDIA_URL`, `SESSION_SECRET`, `TOTP_ENC_KEY`.
  - **Agent fallback until done:** local Postgres via `docker compose` (or a Neon free branch if provided), storage `mock` adapter writing to `.data/uploads`.

- [ ] **P0-06 · Full database schema, migration, seed** — DEV · Depends: P0-02 · 2d
  - Files: `src/lib/server/db/schema.ts`, `drizzle.config.ts`, `drizzle/*`, `src/lib/server/db/seed.ts`
  - Do: implement every table in §6 with indexes (FKs, `products(category_id,status)`, `orders(status,placed_at)`, trigram index on product names), sequences for order and invoice numbers, extensions. Seed: 6 categories (NL/FR names + slugs), settings defaults (D3, D4, D9), shipping zone BE, one owner admin (email from env `SEED_ADMIN_EMAIL`, random password printed once), 24 `DEMO` products (4 per category) with placeholder images from `static/brand/placeholder.svg`.
  - Accept: [ ] `db:migrate` on an empty DB succeeds · [ ] `db:seed` is idempotent · [ ] unit test asserts that money columns are integers
  - Verify: `npm run db:migrate && npm run db:seed && npm run test`

- [ ] **P0-07 · i18n & localized routing** — DEV · Depends: P0-02 · 1.5d
  - Files: `project.inlang/`, `messages/{nl,fr}.json`, `src/lib/i18n/*`, `src/params/lang.ts`, `src/hooks.ts`
  - Do: Paraglide setup; `[lang=lang]` matcher (`nl|fr`); localized path map (§7.1); `localizeHref(path, lang)`; language switcher in the header that keeps the current page; `hreflang` + `x-default`; root `/` → negotiated redirect (302) with a cookie remembering the choice.
  - Accept: [ ] `/nl/ringen` and `/fr/bagues` resolve to the same route · [ ] switcher round-trips on 5 sample routes · [ ] unit tests for the path map in both directions

- [ ] **P0-08 · Layouts: shop + admin shells** — DEV · Depends: P0-07 · 1.5d
  - Files: `src/routes/[lang=lang]/(shop)/+layout.{svelte,server.ts}`, `src/routes/admin/+layout.{svelte,server.ts}`, new `storefront/SiteFooter.svelte`, `storefront/MegaMenu.svelte`, `admin/AdminTopbar.svelte`
  - Do: shop layout = announcement (from `settings`) + SiteHeader (overlay on home only) + slot + SiteFooter + CartDrawer + Toast region. Footer per DESIGN_SYSTEM §2.1 (newsletter form stub, 4 link columns from `menus`, payment marks with Bancontact first, language switch, legal links). Admin layout = `data-theme="admin"` grid with AdminSidebar (collapse cookie) + AdminTopbar (mobile menu button, breadcrumbs, "Bekijk winkel").
  - Accept: [ ] shells render at 390/768/1440 · [ ] mobile menu, mega menu and footer accordion are keyboard-operable

- [ ] **P0-09 · Admin authentication, 2FA, roles, audit** — DEV · Depends: P0-06 · 2d
  - Files: `src/lib/server/auth/{password,session,totp,guard}.ts`, `src/lib/server/services/audit.ts`, `src/routes/admin/login/*`, `src/hooks.server.ts`
  - Do: password hashing with Argon2id via a WASM lib (e.g. `hash-wasm`). Measure CPU time on Workers; if over the plan limit, switch to scrypt with OWASP parameters and document why. Sessions: random 32-byte token, store SHA-256 hash, cookie `sk_admin` HttpOnly/Secure/SameSite=Strict, 12h idle and 7d absolute expiry. TOTP 2FA mandatory (enrol on first login, encrypted secret, recovery codes). Login rate limit: 5 attempts per 15 min per IP+email. `can()` permission map (§7.4); extend the `App.Locals.admin.role` union in `app.d.ts` with `support`. `audit()` helper. Replace the `getAdminSession` placeholder.
  - Accept: [ ] unit tests: hash/verify, session expiry, permission matrix, TOTP window · [ ] e2e: login → 2FA enrol → dashboard → logout · [ ] unauthenticated `/admin/*` redirects; `/admin/api/*` returns 401

- [ ] **P0-10 · Security headers, errors, maintenance** — DEV · Depends: P0-08 · 0.5d
  - Do: CSP (self + Mollie + Cloudflare Turnstile + analytics hosts), HSTS, Referrer-Policy, Permissions-Policy; branded `+error.svelte` (404/500, NL/FR); maintenance mode from `settings.maintenance` (admins bypass) returning 503 with `Retry-After`.
  - Accept: [ ] headers asserted in an e2e test · [ ] maintenance page renders and admins bypass it

- [ ] **P0-11 · Remaining UI primitives** — DEV · Depends: P0-02 · 2d
  - Files: `src/lib/components/ui/{Field,Input,Select,Checkbox,Radio,Textarea,Dialog,Drawer,Toast,Skeleton,Tooltip,Badge,Tabs,Accordion,Breadcrumbs,Pagination,EmptyState,ConfirmDialog,QuantityStepper}.svelte`
  - Do: follow DESIGN_SYSTEM §2.4. Storefront inputs are 48px tall with a bottom border; admin inputs are 40px with a full border (via `[data-theme=admin]`). Field wires label, hint and error with `aria-describedby`. Dialog and Drawer use native `<dialog>`.
  - Accept: [ ] each primitive rendered on the kitchen-sink route · [ ] axe shows no violations on the kitchen sink

**Gate G0** — tick when all P0 DEV tasks are done and the §8 G0 check passes. [ ]

### 9.1 Phase 1 — Catalog & products (weeks 3–5)

- [ ] **P1-01 · Admin product list & product form** — DEV · Depends: P0-09, P0-11 · 3d
  - Files: `src/routes/admin/products/**`, `src/lib/components/admin/{ProductForm,VariantTable,I18nTabs,SeoFields,SaveBar}.svelte`, `src/lib/schemas/product.ts`, `src/lib/server/services/catalog.ts`
  - Do: list = DataTable with search, status/category filters, server-side sort and paging. Form = NL/FR tabs (name, description, meaning), category, material, price/compare-at in €, status, featured, engravable, GPSR fields, SEO (title, description, slug with auto-slugify), ImageUploader (alt text NL required, FR optional), variant matrix (metal × size → SKU, stock, price override). Sticky save bar with unsaved-change detection. Duplicate and archive actions. Writing `price` appends to `price_history`. Activating a product requires ≥ 1 image with alt text and ≥ 1 variant.
  - Accept: [ ] create/edit/duplicate/archive work without JS (progressive enhancement) · [ ] validation errors show inline in NL · [ ] audit rows written · [ ] e2e `admin-product.spec.ts`

- [ ] **P1-02 · Admin categories, collections, relations** — DEV · Depends: P1-01 · 1.5d
  - Do: category edit (names, slugs per language, description, SEO, order). Collections: manual (drag order) or rule-based (`{category?, tag?, new_within_days?, on_sale?, price_lt?}`). Product relations editor (related, complete-the-set) on the product form.
  - Accept: [ ] rule collection "Nieuw" auto-lists products created in the last 30 days · [ ] unit tests for the rule evaluator

- [ ] **P1-03 · Media library** — DEV · Depends: P1-01 · 1d
  - Do: grid of `media` with search, alt text editing, usage count, delete only when unused (deletion queued to storage).
  - Accept: [ ] images uploaded in the product form appear in the library · [ ] used media cannot be deleted

- [ ] **P1-04 · Inventory & CSV import/export** — DEV · Depends: P1-01 · 1.5d
  - Do: `/admin/inventory` = variant-level table with inline stock adjust (reason required → `stock_movements`), low-stock filter. `/admin/import`: CSV template download; dry-run preview showing creates/updates/errors; commit. Export products+variants+stock CSV.
  - Accept: [ ] importing 50 rows dry-runs and commits with per-row errors · [ ] stock never goes negative (DB check constraint)

- [ ] **P1-05 · Image delivery helper** — DEV · Depends: P0-06 · 0.5d
  - Files: `src/lib/utils/images.ts`
  - Do: `srcset(key, widths=[400,800,1200,1600])` producing Cloudflare Image Transformation URLs (`/cdn-cgi/image/width=…,format=auto,quality=82/<PUBLIC_MEDIA_URL>/<key>`); a dev fallback serves originals.
  - Accept: [ ] unit tests · [ ] ProductCard and Hero use it

- [ ] **P1-06 · Home page (static block config for now)** — DEV · Depends: P0-08, P1-05 · 2d
  - Files: `src/routes/[lang=lang]/(shop)/+page.{svelte,server.ts}`, `src/lib/components/blocks/*`, `storefront/{CategoryStrip,ProductRail,QuoteBand,EditorialSplit,UspBar,NewsletterForm}.svelte`, `src/lib/actions/reveal.ts`
  - Do: render blocks from a typed array (the same shape as `page_blocks`, so P4-01 only swaps the source): Hero (overlay) → USP bar → CategoryStrip (6 HD icons, 72px) → rail "Nieuw" → QuoteBand → EditorialSplit "Met betekenis" → rail "Bestsellers" → newsletter. `use:reveal` respects reduced motion.
  - Accept: [ ] LCP image has `fetchpriority=high` · [ ] matches DESIGN_SYSTEM spacing tokens · [ ] NL/FR

- [ ] **P1-07 · Category & collection listing** — DEV · Depends: P1-02, P1-06 · 2.5d
  - Files: `[lang=lang]/(shop)/c/[category]/*`, `collections/[slug]/*`, `storefront/{ProductGrid,FilterBar,FilterSheet,SortSelect}.svelte`, `services/catalog.ts`
  - Do: URL-param filters (metal, stone colour tag, price range, size, in stock), sort (featured, new, price ↑↓), "load more" (24 per page, real `?page=` links for SEO), breadcrumb, category intro text, empty state. On mobile, filters open in a bottom sheet with an applied-count badge. Canonical URL without filter params. Cache headers per DESIGN_SYSTEM §4.6.
  - Accept: [ ] filters combine correctly (unit tests on the query builder) · [ ] back button restores state · [ ] e2e `listing.spec.ts`

- [ ] **P1-08 · Product detail page (PDP)** — DEV · Depends: P1-07 · 3d
  - Files: `[lang=lang]/(shop)/p/[slug]/*`, `storefront/{PdpGallery,BuyBox,VariantPicker,SizeGuideDialog,PdpAccordions,RecentlyViewed}.svelte`
  - Do: gallery (desktop thumbnails + zoom; mobile scroll-snap carousel with dots). BuyBox: name, price incl. btw, sale price + lowest-30-day price note when on sale (Omnibus), metal radio group, size select with maatgids dialog, quantity, add-to-cart (disabled until P2-01; then wired), stock messaging ("Nog 2 op voorraad"), delivery promise from settings. Accordions: Details, Met betekenis, Verzending & retour, Onderhoud. Rails: complete-the-set, related, recently viewed (localStorage, try/catch). JSON-LD Product/Offer/BreadcrumbList. Variant reflected in `?variant=`.
  - Accept: [ ] switching variant updates price, stock and URL without reload · [ ] structured data validates (schema-dts types) · [ ] e2e `pdp.spec.ts`

- [ ] **P1-09 · Search** — DEV · Depends: P1-07 · 2d
  - Files: `services/search.ts`, `storefront/SearchOverlay.svelte`, `[lang=lang]/(shop)/search/*`
  - Do: generated `tsvector` columns per language + `pg_trgm` fuzzy fallback + `unaccent`. Overlay: debounced 200ms query endpoint returning 6 products + matching categories, popular searches from settings. Results page reuses ProductGrid + filters. "Geen resultaten" state suggests categories.
  - Accept: [ ] "klavr" finds "Klaver" (typo tolerance) · [ ] FR query "trèfle" works with/without accent · [ ] p95 query < 150ms on 1,000 seeded products

- [ ] **P1-10 · Wishlist (guest + account-ready)** — DEV · Depends: P1-08 · 1d
  - Do: guest token cookie (`sk_wl`, 1 year), add/remove from ProductCard and PDP, wishlist page, share link (read-only token). Merge-on-login hook prepared for P3-01.
  - Accept: [ ] works without an account · [ ] heart state is consistent across pages

- [ ] **P1-11 · Upload first 20 real products** — HUMAN · Depends: P1-01, P0-05 · —
  - Owner uploads 20 real products with photos, NL/FR texts and variants via the admin. Agent fallback: continue with `DEMO` products.

**Gate G1** [ ]

### 9.2 Phase 2 — Cart, checkout, payment (weeks 6–8)

- [ ] **P2-01 · Server cart & API** — DEV · Depends: P1-08 · 2d
  - Files: `services/cart.ts`, `src/routes/api/cart/+server.ts`, `stores/cart.svelte.ts` (wire up), shop `+layout.server.ts`
  - Do: cart identified by cookie `sk_cart`; prices **always recomputed server-side** from variants (never trust the client). API: GET, POST `{variantId, qty, giftWrap?, engraving?}`, PATCH `{lineId, qty}`, DELETE. Quantity capped by available stock (stock − active reservations). Returns `{lines, subtotal, discount, shippingEstimate, toFreeShipping}`. Add-to-cart opens the drawer and shows a toast.
  - Accept: [ ] unit tests: totals, caps, rounding · [ ] e2e: add from PDP and card, change quantity in drawer, persists on reload

- [ ] **P2-02 · Cart page, promo codes, free-shipping bar** — DEV · Depends: P2-01 · 1.5d
  - Do: full cart page (same data as the drawer) with upsell rail. Discount engine in `services/discounts.ts` (percent, amount, free shipping, min subtotal, date window, usage limits, per-customer limit). Promo field in drawer and page. Free-shipping threshold from `settings`.
  - Accept: [ ] unit tests cover every discount rule and stacking (max 1 code) · [ ] invalid or expired codes show a clear NL/FR message

- [ ] **P2-03 · Admin discounts & shipping settings** — DEV · Depends: P2-02, P0-09 · 1.5d
  - Do: `/admin/discounts` CRUD with usage stats. `/admin/settings/shipping`: zones, methods (home, pickup), prices, free-from threshold, cut-off time for "morgen in huis".
  - Accept: [ ] changes reflect in cart totals immediately · [ ] audit logged

- [ ] **P2-04 · Checkout page** — DEV · Depends: P2-02 · 3d
  - Files: `[lang=lang]/(shop)/checkout/*`, `services/checkout.ts`, `schemas/checkout.ts`, `storefront/{CheckoutForm,AddressFields,ShippingOptions,OrderSummary}.svelte`
  - Do: one page with sections Contact → Delivery address → Shipping method (home / pickup point; picker stub until P3-05) → Billing (same as delivery toggle, optional company + VAT number with BE format validation) → Gift (wrap, message ≤ 200 chars) → Payment method choice → Terms checkbox → button labelled `m.checkout_pay_obligation()` ("Bestellen met betaalverplichting"). Guest checkout by default, "log in" link. Summary sticky on desktop, collapsible on mobile. Form action validates with zod and recomputes everything server-side.
  - Accept: [ ] works with JS disabled up to the payment redirect · [ ] errors are focus-managed and announced · [ ] e2e `checkout.spec.ts` (mock payments adapter)

- [ ] **P2-05 · Stock reservation** — DEV · Depends: P2-04 · 1d
  - Do: on checkout submit, reserve stock for 15 min inside a transaction (`Pool`, `SELECT … FOR UPDATE`). Release on payment failure or expiry via cron (every 5 min). Decrement real stock only on `paid`.
  - Accept: [ ] concurrency test: two checkouts for the last unit → exactly one succeeds

- [ ] **P2-06 · Mollie payments** — DEV · Depends: P2-05 · 2d
  - Files: `adapters/payments.ts` (mollie + mock), `src/routes/api/webhooks/mollie/+server.ts`, `services/orders.ts`
  - Do: create payment (amount, description = order number, redirectUrl = thanks page, webhookUrl, locale nl_BE/fr_BE, method preselected). Webhook: receives an id → **fetches the payment from the Mollie API** (never trusts the body) → idempotent transition of the order state machine `pending → paid | failed | canceled | expired`. On `paid`: decrement stock, consume reservation, record discount redemption, assign invoice number, enqueue confirmation email. Redirect page polls status briefly when the webhook is late.
  - Fallback: mock adapter with buttons "simulate paid / failed" in dev.
  - Accept: [ ] state machine unit-tested (including duplicate webhooks) · [ ] e2e with mock: paid and failed paths · [ ] manual test with Mollie test keys documented in §12

- [ ] **P2-07 · Order creation, numbering, VAT** — DEV · Depends: P2-04 · 1d
  - Do: `SK-YYYY-NNNNNN` from a DB sequence; order lines snapshot name/sku/price/vat; VAT computed per line (`vatIncluded()`), totals reconcile to the cent (unit test with 100 random carts).
  - Accept: [ ] sum(lines) + shipping − discount = total for all test cases

- [ ] **P2-08 · Thank-you page & transactional email** — DEV · Depends: P2-06 · 2d
  - Files: `adapters/email.ts` (postmark + mock), `components/email/*`, `services/email.ts`
  - Do: email templates as Svelte components rendered to HTML via `svelte/server` `render()`, inline styles, light theme, brand header with crown, NL/FR. Templates: order confirmation, payment failed. `email_log`. Thank-you page: order summary, "account aanmaken" prompt for guests, delivery estimate.
  - Accept: [ ] snapshot tests of rendered email HTML in NL and FR · [ ] mock adapter writes `.data/emails/*.html` for review

- [ ] **P2-09 · Admin orders (list + detail)** — DEV · Depends: P2-06 · 2d
  - Do: list with filters (status, date, payment status, search by number/email/name), bulk "mark processing". Detail: lines, totals, customer, addresses, payment info, timeline from `order_events`, internal notes, status actions, printable packing slip (print CSS).
  - Accept: [ ] role matrix enforced · [ ] e2e: place order → appears in admin → mark processing

**Gate G2** [ ]

### 9.3 Phase 3 — Accounts, fulfilment, operations (weeks 9–11; includes holiday buffer)

- [ ] **P3-01 · Customer authentication** — DEV · Depends: P0-09, P2-08 · 2d
  - Do: register (email verify), login (password or magic link), forgot/reset password, logout, rate limits, Turnstile on register/forgot. On login: merge guest cart and wishlist, and link guest orders with the same verified email.
  - Accept: [ ] e2e full auth flows · [ ] tokens single-use, 30-min expiry

- [ ] **P3-02 · Account area** — DEV · Depends: P3-01 · 2d
  - Do: overview, orders list/detail (status timeline, track link, invoice download), addresses CRUD (default address), wishlist, settings (name, password, locale, newsletter preference), **export my data** (JSON download) and **delete my account** (anonymize orders, keep the legal invoice data).
  - Accept: [ ] GDPR export contains profile, addresses, orders, wishlist · [ ] deletion is irreversible and confirmed by dialog + password

- [ ] **P3-03 · Invoice PDF** — DEV · Depends: P2-07 · 1.5d
  - Do: generate a PDF with `pdf-lib` on `paid` (queue job): seller block (name, address, KBO/VAT from settings), invoice number + date, buyer (VAT number if given), lines, VAT 21% breakdown, totals. Store in object storage, signed download URL for owner/admin only.
  - Accept: [ ] snapshot test of the text layer · [ ] invoice numbers are sequential with no gaps

- [ ] **P3-04 · Order tracking page** — DEV · Depends: P2-09 · 0.5d
  - Do: form (order number + email) → status timeline + tracking link; rate-limited; Turnstile.
  - Accept: [ ] wrong email reveals nothing (same response)

- [ ] **P3-05 · Sendcloud shipping** — DEV · Depends: P2-09 · 2.5d
  - Files: `adapters/shipping.ts` (sendcloud + mock), `api/webhooks/sendcloud/+server.ts`, checkout `ShippingOptions` (service point picker)
  - Do: service-point picker in checkout (bpost points + lockers by postal code); admin "Create label" (single + bulk) → label PDF to storage → print; tracking webhook (verify signature) updates `shipments` → order `shipped`/`delivered` → "shipped" email with track & trace.
  - Fallback: mock adapter returning a fake label + tracking.
  - Accept: [ ] e2e with mock: order → label → shipped email logged

- [ ] **P3-06 · Refunds** — DEV · Depends: P2-06 · 1d
  - Do: admin full/partial refund (amount or lines), optional restock, Mollie refund API, `refunds` + `order_events`, refund email.
  - Accept: [ ] cannot refund more than captured · [ ] permission `orders:refund` enforced

- [ ] **P3-07 · Admin customers** — DEV · Depends: P3-01 · 1d
  - Do: list (search, total spent, order count, newsletter), detail (orders, addresses, notes, tags), GDPR export/delete actions (owner only).
  - Accept: [ ] audit logged · [ ] role matrix enforced

- [ ] **P3-08 · Dashboard & reports** — DEV · Depends: P2-09 · 2d
  - Do: dashboard StatCards (revenue, orders, AOV, conversion if analytics available) for today/7/30 days with deltas; "to process" orders list; low-stock list; top products. Reports: sales by day/category/product, VAT report per month, discount performance, CSV export. Charts follow `dataviz` guidance and brand tokens.
  - Accept: [ ] numbers reconcile with order totals (unit test on the aggregation queries)

- [ ] **P3-09 · Back-in-stock alerts** — DEV · Depends: P1-08, P2-08 · 1d
  - Do: "Mail me" on out-of-stock variants (email + locale, Turnstile); when stock goes from 0 to > 0, a queue job sends the alert once.
  - Accept: [ ] no duplicate sends (unit test)

- [ ] **P3-10 · Admin users, roles, audit viewer** — DEV · Depends: P0-09 · 1d
  - Do: invite admin by email (set password + 2FA on first login), change role, deactivate; audit log viewer with filters.
  - Accept: [ ] last owner cannot be demoted or deactivated

**Gate G3** [ ]

### 9.4 Phase 4 — Content, marketing, SEO (weeks 12–13)

- [ ] **P4-01 · CMS page builder** — DEV · Depends: P1-06 · 3d
  - Files: `admin/content/pages/**`, `components/admin/{BlockEditor,BlockPicker,BlockPreview}.svelte`, `components/blocks/*`, `schemas/page-block.ts`, `services/content.ts`
  - Block types: `hero` (overlay|split, overline, title, script word, lead, image, 2 CTAs), `category_strip`, `product_rail` (collection or manual), `banner` (image + text + CTA), `quote_band` (espresso/inverse), `editorial_split`, `rich_text`, `faq_list`, `newsletter`, `usp_bar`.
  - Do: add, reorder (drag + keyboard buttons), hide, schedule (`visible_from/until`), NL/FR fields, live preview in an iframe at 390/1440, publish/draft. The home page reads from `pages(type=home)`.
  - Accept: [ ] the owner can rebuild the P1-06 home page entirely from admin · [ ] scheduled hero swaps at the set time (unit test with a fake clock)

- [ ] **P4-02 · Menus, announcement, static & help pages** — DEV · Depends: P4-01 · 2d
  - Do: menu editor (main, footer columns); announcement bar text + link + schedule; pages Ons verhaal, Maatgids (ring size table + printable sizer), Materiaal & onderhoud, Verzending & levering, Retourneren (process info); FAQ admin + page with accordion + FAQPage JSON-LD; Contact form (Turnstile, sends to the shop inbox via the email adapter).
  - Accept: [ ] all pages editable in admin in NL/FR

- [ ] **P4-03 · Legal pages & cookie consent** — DEV · Depends: P4-02 · 1.5d
  - Do: legal page type with **placeholder slots** for human-provided text (voorwaarden, privacy, cookies, herroepingsformulier, wettelijke vermeldingen auto-filled from settings: company name, address, KBO, VAT, email, phone; toegankelijkheidsverklaring). Consent banner (necessary / analytics / marketing), equal-weight accept/reject, stored 6 months, re-openable from the footer; nothing non-essential loads before consent.
  - Accept: [ ] e2e: rejecting consent → no analytics requests · [ ] withdrawal form downloadable (PDF) and as an HTML form

- [ ] **P4-04 · SEO** — DEV · Depends: P4-02 · 1.5d
  - Do: per-page title/description with fallbacks, Open Graph + Twitter images (product primary image), JSON-LD Organization + WebSite SearchAction, `sitemap.xml` (index + per language: products, categories, collections, pages), `robots.txt` (disallow `/admin`, `/api`, cart, checkout, account, filter params), canonical rules, redirects table applied in hooks (301), admin redirect editor.
  - Accept: [ ] sitemap validates · [ ] no duplicate canonical across the NL/FR pair

- [ ] **P4-05 · Analytics** — DEV · Depends: P4-03 · 1d
  - Do: Plausible (cookieless) always; GA4 only after analytics consent, with ecommerce events (`view_item_list`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase` server-confirmed on the thanks page).
  - Accept: [ ] events visible in debug mode · [ ] no PII in event payloads

- [ ] **P4-06 · Newsletter** — DEV · Depends: P2-08 · 1d
  - Do: footer and home form → double opt-in email → confirmed → sync to the newsletter adapter (brevo + mock); unsubscribe link; source tracking.
  - Accept: [ ] unconfirmed emails never sync

- [ ] **P4-07 · Performance pass** — DEV · Depends: P4-04 · 1.5d
  - Do: preload hero image and Playfair 400 / Montserrat 400; `font-display: swap` with metric-matched fallback; bundle analysis; lazy-load below-fold components; cache headers + purge on product/content save (Cloudflare API, behind an adapter); prerender legal pages.
  - Accept: [ ] Lighthouse ≥ 90 (mobile) on home, category, PDP, checkout · [ ] storefront JS < 90 kB gzip

- [ ] **P4-08 · Final copy, legal texts, photography** — HUMAN · Depends: P4-03 · —
  - Owner provides final NL/FR copy, legal texts reviewed by a Belgian lawyer, and the hero/editorial photography.

**Gate G4** [ ]

### 9.5 Phase 5 — QA, UAT, launch (weeks 14–15)

- [ ] **P5-01 · E2E suite completion** — DEV · Depends: G4 · 2d
  - Cover: browse → filter → PDP → cart → checkout (paid, failed) → account → track; admin: product CRUD, order → label → ship → refund, CMS edit → publish, discount creation, role restrictions. Run on all 3 Playwright projects.
  - Accept: [ ] green on CI, < 10 min runtime

- [ ] **P5-02 · Accessibility audit** — DEV · Depends: G4 · 1d
  - Do: axe on every route in the e2e run, keyboard-only walkthrough of the checkout, screen-reader smoke test notes in §12; fix all serious/critical issues.
  - Accept: [ ] 0 axe serious/critical issues

- [ ] **P5-03 · Security review** — DEV · Depends: G4 · 1d
  - Do: authz tests for every admin route × role; webhook spoof tests (Mollie unknown id, Sendcloud bad signature); rate-limit tests; dependency audit; CSP report-only check for violations; secrets scan.
  - Accept: [ ] all tests green · [ ] `npm audit` shows no high/critical vulnerabilities in production deps

- [ ] **P5-04 · Monitoring, backups, jobs** — DEV · Depends: G4 · 1d
  - Do: Sentry (server + client, PII scrubbing), uptime check endpoint `/api/health` (DB ping), cron jobs registered (reservation release, alerts, email retries, orphan media cleanup, daily report email), Neon PITR verified, daily logical export to storage.
  - Accept: [ ] a restore drill to a Neon branch documented in §12

- [ ] **P5-05 · Runbook & admin training material** — DEV · Depends: G4 · 1d
  - Files: `docs/RUNBOOK.md`
  - Do: how to process orders, refund, create labels, add products, edit the home page, create discounts, handle a failed payment, enter maintenance mode, roll back a deploy, rotate secrets. Written in Dutch for the owner, with screenshots from Playwright.
  - Accept: [ ] every admin module has a section

- [ ] **P5-06 · UAT** — HUMAN · Depends: P5-01 · —
  - Owner runs real scenarios (input 20 products, place 10 test orders, refund 2, edit the home page) and signs off in §12.

- [ ] **P5-07 · Production cutover checklist** — DEV+HUMAN · Depends: P5-06, D8 · 1d
  - Agent prepares and verifies; the owner supplies credentials:
  - [ ] Domain + DNS on Cloudflare, HTTPS, `www` → apex redirect
  - [ ] Mollie live keys + live webhook URL, payment methods activated
  - [ ] Sendcloud live, sender address, carriers
  - [ ] Email domain SPF, DKIM, DMARC; test delivery to Gmail/Outlook
  - [ ] Production Neon branch + migrations + seed (categories/settings only; **no DEMO products**)
  - [ ] Settings filled: company info, KBO/VAT, shipping rates (D9), return days (D4)
  - [ ] Legal pages filled (P4-08), cookie banner live
  - [ ] Analytics + Search Console + sitemap submitted
  - [ ] Real €1 test order with Bancontact, refunded

- [ ] **P5-08 · Soft launch** — DEV · Depends: P5-07 · 0.5d
  - Do: remove the maintenance flag for an invite list (cookie bypass) 3 days before launch; monitor errors and conversions; fix-forward window.
  - Accept: [ ] 0 critical errors for 48h

**Gate G5** [ ] → 🚀 **Launch 2027-02-08** [ ]

### 9.6 Phase V1 — after launch (weeks 17–22)

- [ ] **V1-01 · Reviews** — review request email 14 days after delivery, photo reviews, verified-buyer badge, moderation `/admin/reviews`, AggregateRating JSON-LD.
- [ ] **V1-02 · Gift cards** — digital €25–€250, scheduled delivery to the recipient, unique code (hash stored), balance applied at checkout before payment, `/admin/gift-cards`.
- [ ] **V1-03 · Returns portal (RMA)** — customer selects lines + reason within `return_days`, admin approves → Sendcloud return label → receive → restock → refund.
- [ ] **V1-04 · Engraving** — per-product option, character limit, price add-on, preview in Playfair/Allura, marks the line as non-returnable.
- [ ] **V1-05 · Journal, lookbook, gift guide** — `articles` CRUD + pages + RSS.
- [ ] **V1-06 · Marketing automation** — newsletter popup (first-order discount, frequency cap, consent-aware), abandoned-cart emails (1h, 24h), price-drop alerts.

Each V1 task follows the same DoD (§3) and gets full Files/Do/Accept details written into this file
before it starts.

### 9.7 Phase V2 — backlog
Loyalty "Koningin Club" · English locale · Meilisearch if SKU > 5,000 · B2B e-invoicing (Peppol) if D6
changes · additional ship-to countries.

---

## 10. Verification commands

```bash
npm run check          # svelte-check: must be 0 errors, 0 warnings
npm run lint           # eslint + prettier --check
npm run test           # vitest unit + component tests
npm run test:e2e       # playwright (all projects); needs `npm run build && npm run preview` or a preview URL
npm run build          # adapter-cloudflare build must succeed
npm run db:migrate     # against a Neon branch or local Postgres
npx lighthouse <url> --preset=desktop|mobile   # P4-07, G4
```

A task is **not done** until `check`, `lint`, `test` and `build` pass locally. E2E must pass before
each gate.

---

## 11. Reference: existing code to reuse (do not rewrite without reason)

| Path (before P0-02) | What it is |
|---|---|
| `design-system/src/lib/styles/tokens.css`, `src/app.css` | Tokens + Tailwind v4 theme mapping |
| `design-system/src/lib/components/ui/{Button,Icon}.svelte`, `icons.ts`, `category-icons.ts` | Primitives + brand and HD category icons |
| `design-system/src/lib/components/storefront/{SiteHeader,Hero,ProductCard,CartDrawer}.svelte` | Storefront components |
| `design-system/src/lib/components/admin/{AdminSidebar,DataTable,StatCard,StatusBadge,ImageUploader}.svelte` | Admin components |
| `design-system/src/lib/stores/cart.svelte.ts` | Cart rune class via context |
| `design-system/src/lib/utils/format.ts` | `formatPrice`, `vatIncluded`, `formatDate` |
| `design-system/src/lib/server/{db,storage.ts}` | Neon/Drizzle connection, schema draft, S3 presign adapter |
| `design-system/src/routes/admin/{api/uploads,products/[id]}` | Upload endpoint + product form action pattern |
| `design-system/src/{hooks.server.ts,env.ts,app.d.ts}` | Per-request services, admin guard stub, env declaration |
| `design-system/DESIGN_SYSTEM.md` | Visual and UX rules: the source of truth for look and feel |

---

## 12. Progress log (append-only, newest at the bottom)

Format: `YYYY-MM-DD · TASK-ID · done|blocked|note · one line`

```
2026-10-07 · — · note · Execution plan created from the development plan doc; design system v0.1 present in design-system/
```
