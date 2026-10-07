# Sieradenkoningin — Design System & Frontend Architecture

**v0.1 · Storefront + Admin CMS · SvelteKit 3 / Svelte 5 · Tailwind CSS v4 · Cloudflare Workers · Neon Postgres**

> *More than jewelry — it's a state of mind.* The interface is a dark, moody boutique: imagery leads,
> the UI frames it in cream and burgundy, and gold only appears as ornament.

---

## 0. Read this first: decisions and assumptions

| Topic | Decision |
|---|---|
| **SvelteKit version** | The current release is **SvelteKit 3** (3.0.1, verified by installing it). The code follows v3 conventions: config goes in `vite.config.ts`, imports use `#lib/...` instead of `$lib`, env vars are declared in `src/env.ts` and read from `$app/env/private`, and imports use explicit `.ts` extensions. On SvelteKit 2, see §4.9 for the 3-line diff. |
| **Svelte** | Svelte 5 runes only (`$props`, `$state`, `$derived`, snippets). No legacy `export let` or stores. |
| **Styling** | Tokens are plain CSS custom properties, so they work with or without a framework. Tailwind v4 is used for **layout** utilities. Each component's internal styles use **scoped `<style>` with tokens**. |
| **Dribbble reference** | The PRIDEAUX case-study page couldn't be fetched from this environment. The layout follows the editorial-luxury patterns it is known for: generous whitespace, a centred wordmark, 4:5 image-led product cards, hairline buttons and slow reveals. Check the result against the shot visually. |
| **Neon object storage** | I couldn't confirm Neon's storage API from here. The upload layer is written against the **S3-compatible API** (presigned PUT), so it works with Neon's endpoint if it is S3-compatible, and with Cloudflare R2 unchanged. |
| **Language** | Belgian market: `nl-BE` is primary and `fr-BE` is second. Product content is stored as `{ nl, fr, en }` JSON. Prices are in EUR and shown **VAT-inclusive (21%)**. |

---

## 1. Design tokens strategy

**Files:** `src/lib/styles/tokens.css` (the source of truth) and `src/app.css` (which maps the tokens into Tailwind v4 `@theme`).

### 1.1 Three tiers

```
Primitives  --sk-*        raw brand values (exact hex from the board)    → never used in components
Semantic    --ui-*, --fs-*, --space-*, --elev-* …  purpose-based        → components use ONLY these
Context     [data-surface="inverse|espresso"], [data-theme="admin"]    → re-map semantics per region
```

The payoff is that a component written once (Button, ProductCard) renders correctly on cream, on burgundy and in the admin, with no variant props. Wrapping a section in `data-surface="inverse"` flips text, borders, accents and the CTA fill all at once.

### 1.2 Colour

| Primitive | Hex | Role |
|---|---|---|
| Royal Burgundy | `#391617` | Primary brand, hero/footer surfaces, primary CTA |
| Dark Espresso | `#492520` | Body and heading text on light backgrounds, CTA hover |
| Warm Cognac | `#875543` | Links, icons, muted text, focus ring |
| Soft Camel | `#B89985` | Borders, muted text **on dark only** |
| Luxurious Cream | `#EBE1D8` | Page background, text on dark |
| *Gold (derived)* | `#C9A46A` | Ornaments: crown, sparkle, dividers, progress bars |
| *Ruby (derived)* | `#7A1F2B` | Sale price, sale badge, active wishlist (from the stone inspiration) |

**Contrast audit (WCAG 2.2; ratios computed, not estimated):**

| Pair | Ratio | Verdict |
|---|---|---|
| Espresso on Cream | 10.4 | ✅ body text |
| Burgundy on Cream | 12.5 | ✅ headings |
| Cognac on Cream | 4.8 | ✅ AA for normal text, the minimum for muted copy |
| **Camel on Cream** | **2.0** | ❌ **Decorative only.** `brand_color_palette.md` suggests it for muted text; don't use it that way. |
| **Cognac on Burgundy** | **2.6** | ❌ On dark surfaces, use Camel (6.1) or Gold (6.9) instead. The `inverse` context does this automatically. |
| Cream on Burgundy | 12.5 | ✅ |
| Gold on Burgundy | 6.9 | ✅ |
| Status colours on their tints | 4.8–6.1 | ✅ all admin badges pass AA |

