# CLAUDE.md — Sieradenkoningin

Read `EXECUTION_PLAN.md` §0–4 and `docs/DESIGN_SYSTEM.md` first. This file records the conventions that
were established while building, which the plan does not spell out.

## Running locally
- Local Postgres cluster lives in `.data/pg` (port **54329**, user `sk`, trust auth):
  `"C:/Program Files/PostgreSQL/14/bin/pg_ctl" -D .data/pg -o "-p 54329" -l .data/pg.log start`
- `npm run db:migrate && npm run db:seed` (idempotent). `npm run admin:reset -- <email>` resets an
  admin's password + 2FA (prints the new password once; `NEW_PASSWORD=…` to choose it).
- `npm run dev` (port 5173). All external services run on **mock adapters** when keys are empty:
  storage → `.data/uploads` served at `/media/*`; emails → `.data/emails/*.html`; Mollie → `/{lang}/betalen/mock`.
- After `npm install`, run `npx svelte-kit sync` (npm deletes the generated `node_modules/$app/tsconfig.json`).

## Stack facts (verified against installed versions)
- SvelteKit 3.0.1: config in `vite.config.ts`; `#lib/...` imports with explicit `.ts`; env via
  `src/env.ts` + `$app/env/private|public`; param matchers via `defineParams` in `src/params.ts`.
- DB driver is **node-postgres** (`drizzle-orm/node-postgres`) everywhere — real transactions available
  (`locals.db.transaction`). Pool is per request (hooks). Types: `DB`, `Tx`, `Executor` from `#lib/server/db/index.ts`.
- **Drizzle gotcha:** inside raw `sql` correlated subqueries, `${products.id}` renders UNQUALIFIED (`"id"`)
  and binds to the inner table. Use `sql.raw('"products"."id"')` for outer references.
- **pg gotcha:** enum arrays come back as strings — cast `array_agg(x::text)`.

## i18n
- Paraglide messages are split per area: `messages/<area>/{nl,fr}.json` (areas: core, shop, catalog, cart,
  checkout, account, content, email). Both locales must have identical keys (unit-tested).
- Locale = first path segment; language switch = full page load (`data-sveltekit-reload`).
- Public localized paths ↔ internal English routes: `src/lib/i18n/paths.ts` (`localizeHref`, reroute hook).
  Category / CMS page slugs are resolved by `src/routes/[lang=lang]/(shop)/[slug]`.
- Translatable DB fields are `I18n` (`{nl, fr?}`); pick with `tr(value, lang)` from `#lib/i18n/index.ts`.
- **Admin UI is Dutch-only** (§7.3) — Dutch strings are written directly in admin components/routes.
  Storefront components must use `m.*()` only.

## Storefront rules
- Shop layout server load returns PUBLIC data only (edge-cacheable HTML). Cart/wishlist are loaded
  client-side (`/api/cart`, `/api/wishlist`) into context stores (`getCart()`, `getWishlist()`, `getToasts()`).
- Cacheable pages set `cache-control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400`;
  cart/checkout/account set `private, no-store`.
- Use `<Seo>` (title, description, canonical, OG, JSON-LD) on every page; pages may return
  `alternates: { nl, fr }` for the language switch + hreflang when slugs differ per language.
- Product cards: `cardsWhere/cardsByIds` + `toCard(row, lang, picture)` from `services/catalog.ts`.
- Images: `picture(key, alt, width)` / `img(key, w)` from `#lib/utils/media.ts`.

## Admin rules
- Routes live in `src/routes/admin/(app)/**`; auth screens in `(auth)`. Every `load` and every action calls
  `requirePermission(locals, '<perm>')` (§7.4 matrix in `#lib/permissions.ts`), and every mutation calls
  `audit(db, locals, {action, entity, entityId, diff})`.
- Forms: `+page.server.ts` actions + `use:enhance`, zod schemas in `src/lib/schemas/*`, `fail(400, {errors, values})`
  with `fieldErrors()` from `#lib/schemas/common.ts`; must work without JS.
- Building blocks: `PageHeader`, `Card`, `DataTable` (URL-driven sort/page), `StatusBadge`, `ui/*` primitives.
- Pages set `crumbs: [{label, href?}]` in load data for the topbar breadcrumbs.

## Styling
- Components use semantic tokens only (`--ui-*`, `--fs-*`, `--space-*` …), never hex. Status colours:
  `--ui-danger|success|warning|info` (+ `-bg`). Serif that survives the admin theme: `--ff-serif`.
- Tailwind only for route-level layout; component visibility/responsiveness in scoped `<style>`.

## Money & tax
- Integer cents everywhere. Totals via `computeTotals()` in `services/pricing.ts` (per-line VAT, discount
  allocated with `allocate()`, reconciles to the cent). Discounts: `services/discounts.ts`.
