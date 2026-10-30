# நம்ம கடை · NAMMA KADAI
**Smart Shop. Simple Accounts.** — a Tamil/English credit ledger for a small grocery shop. Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, RLS). Free tiers only (Supabase Free, Vercel Hobby).

## What it does
Dashboard (live numbers from the database) · customers with search · add purchase (quick or item-wise) · receive payment (Cash/UPI/Other) · cash sales · per-customer statement (print / save as PDF) · calculator + bill calculator (floating button on every screen) · reports with CSV · products list · backup/export · Tamil (default) + English · installable PWA · offline outbox with honest "NOT SAVED YET" status.

## Setup (about 15 minutes)
1. **Supabase**: create a free project at supabase.com. In *Authentication → Providers → Email*, keep Email on and **turn OFF "Allow new users to sign up"** after you create the owner (below).
2. **Database**: open *SQL Editor* and run, in order, the three files in `supabase/migrations/` (`0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`). (Or with the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Owner account**: *Authentication → Users → Add user* (email + password, tick "auto confirm"). Then disable sign-ups as in step 1.
4. **Auth URLs**: *Authentication → URL Configuration*: Site URL = your Vercel URL; add `https://YOUR-SITE/auth/callback` to Redirect URLs (and `http://localhost:3000/auth/callback` for local use).
5. **Env**: `cp .env.example .env.local` and fill the three values (Project Settings → API → URL and anon key). Never use or commit the service_role key; this app doesn't need it.
6. `npm install && npm run dev` → open http://localhost:3000, log in. On first login you'll be asked for the shop name (one-time; the database refuses any second shop).
7. Moving from the notebook? Add each customer with their **old balance** (opening balance). It can't be edited later — use "Correct balance" so there is a record.

## Deploy to Vercel
Push to GitHub (`.env.local` is git-ignored) → vercel.com → *Add New Project* → import repo → add the three env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`) → Deploy. Custom domain: Vercel *Settings → Domains*, add the DNS record shown, then update Supabase Site URL/redirects. Open the site on the phone in Chrome → menu → *Install app* (Settings page also has an Install button).

## Environment variables
| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe in browser; data is protected by RLS) |
| `NEXT_PUBLIC_SITE_URL` | Deployed URL, used in password-reset emails |

## How the money is kept correct
- `NUMERIC(12,2)` in Postgres; integer paise in the UI; amounts travel as exact strings.
- Outstanding = **opening + purchases − payments + adjustments**, always computed in SQL (`customer_balances` view), never from screen state.
- Transactions are **append-only** (DB triggers block UPDATE/DELETE). Mistakes are fixed with *Cancel entry* (adds an opposite adjustment, original stays visible) or *Correct balance*.
- All writes go through SQL functions that lock the customer row (safe under concurrency), validate amounts, de-duplicate on a unique `client_txn_id`, and write the `audit_log`.
- Collections are never counted as sales; cancelled entries are excluded from reports.
- Payments above the balance are refused unless "Allow advance payments" is switched on in Settings.

## Offline behaviour
The app shell opens offline (service worker). Purchases/payments/cash sales made without internet are stored in IndexedDB, shown in **amber "NOT SAVED YET"**, sent automatically when internet returns (and from *More → Pending entries*). Each has a unique id so retries never double-count. If the server rejects one (e.g. payment too large) it stays visible as *Rejected* until the owner retries or explicitly discards it. Customer list falls back to the last copy saved on the phone (balances may be stale; the server re-checks on sync). Creating/editing customers needs internet.

## Backup & recovery
- **In app** (Settings → Backup): customers CSV, all transactions CSV, full JSON (customers, products, transactions, items, cash sales, settings, audit log). Reports have CSV export. The app reminds after 7 days.
- **Free-tier reality**: Supabase Free has **no downloadable automatic backups** (daily backups/PITR are paid), and free projects pause after ~1 week of inactivity. Do not rely on it alone. Recommended routine: every Sunday press *Everything (JSON)* and save it to Google Drive / email it to yourself. Optional: `pg_dump` — Supabase *Project Settings → Database → Connection string*, then `pg_dump "<uri>" -Fc -f namma-kadai.dump`.
- **Recovery**: new Supabase project → run the 3 migrations → restore the dump (`pg_restore -d "<uri>" --data-only namma-kadai.dump`). If you only have JSON/CSV: re-create the owner, then add each customer with their last outstanding as the opening balance (the history stays in your files).
- If the project is paused, open the Supabase dashboard and press *Restore*.

## Tests (all run here and passed)
```
npm run typecheck     # clean
npm run lint          # 0 errors
npm test              # 27 unit tests: money maths, CSV, dates (IST), offline outbox, error mapping, Tamil/English key parity
npm run test:db       # 31 SQL checks on a real PostgreSQL (needs local psql): your scenarios 1-5, 7, 8, 9, plus
                      #   immutability, reversals, dashboard vs report agreement, second-shop isolation, anonymous denied
npm run build         # production build OK
```
Not automated/not done here: tests against a live Supabase project, a real phone, browser E2E, and concurrency under load (the row-lock design is in place and unit-reasoned, not load-tested). Scenario 10 (360px) was designed mobile-first but must be eyeballed on a phone.

## Known limitations
- "3D": the welcome basket is SVG with CSS 3D transforms (no WebGL) to stay smooth on cheap phones; React Three Fiber was deliberately not added.
- PDF statements use the phone's *Print → Save as PDF* (reliable Tamil text). No server-side PDF generator.
- Reversing a purchase after the customer paid can leave a negative balance, shown as "Advance".
- Single shop / single owner by design (RLS is multi-shop ready; add staff by inserting a `profiles` row).
- Offline: no customer creation; stale balances while offline. No push/SMS reminders.
- Nobody has visually reviewed the screens on a device yet — expect small polish tweaks.

## Project layout
`supabase/migrations` schema, RLS, ledger functions · `supabase/tests` SQL tests · `src/app` routes · `src/components` UI · `src/lib` money, dates, i18n, offline outbox, data access · `public/sw.js` service worker · `tests` unit tests.