**Rules**
- Never use pure black or grey. Shadows are tinted espresso (`rgb(73 37 32 / …)`).
- Gold is **ornament, never body text** on light backgrounds (1.8:1).
- Use the gold gradient (`--sk-gradient-gold`) at most once per view: the gift-card CTA or the free-shipping bar.

### 1.3 Typography

| Token | Size (360 → 1440px) | Font | Use |
|---|---|---|---|
| `--fs-5xl` | 44 → 84 | Playfair, uppercase, +0.02em | Hero display (`.display`) |
| `--fs-4xl` | 36 → 60 | Playfair | H1 |
| `--fs-3xl` | 30 → 44 | Playfair | H2, section titles |
| `--fs-2xl` | 24 → 32 | Playfair | H3, drawer titles |
| `--fs-xl` / `--fs-lg` | 20–24 / 17–20 | Playfair or Montserrat 300 | Card names / lead copy |
| `--fs-base` | 16 | Montserrat 400 | Body (admin: 14) |
| `--fs-sm` / `--fs-xs` | 14 / 12 | Montserrat 500 | UI and meta / buttons, nav, eyebrows (uppercase, +0.18em) |
| `--fs-script` | 32 → 56 | **Allura** | One accent word only |

- **Allura rules:** use it for at most one word or short phrase per viewport ("You", "Koningin"), never below 28px, never for body copy or buttons, and always in the ornament colour.
- **Letter-spacing is the luxury signal.** Use wide tracking (`--ls-wider`, 0.18em) on every uppercase Montserrat label, and `--ls-widest` (0.32em) only for the "J E W E L R Y" sub-wordmark.
- **Self-host the fonts** with `@fontsource` (no Google Fonts hot-linking, for GDPR in the EU). Use Latin subsets only, and preload Playfair 400 and Montserrat 400.

### 1.4 Spacing, layout, shape

