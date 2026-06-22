# NoodleFan 粉面王 — Website

Self-ordering takeout site for a Chinese noodle/rice-noodle restaurant. Customers
browse the menu, build a cart, and pay online; paid orders flow to a password-gated
merchant dashboard. The goal is to take orders directly (≈3% Stripe fee) instead of
through delivery platforms (15–30% commission).

- **Live site:** https://lukchen.github.io/NoodleFan-Website/
- **Merchant dashboard:** https://lukchen.github.io/NoodleFan-Website/#admin

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Vite + React 19 | Static SPA, no router (hash-based admin route) |
| Hosting | GitHub Pages | Auto-deployed via GitHub Actions on push to `main` |
| Backend | Supabase Edge Functions (Deno) | Serverless; the only server-side code |
| Database | Supabase Postgres | `orders` table, RLS enabled |
| Realtime | Supabase Realtime (broadcast) | Pushes a PII-free "new order" signal to the dashboard |
| Payments | Stripe Checkout (hosted) | Card + Apple Pay + Google Pay + Link |

There is **no custom server**. All server-side logic lives in Supabase Edge Functions.

## Architecture / data flow

```
Customer (React)
  └─ "Place order & pay"
       → POST create-checkout (Edge Function)         [public, anon key]
            → Stripe Checkout Session
       → browser redirects to Stripe hosted page
            → customer pays (card / wallet)
            → Stripe fires checkout.session.completed
                 → POST stripe-webhook (Edge Function) [verifies Stripe signature]
                      → INSERT row into orders (service role)
                      → broadcast PII-free "new_order" on Realtime channel "orders"
       → Stripe redirects back to /?success=true → confirmation modal, cart cleared

Merchant dashboard (#admin, React)
  └─ login (password) → POST admin-orders (list)       [password-gated]
  └─ subscribes to Realtime "orders" channel
       → on "new_order" signal → re-fetch via admin-orders → visual banner
  └─ change status → POST admin-orders (update)
```

**Security model:** the public anon key is in the frontend bundle. Customer data is
protected by RLS (no anon SELECT policy) — order data is only ever read/written through
the `admin-orders` function, which checks `ADMIN_PASSWORD`. The Realtime broadcast carries
no customer data, only a "something arrived" signal.

## Project structure

```
src/
  App.jsx              Root; hash "#admin" renders <Admin/>, else the storefront
  config.js            Public keys (Supabase URL + anon key) — safe to commit
  data/menu.js         Menu items (single source of truth)
  context/CartContext  Global cart state (React Context)
  i18n/strings.js      All UI text, bilingual EN/ZH — never hardcode strings
  components/
    Navbar, Hero, MenuSection, Cart, Checkout, Footer, LangToggle
    Admin.jsx          Merchant dashboard (login, order cards, status flow, realtime)
supabase/functions/
  create-checkout/     Builds a Stripe Checkout Session (Stripe REST via fetch)
  stripe-webhook/      Verifies signature, looks up fee/net, inserts order, broadcasts signal
  admin-orders/        Password-gated list + status update (service role)
supabase/migrations/   SQL applied to the Supabase Postgres (source of truth for schema)
```

## Edge Function secrets

Set with `npx supabase secrets set KEY=value`. Never commit these.

| Secret | Used by | What it is |
|--------|---------|------------|
| `STRIPE_SECRET_KEY` | create-checkout, stripe-webhook | Stripe secret key (`sk_...`) |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Webhook endpoint signing secret (`whsec_...`) |
| `ADMIN_PASSWORD` | admin-orders | Merchant dashboard login password |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | stripe-webhook, admin-orders | Auto-injected by Supabase |

> Stripe is currently in **test mode**. Use card `4242 4242 4242 4242` to test payments.

## Database schema changes

The `orders` table is the source of truth, with schema changes tracked in
`supabase/migrations/`. To apply a migration, paste it into the Supabase SQL editor
(or run `npx supabase db push`). The `stripe-webhook` records each paid order's
Stripe fee (`stripe_fee`) and net payout (`net_income`) for financial reporting.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173/NoodleFan-Website/
npm run build      # production build to dist/
```

The dev server respects the `base: '/NoodleFan-Website/'` path from `vite.config.js`,
so public assets are served under that prefix.

## Deploying

- **Frontend:** push to `main` → GitHub Actions builds and deploys to Pages.
- **Edge Functions:** `npx supabase functions deploy <name> --no-verify-jwt`

## Notes

- New-order **sound alerts were removed** (could not be reliably stopped); the dashboard
  keeps realtime updates + a dismissible visual banner. Revisit with an `<audio>` element
  or push notifications later.
- Massachusetts prepared-food tax is **6.25%**, computed at checkout.
