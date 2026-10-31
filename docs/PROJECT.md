# Pockit — Project

Pockit is a lightweight personal expense manager. **V1 is a fully local demo**: no account, no network, no external services. The full product spec lives in `CLAUDE.md`. This file covers what is built and the product rules as implemented.

## Release scope (V1, implemented)

- **Entry screen** (`/`): "Continue with Google" (real sign-in when the build has Supabase config; otherwise disabled with "Coming soon") and "Try demo". A returning signed-in user sees "Open my Pockit".
- **Home** (`/home`): follows `home-reference.png`. It shows the week/month toggle, a large "spent / budget" figure, a flat progress bar, % used, amount left or over, category bars (amount on top, icon below), and recent expenses.
- **Expenses** (`/expenses`): list grouped by day, newest first. Search plus filters for category, currency, date range and amount range. Add, edit and delete (with confirmation).
- **Add expense sheet** (any screen): "Describe it" (natural language) or "Fill a form".
- **Budgets** (`/budgets`): overall and category budgets. Weekly, monthly, yearly, monthly with a custom start day, or a fixed date range. Edit, end and cancel. History is kept.
- **Categories** (`/categories`): create, edit and delete (expenses are moved, never deleted). Each category has a description and keywords used for auto-sorting, plus an emoji icon.
- **Demo mode**: sample data seeded relative to today. "Reset demo data" restores it. "Back to welcome screen" is also there.
- **PWA**: manifest, generated icons and a service worker. All screens work offline after the first load.

- **Account mode** (release 1, private beta): Google sign-in through Supabase Auth. The signed-in user's data lives in Supabase (RLS per user); first sign-in creates the built-in categories and preferences, no sample data. The "Account" pill opens "Your account" with Sign out. Invite-only: only allow-listed emails can create an account (now just the owner's Gmail), enforced by a database trigger, plus Google "Testing" mode with the same test user.
- The demo stays local and separate; nothing from the demo is uploaded.

- **Gmail import** (account mode): "Your account" → "Connect Gmail" links any Gmail inbox (it can differ from the sign-in account) with read-only access. Every hour, and on "Sync now", BCP credit-card notifications (from notificaciones@notificacionesbcp.com.pe, body "Realizaste un consumo de …") become expenses automatically: amount + currency ($ → USD, S/ → PEN), merchant ("Empresa"), date and time (Lima), category only when a keyword matches exactly one category. Emails without amount or merchant are skipped with a reason; the last 5 are listed in the dialog. Duplicates are impossible (Gmail message id and BCP operation number). First connection imports the last 30 days.

Still not built: other banks/email formats, OpenAI, live exchange rates. See "Future" in `CLAUDE.md`.

## User flows

1. Welcome → Try demo → Home with sample data.
1b. Welcome → Continue with Google → Google → `/auth/callback` → Home with the account's own data. Not on the allow-list → "Pockit is invite-only right now".
2. Tap **+** → type "Yesterday I spent €24.50 at Rimi buying groceries" → expense created and shown → optionally "Edit details".
3. Home → tap a category bar → Expenses filtered to that category.
4. Home with no matching budget → "Set one up" → Budgets with the create form pre-filled for that cadence.
5. Budgets → Edit an active budget → the old version is closed yesterday, and a new version starts today.

## Business rules as implemented

### Expenses
- Amount (required, > 0), currency (ISO 4217), description (required). Merchant, time and category are optional.
- Date defaults to today. Time defaults to now in the form, and stays unset for text entry unless the text gives one.
- Recurrence (`none|daily|weekly|monthly|yearly`) is a label only. V1 does **not** create future occurrences automatically.
- Deleting an expense is a hard delete after confirmation, so it drops out of all totals at once.