- **4px base / 8px rhythm:** `--space-1 … --space-32`. Tailwind's `--spacing: 0.25rem` keeps `p-4` equal to `--space-4`.
- **Fluid editorial whitespace:** `--section-y` runs 64 → 144px between sections, and `--gutter` runs 16 → 48px of page padding. This is where the premium feel comes from, so resist reducing it.
- **Grid:** 2 product columns below 768px, 3 at `md`, 4 at `xl`. `--container-max` is 1440px and `--container-text` is 672px.
- **Breakpoints:** `xs` 375 · `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536. Verified at 390px and 1440px.
- **Shape:** the storefront is **square** (`--r-xs` 2px on buttons and inputs, 0 on imagery). Pills are for chips and badges only. The admin is softer (4 to 8px).
- **Touch targets:** at least 44 × 44px for every icon button.

### 1.5 Elevation & motion

| Token | Use |
|---|---|
| `--elev-xs` / `--elev-sm` | Admin cards / inputs |
| `--elev-md` / `--elev-lg` | Dropdowns / popovers |
| `--elev-xl` | Drawers, modals |
| `--elev-glow` | Gold halo for special CTAs and focus on dark |

Motion is *slow and silky, never bouncy*: `--motion-out` = `cubic-bezier(.22,1,.36,1)`, at 150, 300, 600 and 900ms (reveals). Image hover zoom is 1.04 over 1.2s. Everything collapses to 0ms under `prefers-reduced-motion`.

### 1.6 Tailwind integration (and the one rule that matters)

`app.css` uses `@theme inline` with `--color-*: initial`, so **only brand colours exist** (`bg-burgundy`, `text-muted`, `bg-surface`, `border-line`…). Utilities resolve to `var(--ui-*)`, so they follow `data-surface` re-maps automatically.

> ⚠️ **Svelte scoped styles are unlayered; Tailwind utilities live in `@layer utilities`. Unlayered CSS always wins.**
> So `<button class="icon-btn lg:hidden">` with a scoped `.icon-btn { display: grid }` will **never hide**.
> I hit exactly this bug while testing (the cart icon was pushed off-screen on mobile).
> **Rule:** use Tailwind for page/section layout in routes. Inside a component, do visibility and responsiveness in the scoped `<style>` with media queries.

Custom utilities: `container-lux`, `display`, `eyebrow`, `script`, `text-gold-foil`, `hairline-divider` (the `—— ✦ ——` divider). Note that `overline` is a built-in Tailwind utility, which is why the label utility is called `eyebrow`. Variants: `admin:` and `inverse:`.

### 1.7 Iconography

There are two registries, both rendered by `<Icon name="…">` in `currentColor`:

- **UI icons** (`ui/icons.ts`): a 24 × 24 grid with a 1.25px stroke. This covers the brand ornaments `crown`, `clover` and `sparkle`, plus the storefront and admin UI icons.
- **Category icons** (`ui/category-icons.ts`): **HD, 64 × 64 grid**, redrawn from the board's "Product categorieën" panel. They are finer-lined than the UI icons. Best between 32 and 96px; use about 72px in the category strip.

| Name | Drawing |
|---|---|
| `ring` | Double band with a faceted solitaire, prongs and sparkle glints |
| `bracelet` | Oval of links with a heart-leaf clover station and round beads |
| `necklace` | Fine link chain with a clover pendant on a bail |
| `earrings` | Shepherd hooks, jump rings, pear drops with an inner bezel |
| `sets` | Alternating-link chain bracelet, lobster clasp, clover charm |
| `accessories` | Four heart-leaf clover with a curved stem |

Standalone exports for print, social media and Figma are in `assets/icons/categories/`: `.svg` and transparent `@512.png`, each in espresso and in a `-cream` version for dark backgrounds. Icons are `aria-hidden` by default; label the *button*, not the icon.

---

## 2. Storefront UI components

✅ = built and type-checked in `src/lib/components` · ◻ = specified, still to build

### 2.1 Global chrome

| Component | Spec |
|---|---|
| ✅ **SiteHeader** | Announcement bar on burgundy (sparkle ✦ text ✦). Three-zone grid: `[nav │ crown + SIERADENKONINGIN / JEWELRY │ search · account · wishlist · bag]`. With `overlay`, it is fixed and transparent over the hero, then turns into cream glass (92% + blur) after 40px of scrolling. Below `lg`, a hamburger opens a full-height drawer listing the 6 categories with their icons and an Allura "You" sign-off. Below `sm`, account and wishlist hide (they live in the menu). Nav links use an animated hairline underline. |
| ◻ **MegaMenu** (≥ lg) | Hover or focus on "Collecties" opens a panel: category links on the left, two editorial image tiles on the right. Opens after a 150ms intent delay and closes on Esc. |
| ◻ **SearchOverlay** | Full-width cream sheet with a large Playfair input, popular searches as chips, and 4 instant product results. Debounced 200ms, calling a query endpoint. |
| ◻ **SiteFooter** | `data-surface="inverse"`. Newsletter ("Ontvang je dagelijkse reminder"), 4 link columns that collapse to an accordion on mobile, payment marks (**Bancontact first**, then cards and Apple Pay), a language switch (NL/FR), the crown, and legal links (Belgian consumer law: herroepingsrecht, algemene voorwaarden). |

### 2.2 Editorial

| Component | Spec |
|---|---|
| ✅ **Hero** | `overlay` variant: a full-bleed photo under a burgundy bottom gradient, with copy centred in a column (crown → eyebrow → display title + Allura word → ✦ divider → lead → hairline CTA + text link). `split` variant: 45/55 copy and image on desktop, image-first stack on mobile. The hero image is always `fetchpriority="high"` and never lazy-loaded. |
| ◻ **CategoryStrip** | The six categories as icon + uppercase label (mirrors the board). Horizontal scroll-snap on mobile, a 6-column grid on desktop. |
| ◻ **QuoteBand** | Espresso surface with a centred uppercase quote ("A DAILY REMINDER THAT YOU ARE A QUEEN") and a crown. Use these between product rows for rhythm. |
| ◻ **EditorialSplit** | Large image plus a "Met betekenis" story block, for the meaning behind the clover and crown motifs. Alternate left and right. |
| ◻ **Reveal action** | `use:reveal`: IntersectionObserver fades content up 12px over 900ms, staggered across children. Disabled under reduced motion. |

### 2.3 Commerce

| Component | Spec |
|---|---|
| ✅ **ProductCard** | 4:5 image on a camel-20% placeholder. **Pointer devices:** hover cross-fades to the on-model image, zooms to 1.04 and slides up a "Snel toevoegen" bar. **Touch:** a compact bag button, and the second image is never downloaded. Badges: Nieuw / Limited / Bestseller (cream), −% (ruby), Uitverkocht (espresso). Wishlist heart on a cream disc (legible on any photo); ruby fill when active. Centred text: Playfair name, cognac material line, price (sale = ruby price plus struck-through original), metal swatches. A stretched link makes the whole card clickable with no nested interactive elements. |
| ◻ **ProductGrid** | `grid-template-columns: repeat(2/3/4)` with `--grid-gap`. The first row gets `eager`. Every 8th slot can hold an EditorialTile. |
| ◻ **FilterBar** | Sticky under the header: category chips, metal, price, and sort. On mobile, a "Filter (2)" button opens a bottom sheet. State lives in URL search params (shareable, SSR-friendly). |
| ◻ **PDP Gallery** | Desktop: vertical thumbnails plus a large 4:5 image, click to zoom. Mobile: a swipeable scroll-snap carousel with dot indicators. |
| ◻ **PDP BuyBox** | Name (Playfair 4xl), price incl. btw, metal swatch selector (radio group), size selector with a "Maatgids" link, quantity, a full-width primary CTA, and a delivery promise ("Besteld vóór 16u, morgen in huis"). Accordions: Details, **Met betekenis**, Verzending & retour, Onderhoud. |
| ✅ **CartDrawer** | Native `<dialog>`, which gives a free focus trap, Esc to close and an inert background. Contents: a free-shipping progress bar in gold, line items (96px thumbnail, qty stepper capped at stock, remove), a gift-box upsell, and a sticky footer with the subtotal, "Incl. 21% btw", Afrekenen, and Verder winkelen. Optimistic updates with rollback. On phones it is full width. |
| ◻ **Toast** | Bottom-centre on mobile, top-right on desktop. Shows a cream panel with a thumbnail ("Toegevoegd aan je winkelmand"). |

### 2.4 Forms (shared with admin)

◻ `Input`, `Select`, `Checkbox`, `Radio`, `Textarea`, `Field`. Field is the wrapper for label, hint, error and `aria-describedby`.

- Storefront inputs: 48px tall, bottom border only, label always visible above (no placeholder-as-label).
- Admin inputs: 40px tall with a full border.
- Errors use `--sk-danger` text plus an icon, never colour alone.

---

## 3. Admin CMS UI components

Wrap the admin layout in `data-theme="admin"`. This keeps the same brand DNA but switches to: white cards on a cream-100 background, Montserrat-only headings (Playfair is kept for KPI numbers and the wordmark), a 14px base size, tabular figures, and 4–8px radii.

| Component | Spec |
|---|---|
| ✅ **AdminSidebar** | Burgundy rail (`inverse`). Crown wordmark with "BEHEER", grouped nav, active item marked by a gold left bar and a tint, gold count badges (e.g. new orders), user block, logout form. 256px wide, collapsing to 72px (icons + tooltips); the state is saved in a cookie so SSR renders the right width. On mobile it becomes an off-canvas drawer. |
| ◻ **AdminTopbar** | Mobile menu button (sets `mobileOpen`), breadcrumbs, global search (⌘K), a "Bekijk winkel" link, notifications. |
| ✅ **StatCard** | KPI widget: eyebrow label, icon tile, value in Playfair with tabular numbers, delta (green ↗ / red ↘ with `invert` for "lower is better" metrics like returns), and an SVG sparkline in cognac. |
| ◻ **ChartCard** | Revenue over time (line) and sales by category (bar). Load the `dataviz` guidance when building: cognac and burgundy series, gold for the highlight. |
| ✅ **DataTable** | Generic `<T extends {id}>`. **URL-driven** sort and pagination (`?sort=&dir=&page=`) so the SQL runs server-side and views are shareable. Row selection with indeterminate select-all, and a bulk-action bar that replaces the toolbar while rows are selected. Custom cell rendering via a `cell` snippet. Sticky header and first column, `hideBelow: 'md' \| 'lg'` per column, comfortable or compact density, `aria-sort` on headers. |
| ✅ **StatusBadge** | Pills for order and product status. Every status has a label, and "attention" states use a diamond dot, so colour is never the only signal. |
| ✅ **ImageUploader** | Drag-drop or browse → client-side checks (type, ≤ 15 MB, **≥ 1600px shortest edge**) → presigned PUT directly to storage with an XHR progress overlay → a sortable grid (first image = "Hoofdfoto" with a gold outline), arrow and drag reordering, and **required alt text** (amber border while empty). The result is serialised into a hidden input, so it submits with the product form. |
| ◻ **ProductForm** | Two columns on desktop. Main column: name NL/FR (tabs), description, Met betekenis, images, variants table (metal × size → SKU, stock). Side column: status, price/compare-at in €, category, SEO preview. The save bar is sticky at the bottom, with "Unsaved changes" detection. |
| ◻ **OrderDetail** | A timeline (paid → processing → shipped), line items, customer and addresses, payment reference, actions (send track & trace, refund). |
| ◻ **EmptyState / ConfirmDialog / Toast** | Empty state uses a crown illustration and one CTA. ConfirmDialog uses native `<dialog>` with a danger variant for destructive actions. |

---

## 4. SvelteKit architecture

### 4.1 Folder structure

```
src/
├── app.css                         # Tailwind + tokens + base + brand utilities
├── app.d.ts                        # App.Locals (db, storage, admin), Platform
├── app.html                        # <html lang="nl-BE">
├── env.ts                          # SvelteKit 3: defineEnvVars (validated at boot)
├── hooks.server.ts                 # per-request db/storage, admin guard, headers
├── lib/
│   ├── styles/tokens.css           # ← design tokens (source of truth)
│   ├── types.ts                    # UI-facing shared types
│   ├── components/
│   │   ├── ui/                     # brand-agnostic primitives (no data fetching)
│   │   │   ├── Button.svelte  Icon.svelte  icons.ts
│   │   │   └── Input  Select  Field  Dialog  Drawer  Badge  Skeleton  Tooltip …
│   │   ├── storefront/             # customer-facing compositions
│   │   │   ├── SiteHeader  Hero  ProductCard  CartDrawer
│   │   │   └── ProductGrid  FilterBar  PdpGallery  BuyBox  SiteFooter …
│   │   └── admin/                  # back-office compositions
│   │       ├── AdminSidebar  DataTable  StatCard  StatusBadge  ImageUploader
│   │       └── AdminTopbar  ProductForm  ChartCard  OrderTimeline …
│   ├── actions/                    # use:reveal, use:clickOutside, use:autosize
│   ├── stores/                     # *.svelte.ts rune classes, exposed via context
│   │   └── cart.svelte.ts
│   ├── utils/format.ts             # formatPrice (cents → "€ 49,95"), dates, VAT
│   ├── i18n/                       # Paraglide messages nl / fr / en
│   └── server/                     # ⛔ server-only (enforced by SvelteKit)
│       ├── db/index.ts  db/schema.ts   # Drizzle + Neon
│       ├── storage.ts                  # S3-compatible presign / delete
│       ├── auth.ts                     # sessions, password hashing
│       └── services/ products.ts orders.ts payments.ts   # business logic
└── routes/
    ├── (shop)/                     # route group → storefront layout (header/footer/cart)
    │   ├── +layout.svelte  +layout.server.ts   # cart cookie → lines
    │   ├── +page.svelte                         # home
    │   ├── [category=category]/+page.*          # /ringen /armbanden … (param matcher)
    │   ├── product/[slug]/+page.*
    │   ├── winkelmand/  afrekenen/  account/
    │   └── api/cart/+server.ts
    └── admin/                      # → admin layout (data-theme="admin")
        ├── +layout.svelte  +layout.server.ts
        ├── +page.*                 # dashboard
        ├── orders/  orders/[id]/
        ├── products/  products/[id]/+page.server.ts   ← example included
        └── api/uploads/+server.ts                     ← example included
```

### 4.2 Component conventions

1. **Three layers:** `ui/` (dumb, token-styled, no domain knowledge) → `storefront/` and `admin/` (domain compositions) → `routes/` (data and layout).
2. **Props are typed interfaces** with `$props()`. Shared types go in `#lib/types.ts`, because instance scripts can't export types.
3. **Snippets over slots.** Use `children`, plus named snippets like DataTable's `cell`, `bulk` and `toolbar`.
4. **No module-level mutable state.** On Workers, a module is shared across requests, so it can leak one user's cart to another. Create state per request and pass it through context (see `cart.svelte.ts`).
5. **Styles:** component internals go in scoped `<style>` using `var(--ui-*)`; never hard-code a hex. Route layout uses Tailwind. See §1.6.
6. **Accessibility baseline:** 44px targets, visible `:focus-visible`, native `<dialog>` for drawers and modals, `aria-current`, `aria-sort`, `aria-pressed`, and status that never relies on colour alone.
7. **Copy is Dutch by default.** Pull it into Paraglide messages before launch so FR can be added without touching components.

### 4.3 Data layer: Neon on Cloudflare

- **Driver:** `@neondatabase/serverless` over HTTP + `drizzle-orm/neon-http`. It is stateless with one round-trip per query, which suits Workers. Use the **pooled** connection string (`-pooler` host).
- **Per request:** `hooks.server.ts` puts `locals.db` and `locals.storage` on each request. Load functions and actions only ever touch `locals`.
- **Atomic writes:** `db.batch([...])` (HTTP) for multi-statement saves. For true interactive transactions such as checkout stock reservation, use `Pool` (WebSocket) opened and closed inside the request, or Cloudflare **Hyperdrive** + `postgres.js`.
- **Migrations:** `drizzle-kit generate` → review the SQL → `drizzle-kit migrate` in CI against a **Neon branch** per preview deploy, then promote to main.
- **Schema conventions** (see `schema.ts`): uuid primary keys, **money as integer cents**, `timestamptz`, translations as `jsonb {nl,fr,en}`, Postgres enums for category, status and metal, and indexes on `(category, status)` and `(status, created_at)`.