### Natural-language entry (local parser)
- Requires **amount and description**. If either is missing or ambiguous (for example several bare numbers), nothing is created and the user is asked for it.
- Understands: currency symbols (€ £ ¥ $ S/), codes (USD, GBP…), words (euros, dollars…), `today`, `yesterday`, `N days ago`, `on Monday`/`last Monday`, ISO dates, times (`at 9pm`, `14:30`), recurrence words, and merchants after "at/from" when capitalised.
- No currency → default currency (EUR), and the success view says so.
- Category comes from the categorization service. Low confidence → Uncategorized.
- Amount parsing: a single separator followed by exactly 3 digits is read as thousands (`4.567` → 4,567). Otherwise it is a decimal.

### Budgets
- **One active budget per scope and cadence.** Scope is overall or one category. Cadence groups periods: week (weekly), month (monthly and custom start), year, and fixed range.
  - *Deviation from spec:* the spec says one overall budget per date. Home needs both a weekly and a monthly overall budget for its Week/Month toggle, so uniqueness is enforced per cadence instead.
- Home **Month** uses the overall monthly budget in force today; if there is none, an overall **date-range** budget in force today stands in (pay-cycle budgets such as Oct 24 → Nov 25), and Home figures use that range.
- Periods: weekly = Mon–Sun; monthly = 1st to last day; yearly = Jan–Dec; custom = anchor day (1–28) to the day before the next anchor; fixed range = its dates.
- Status is worked out from dates when read (no scheduler): `scheduled` before `effectiveFrom`, `closed` after `closedOn`/`endDate`, otherwise `active`.
- Editing an active budget that started before today closes the old record (`closedOn = yesterday`) and creates a new version (`effectiveFrom = today`, `supersedesBudgetId`). The new amount applies to the whole current period. Scheduled budgets, or budgets that started today, are edited in place. Closed budgets are read-only.
- Ending a budget sets `closedOn = yesterday`. Records are never deleted.
- Warning levels: ≥80% "Over 80%", exactly 100% "Limit reached", >100% "Over budget". These use the orange accent, never red.
- Home period: if an overall budget of that cadence is active, Home uses that budget's period (e.g. 15th→14th). Otherwise it uses the calendar week or month. With no budget, Home shows a "Set one up" state instead of made-up values.
- Overall and category budgets are tracked separately and never added together.
- A budget is a spending limit. The UI says "left to spend", never "balance".

### Categories
- Names are unique, case-insensitive. "Uncategorized" is reserved and always exists implicitly (`categoryId = null`).
- Editing a category affects future auto-sorting only. Past expenses keep their category.
- Deleting a category moves its expenses to a chosen category or Uncategorized, and ends its category budgets. This runs as one atomic transaction.

### Currency
- Expenses keep their original amount and currency, always.
- Conversion uses a **static demo dataset** (`src/services/currency/demo-rates.ts`, dated 2026-10-01, labelled demo), computed on read through `CurrencyRateService`.
- Missing rate → the expense is left out of totals, with a visible note. There is never a silent 1:1.

### Dates and time zones
- Dates are stored as `YYYY-MM-DD` in the user's calendar (preferences timezone = device timezone at seed). Each expense also stores the timezone it was recorded in.
- "Today" is recalculated every minute and when the tab becomes visible.

## Known limitations

- Demo: single device only. Clearing site data erases the demo.
- Gmail: Google app is in "Testing", so Google drops the Gmail grant after 7 days; the dialog then shows "Reconnect". Publishing needs a verified own domain. Only the BCP card-purchase format is understood (rule-based, no AI).
- Account mode needs a connection: data is read from and written to Supabase directly (no offline cache or sync queue yet). Offline, the account screen shows "couldn't reach your account". The demo still works offline.
- Display currency is fixed to EUR (preferences exist, but there is no settings UI yet).
- Recurring expenses are not auto-generated.
- Category bars scroll sideways on narrow screens when there are many categories.
- Offline navigation inside the app falls back to full page loads (RSC payloads are not cached).
- The parser is English-only and rule-based.