### 4.4 Connecting forms (admin)

Use the stable pattern: **form actions + progressive enhancement**.

```svelte
<!-- routes/admin/products/[id]/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();
  let saving = $state(false);
</script>
<form method="POST" action="?/save" use:enhance={() => { saving = true; return async ({ update }) => { await update({ reset: false }); saving = false; }; }}>
  <Field label="Naam (NL)" error={form?.errors?.nameNl?.[0]}><Input name="nameNl" value={form?.values?.nameNl ?? data.product?.name.nl} /></Field>
  <ImageUploader value={data.images} />
  <Button type="submit" loading={saving}>Opslaan</Button>
</form>
```

The server side (`+page.server.ts`, included) runs: zod `safeParse`, then `fail(400, { errors, values })` on error, which works without JS. It then applies business rules (an *active* product needs at least 1 photo with alt text), then `db.batch`, then `redirect(303)`.

> SvelteKit's **remote functions** (`form` / `query` from `$app/server`) are still behind `experimental.remoteFunctions` in 3.0. They're a good fit for the admin later, but don't build on them until they're stable.

### 4.5 Image uploads (object storage)

```
Browser ──POST /admin/api/uploads {type,size}──▶ Worker: auth + validate → presign PUT (5 min, content-type signed)
Browser ──PUT file (XHR progress)──────────────▶ Object storage  (bytes never pass through the Worker)
Browser ──submit form (keys + alt + order)─────▶ Worker: write product_images rows in the same batch
```

- Keys look like `products/2026/10/<uuid>.webp`: unguessable and immutable, so they can be served with `Cache-Control: public, max-age=31536000, immutable`.
- **Responsive delivery:** put the bucket behind a Cloudflare domain and use **Cloudflare Image Transformations** (`/cdn-cgi/image/width=800,format=auto/…`) to build `srcset` at 400/800/1200/1600 widths in AVIF or WebP. Upload the masters once and resize at the edge.
- **Orphans:** removed images are deleted asynchronously (a Cloudflare Queue or cron), never inline in the save request.

### 4.6 Rendering & caching on Cloudflare

| Route | Strategy |
|---|---|
| Home, category, PDP | SSR + `setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' })`. Purge on product save. |
| Static pages (FAQ, legal) | `export const prerender = true` |
| Cart, checkout, account | SSR, `private, no-store` |
| `/admin/**` | SSR, `private, no-store`, `x-robots-tag: noindex` (set in hooks) |

### 4.7 Belgium-specific checklist

- Prices **incl. 21% btw** everywhere a consumer sees them. Invoices show the VAT breakdown (`vatIncluded()` helper).
- **Bancontact** first in payment options (Mollie or Stripe both support it, plus KBC/CBC and Apple Pay).
- Locale-aware formatting: `€ 49,95` (nl-BE) / `49,95 €` (fr-BE). This is handled by `formatPrice`.
- Cookie consent before analytics, self-hosted fonts, and a 14-day withdrawal right (herroepingsrecht) shown in the footer and at checkout.

### 4.8 Performance budget

LCP < 2.0s on 4G (hero preloaded, AVIF), CLS < 0.05 (every image has width and height or an aspect-ratio), JS < 90 kB gzip on the storefront, and `font-display: swap` with a metric-matched fallback.

### 4.9 SvelteKit 2 compatibility

On SvelteKit 2, three changes:

- Replace `#lib/x.ts` with `$lib/x`.
- Replace `import * as env from '$app/env/private'` with `import { env } from '$env/dynamic/private'`.
- Move the config from `vite.config.ts` → `sveltekit({ adapter })` into `svelte.config.js`.

`goto(url, { reset: false })` becomes `{ keepFocus: true, noScroll: true }`. Everything else is identical.

### 4.10 Project setup (SvelteKit 3)

```jsonc
// package.json
"imports": { "#lib": "./src/lib", "#lib/*": "./src/lib/*" }
```
```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [tailwindcss(), sveltekit({ adapter: adapter() })] });
```
```bash
npm i drizzle-orm @neondatabase/serverless aws4fetch zod
npm i -D drizzle-kit tailwindcss @tailwindcss/vite @sveltejs/adapter-cloudflare
npm i @fontsource-variable/playfair-display @fontsource-variable/montserrat @fontsource/allura
npx wrangler secret put DATABASE_URL   # + STORAGE_* keys
```

---

## 5. Verification done

- `svelte-check`: **0 errors, 0 warnings**, against SvelteKit 3.0.1, Svelte 5.57, Tailwind 4.3, Drizzle 0.45 and zod 4.
- `vite build` with `adapter-cloudflare` succeeds.
- Rendered and screenshotted at **390 × 844** and **1440 × 900**: storefront home, cart drawer, admin dashboard. That run found and fixed two bugs: the Tailwind layer conflict (§1.6) and an `overline` name collision.
- Contrast ratios computed for every text/background pair in §1.2.

## 6. Suggested next steps

1. Category icons are done (HD, from the board). Get the final crown, clover and sparkle ornament SVGs from the designer → `icons.ts`.
2. Build the remaining ◻ primitives (`Field`, `Input`, `Select`, `Dialog`) and then the PDP.
3. Set up the Neon project with `main` and `preview` branches, run the first migration, and seed the 6 categories.
4. Confirm the Neon object storage endpoint, or choose R2, and set the `STORAGE_*` secrets.
5. Pick a payment provider (Mollie is the most common Belgian choice) before building the checkout.
