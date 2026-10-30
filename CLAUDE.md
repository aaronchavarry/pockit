# Pockit — Product & Engineering Specification

> Living project specification for Claude Code. This document defines the product, MVP scope, UX, architecture expectations, business rules, implementation sequence, and future evolution. Keep it updated whenever implementation decisions or product behavior change.

## 0. Working on this repo (read first)

**Status (2026-10-30):** V1 local demo implemented. All phases are done. Home layout follows `home-reference.png`; visual style (colors, borders, spacing, navbar) follows `ui-reference.jpg`. Release 1 in progress: Google sign-in + Supabase account data are live (invite-only, see `docs/DATABASE.md`); the demo stays local. Hosted on Vercel (https://pockit-five.vercel.app) from GitHub `aaronchavarry/pockit` `main`; pushes to `main` deploy to production. Read `docs/PROJECT.md` (rules and deviations), `docs/ARCHITECTURE.md` (folders, data flow, services), `docs/DATABASE.md` (schema) and `docs/CHANGELOG.md` before changing anything.

Commands:

```bash
npm install
npm run dev          # http://localhost:3000 (service worker disabled in dev)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (flat config, next core-web-vitals + typescript)
npm test             # vitest unit/integration tests
npm run build        # production build
npm run test:e2e     # playwright (needs `npm run build` first; serves on :3100)
npm run check        # typecheck + lint + test + build
```

Conventions:
- Business rules live in `src/domain` and `src/application`. Components call use cases through `useData().mutate(...)` and never touch storage.
- Money = integer minor units. Convert only through `CurrencyRateService`. Dates = `YYYY-MM-DD` via `src/lib/dates.ts`.
- External providers go behind the interfaces in `src/services` and `src/data/repositories.ts`. The demo makes no network calls; account mode talks only to Supabase (public URL + publishable key from `.env.local` / Vercel env; never a service-role key in the app).
- Update the docs and changelog in the same change as the code.

## 1. Product overview

**Pockit** is a lightweight personal expense manager. Its core promise is to make expense tracking effortless: users can add expenses manually or describe them in natural language, while future integrations will detect transactions from email and categorize them automatically.

Pockit should feel calm, fast, trustworthy, and simple—not like a complex accounting platform.

### Product principles

- Minimize the effort required to record an expense.
- Make financial information understandable at a glance.
- Keep original transaction data intact.
- Automate repetitive work, but never fabricate financial facts.
- Build a polished, useful experience before introducing external integrations.
- Keep the architecture modular so future services can be added without rewriting the UI or domain logic.

## 2. Release strategy

### Version 1 — Functional local demo (current scope)

Build **only the “Try demo” experience** as a complete, usable local application.

- The entry screen must show:
  - **Continue with Google** — visible but intentionally disabled/non-functional in V1. It must not pretend to authenticate or show a fake success state. Add a subtle “Coming soon” indication if appropriate.
  - **Try demo** — working entry point into the application.
- No real Google authentication in V1.
- No Supabase, Gmail, OpenAI, currency API, or other external service calls in V1.
- Do not require API keys, accounts, network access, or backend setup to use the demo.
- All essential flows must work with local demo data and local persistence.
- Provide a local/demo data layer that can later be replaced or extended by real adapters.
- Include realistic seeded demo data so the app looks credible immediately.
- A user must be able to add, edit, delete, filter, and inspect expenses; manage categories and budgets; and see the Home dashboard update accordingly.
- Natural-language expense entry must work without an AI API using a deterministic local parser/rule-based fallback. Keep the parser behind an interface so a real AI provider can be added later.
- Currency conversion in V1 must work without a live API. Use a clearly identified local/static exchange-rate dataset or configurable demo rates. Do not imply that demo rates are live or financially authoritative.
- The app must remain useful if every external integration is unavailable.

### Future releases (design for these, do not implement external connections now)

1. Google OAuth authentication and user-specific cloud data using Supabase.
2. Gmail API connection and automated transaction extraction.
3. OpenAI-powered natural-language extraction and categorization.
4. Live currency exchange-rate provider.
5. Scheduled email synchronization and other background jobs.

Do not build fake versions of future integrations. Define clean interfaces, document expected contracts, and leave integrations unconfigured until a later release.

## 3. Mandatory implementation sequence

Follow this order. Do not build all screens at once and do not skip the return to Home.

### Phase 1 — Inspect and establish foundations
1. Inspect the repository, existing code, dependencies, and available assets before changing anything.
2. Find the visual reference image in the project root. It is the required visual reference for the **Home screen**. Inspect it carefully and use it to guide layout, hierarchy, spacing, proportions, and component styling. Do not invent a different Home direction.
3. If the reference image cannot be found, stop and report that clearly rather than pretending to have inspected it.
4. Propose and establish a clean, appropriately sized project structure. Avoid needless abstraction and overengineering.
5. Set up design tokens, app shell, routing, domain types, local persistence, and reusable primitives.

### Phase 2 — Build Home first
1. Implement the Home screen to closely follow the root reference image.
2. Use realistic demo data initially.
3. Focus on visual fidelity, responsive behavior, typography, spacing, and reusable components.
4. At this stage, prioritize the Home presentation; do not prematurely build every feature.

### Phase 3 — Build the remaining screens
Implement the screens and navigation described in this specification:
- Entry / demo access
- Home
- Expenses list and expense creation/editing
- Budgets
- Categories

Make each screen functional and responsive. Use the same design system and shared components.

### Phase 4 — Return to Home and make it fully functional
After all screens exist:
1. Revisit Home.
2. Connect all dashboard values to the actual local application data and selected period.
3. Ensure budget progress, category breakdowns, recent expenses, totals, and remaining amounts update after create/edit/delete operations.
4. Verify empty states, loading states where relevant, and edge cases.
5. Remove hardcoded dashboard values except intentional demo seed data.

### Phase 5 — Quality and documentation
1. Run type checks, linting, tests, and production build.
2. Fix errors rather than suppressing them.
3. Test the core flows end-to-end.
4. Update all relevant project documentation and changelog.
5. Summarize what is implemented, how to run it, known limitations, and the recommended next steps.

## 4. Information architecture and screens

Keep the product intentionally small. Do not add unrequested screens or features.

### 4.1 Entry screen

A simple, polished welcome screen.

- Product identity: Pockit.
- Primary action: **Try demo**.
- Secondary action: **Continue with Google** (disabled in V1; clearly marked as coming later).
- Explain briefly that the demo uses sample data and works locally.
- Try demo must open the application without requiring account creation.
- Do not imply that demo data is a real user's financial data.

### 4.2 Home

Home is the main overview and should follow the visual reference image in the project root.

Core information:
- A compact period selector/tag for **Week** and **Month**.
- Total spent in the selected period.
- Applicable budget amount.
- Percentage of budget used.
- Remaining amount or amount over budget.
- A simple category spending breakdown (horizontal bars or the visualization shown in the reference).
- A short list of recent expenses.
- Clear, low-friction action to add an expense.

Rules:
- All values must derive from the local data layer.
- Changing Week/Month updates all relevant Home data.
- Use the appropriate budget for the selected period. If no matching budget exists, show a clear empty/setup state rather than misleading values.
- Category breakdown should be based on expenses in the selected period.
- The recent-expenses section should link to the full expense list.
- Do not invent charts or decorative metrics that do not add value.

### 4.3 Expenses

Provide an expense list and a focused add/edit experience.

Expense fields:
- Amount (required, positive).
- Original currency (required).
- Expense title/description (required).
- Merchant/place (optional when unknown).
- Date (required; default to today).
- Time (optional; use current local time only when appropriate).
- Category (optional if it cannot be confidently inferred; allow user selection).
- Recurrence (none, daily, weekly, monthly, yearly).
- Source (manual, natural-language entry, future email import).
- Created/updated timestamps.

Interactions:
- Add expense using a conventional form.
- Add expense using a natural-language text input.
- Edit an existing expense.
- Delete an expense with a confirmation step.
- Filter/search expenses by date, category, merchant/description, currency, and amount range where practical.
- Sort newest first by default.
- Provide useful empty states.

### 4.4 Natural-language expense entry

The user can enter a short phrase such as:

- `Coffee 4.50`
- `Yesterday I spent €24.50 at Rimi buying groceries`
- `Paid 12 USD for lunch`

Behavior:
- Parse the amount and the expense description as the minimum required information.
- If either amount or description is missing/ambiguous, do not create an expense. Ask for the missing information.
- If the minimum information is present, create the expense directly; do not require a second confirmation step.
- Infer only safe defaults:
  - Date: today if no date is provided.
  - Recurrence: none if not specified.
  - Time: leave unset unless available or explicitly provided.
  - Currency: use an explicit currency if present; otherwise use the user's configured default currency.
  - Category: infer from category descriptions and keywords; if confidence is low, leave uncategorized rather than guessing.
  - Merchant: extract only when identifiable.
- Never invent an amount, merchant, or transaction detail.
- Show the parsed result in a concise success state and allow the user to edit it afterward.
- Implement a deterministic local parser for V1. It must not call an AI API.
- Define an `ExpenseUnderstandingService` (or equivalent) interface so a future AI implementation can replace/augment the local parser without changing the UI or expense domain model.
- Keep parsing, validation, and persistence separate.

### 4.5 Budgets

Support an overall budget and optional category-level budgets.

Budget fields:
- Name (optional; useful for custom periods).
- Amount and currency.
- Period type: weekly, monthly, yearly, or custom.
- Start date.
- End date or duration/rule.
- Status: scheduled, active, completed/closed.
- Optional category association. No association means overall budget.

Rules:
- Only one overall budget can be active for a given date at a time.
- Category budgets can coexist with the overall budget, one active budget per category and date range unless a deliberate product decision is documented.
- Support a standard monthly budget beginning on day 1 and ending on the final day of that month.
- Support custom recurring periods, such as starting on the 15th and running until the 14th of the following month.
- Support a fixed custom date range, such as November 10–25.
- Support weekly and yearly periods.
- Allow the user to edit the current budget. Editing must preserve historical integrity: close/archive the previous budget record and create a replacement/version; do not destructively overwrite history.
- A future scheduled budget becomes active when its start date arrives. In V1, determine active status from dates at read time; do not depend on a background scheduler.
- When a new budget period starts, the previous period is closed and the new one becomes active automatically according to its dates.
- Preserve historical budgets and their settings. Do not delete old budget records when a new one starts.
- Show progress and remaining/overspent amount.
- Provide sensible visual warnings at 80%, 100%, and above 100%, without making the interface alarming.
- Category-level budgets should be reflected in category views and relevant Home summaries.

Important: a budget is a spending limit, not a bank balance. Do not describe budget remaining as actual account balance.

### 4.6 Categories

Provide category management with:
- Name.
- Optional description explaining what belongs in the category.
- Optional keywords/examples to improve automatic classification.
- Optional icon.
- Built-in default categories that can be edited and supplemented.
- No user-configurable category color in V1. Keep category presentation neutral and consistent with the design system; use the accent color sparingly.

Category descriptions and keywords must be available to the local categorization logic and future AI categorizer. Example:

- Name: Groceries
- Description: Supermarket purchases, food shopping, and household groceries.
- Keywords: Rimi, Lidl, Prisma, Selver

Rules:
- Prevent accidental duplicate category names (case-insensitive).
- When a category is deleted, do not silently delete its expenses. Reassign them to “Uncategorized” or require the user to choose a replacement.
- Category edits should affect future categorization. Do not silently rewrite the category of historical expenses.

## 5. Currency and money handling

Currency support is important because expenses may be recorded in different currencies.

### V1 behavior
- Each expense stores its original amount and ISO 4217 currency code.
- Configure a default/display currency (use EUR as the initial demo default).
- Provide a currency conversion service interface.
- Use a clearly labeled static/demo exchange-rate dataset in V1. Do not claim rates are live.
- Keep conversion logic centralized; never calculate conversions independently in UI components.
- Store the rate and rate date/source used for any saved converted value or historical reporting snapshot.
- Use decimal-safe arithmetic for money. Avoid JavaScript floating-point arithmetic for financial calculations; use integer minor units or a suitable decimal library.
- Format values using locale-aware currency formatting.
- If a conversion rate is unavailable, display the original amount and currency and clearly indicate that conversion is unavailable. Never silently assume a 1:1 rate.

### Future behavior
- Add a free currency-rate API adapter after V1.
- Refresh rates according to provider limits and cache results.
- Changing the display currency must recalculate equivalent display values without altering original transaction amount/currency.
- Historical reporting should use a documented rate policy (prefer the rate for the transaction date where available). Clearly distinguish historical rates from current indicative conversions.

## 6. Email integration — future scope only

Do not implement Gmail connection in V1. Keep the architecture ready for it.

Planned future flow:
1. User connects Gmail through Google OAuth with minimum required scopes.
2. A backend job checks relevant messages approximately once per hour, with a manual “Sync now” action.
3. Gmail messages are classified as potential receipts, invoices, payment confirmations, subscriptions, or purchase confirmations.
4. Extraction identifies amount, currency, merchant, date, description, and possible category.
5. Valid transactions are recorded automatically without user approval, as explicitly required by the product.
6. Invalid or incomplete messages (especially when amount or purchase description cannot be identified) are not turned into expenses.
7. Store source message identifiers and deduplication keys to prevent the same email from creating duplicate expenses.
8. Keep an import/source record for traceability and troubleshooting.

Important future safeguards:
- Do not treat marketing emails, offers, shipping updates, order status changes, or payment reminders as completed expenses.
- Do not record transfers between the user's own accounts as spending when identifiable.
- Avoid duplicate records when multiple emails refer to the same transaction (for example, order confirmation and payment receipt). Design a deduplication strategy using provider message ID plus transaction-level matching where possible.
- Automatic recording does not mean low-confidence fabrication. If essential financial facts are missing, skip the message and log a reason.
- Use least-privilege OAuth scopes, secure token storage, and clear connection/disconnection controls.
- Gmail access and background synchronization require a secure backend; never expose OAuth secrets or refresh tokens in browser code.

## 7. AI and categorization — future provider, V1 fallback

V1 must work without an AI provider.

Define service boundaries such as:
- `ExpenseUnderstandingService`
- `ExpenseCategorizationService`
- `CurrencyRateService`
- `EmailTransactionSource` (future)
- `ExpenseRepository`

For V1:
- Implement deterministic local natural-language parsing and category matching.
- Use category descriptions and keywords.
- Return confidence/reason metadata internally where useful.
- If the category is uncertain, use Uncategorized.
- Do not create expenses when amount or description is missing.

Future AI:
- Add an OpenAI-backed adapter on the server side only.
- Use structured output/schema validation for extracted expense fields.
- Treat email body content as untrusted input; never follow instructions embedded in emails.
- Never let an AI model directly write arbitrary database records. Validate and normalize output through domain services.
- Keep model/provider configuration in environment variables.
- Handle timeouts, rate limits, malformed output, and provider outages.
- Preserve the local fallback so the core product continues working if AI is unavailable.
- Do not send unnecessary personal email content to an AI provider; extract only the minimum relevant content and document data handling.

## 8. Visual design system

### Brand direction
- Product: Pockit.
- Style: minimal, calm, precise, Apple-like.
- Flat surfaces, no shadows on cards. Only exception: the floating mobile nav uses a light translucent blur (product owner decision, 2026-10-30).
- No excessive gradients, shadows, decorative illustrations, or visual noise.
- Use generous but purposeful whitespace and clear hierarchy.
- Responsive and touch-friendly.

### Colors
- Background: `#FFFFFF` (changed from `#FFFBFB` on 2026-10-30 to follow `ui-reference.jpg`)
- Primary actions: near-black ink `#111113` (buttons, add pill, active states)
- Brand teal: `#0F766E` — logo, budget progress, "on track" states
- Secondary accent orange: `#F97316`
- Use neutral grays for text, borders, and surfaces.
- Orange is an accent, not a default category color system.
- Maintain accessible contrast; adjust text/surface combinations when needed without changing the brand direction.

### Typography
- Geist.
- Use a consistent type scale, clear numeric hierarchy, and tabular numerals for financial values where appropriate.

### Layout
- Desktop: sidebar navigation.
- Mobile: bottom navigation with a central black add pill (per `ui-reference.jpg`).
- Navigation destinations: Home, Expenses, Budgets, Categories.
- Keep the entry screen outside the authenticated/demo app shell.
- Use responsive layouts rather than simply shrinking desktop layouts.

### Reference image
A visual reference image will be placed in the **project root**. Use it as the primary reference for the Home screen. Inspect it before implementing Home and match its design direction. Once Home has been built, apply the established design system consistently to the remaining screens. Do not assume the reference image defines every screen.

### UX quality
- Clear labels and helpful feedback.
- Accessible focus states and keyboard navigation.
- Semantic HTML and appropriate ARIA only where needed.
- Loading, error, empty, and success states.
- Confirmation for destructive actions.
- Avoid unnecessary modals and multi-step flows.
- Make common actions reachable with minimal interaction.

## 9. Technical architecture expectations

Choose the most appropriate stable, well-documented implementation based on the repository. Preferred direction:
- Next.js with TypeScript.
- A modern, accessible component approach.
- Local persistence for V1 (IndexedDB preferred for structured offline-capable data; localStorage may be used for small preferences only).
- PWA manifest, icons, service worker/offline strategy.
- A future Supabase adapter for authentication and cloud persistence.

Do not add dependencies without a clear reason. Check current official documentation for the installed framework and libraries; do not rely on deprecated APIs or outdated tutorials.

### Architecture principles
- Strict TypeScript; avoid `any`.
- Separate presentation, domain logic, infrastructure, and application/use-case logic.
- Keep components focused and reusable.
- Keep business rules out of React components.
- Keep storage access behind repository interfaces.
- Keep provider-specific logic behind service adapters.
- Validate data at trust boundaries.
- Centralize date, timezone, currency, and money utilities.
- Use explicit error types/results and user-friendly error handling.
- Avoid giant components, giant utility files, circular dependencies, and speculative abstractions.
- Use clear naming and consistent import conventions.
- Avoid premature microservices or unnecessary backend infrastructure for this local MVP.

A possible structure (adapt to the actual framework and project needs; do not force folders that add no value):

```text
src/
  app/                       # routes, layouts, page composition
  components/
    ui/                      # generic reusable UI primitives
    layout/                  # sidebar, mobile navigation, app shell
    dashboard/               # Home-specific presentation components
    expenses/
    budgets/
    categories/
  features/
    expenses/
      components/
      application/
      domain/
      infrastructure/
    budgets/
      components/
      application/
      domain/
      infrastructure/
    categories/
      components/
      application/
      domain/
      infrastructure/
  services/
    expense-understanding/
    categorization/
    currency/
  lib/
    dates/
    money/
    validation/
    storage/
  types/
  styles/
  tests/
docs/
  PROJECT.md
  ARCHITECTURE.md
  DATABASE.md
  CHANGELOG.md
```

This is a guideline, not a mandate. Prefer a simpler structure if the app is small, but preserve separation of concerns.

## 10. Data model — V1 local domain

Design typed domain entities and persistence schemas for at least:

### Expense
- `id`
- `amountMinor` (integer minor units, or a decimal-safe equivalent)
- `currency`
- `description`
- `merchant` (nullable)
- `categoryId` (nullable or Uncategorized)
- `occurredAt` (date/time with explicit timezone handling)
- `recurrence` (`none | daily | weekly | monthly | yearly`)
- `source` (`manual | natural_language | email`)
- `sourceReference` (nullable; future email message/transaction reference)
- `createdAt`
- `updatedAt`

### Budget
- `id`
- `name`
- `amountMinor`
- `currency`
- `scope` (`overall | category`)
- `categoryId` (nullable for overall)
- `periodType` (`weekly | monthly | yearly | custom_recurring | fixed_range`)
- `startDate`
- `endDate` (nullable for recurring rules)
- `anchorDay` / duration fields as required by the chosen custom-period model
- `status` (`scheduled | active | closed`)
- `supersedesBudgetId` (nullable)
- `createdAt`
- `updatedAt`

### Category
- `id`
- `name`
- `description`
- `keywords`
- `icon`
- `isSystem`
- `createdAt`
- `updatedAt`

### Preferences
- `defaultCurrency`
- `locale`
- `timezone`
- optional display preferences

### ExchangeRate (demo/local)
- `baseCurrency`
- `quoteCurrency`
- `rate`
- `rateDate`
- `source`
- `isDemoRate`

Keep the schema normalized and version local persistence so future migrations are possible. Do not store derived totals as the source of truth; calculate them from expenses and applicable budgets, or cache them safely with invalidation.

## 11. Business rules and edge cases

- Store expense amounts in original currency.
- Never mutate original amounts during currency conversion.
- Never treat a budget as a bank balance.
- Exclude deleted expenses from all totals.
- Define whether expense dates use the user's configured timezone and apply consistently.
- Handle month boundaries, leap years, daylight-saving changes, and custom budget boundaries.
- Define behavior for expenses outside any active budget period.
- Avoid double-counting when aggregating category and overall budgets.
- If an expense category is deleted, preserve the expense and reassign safely.
- Validate positive finite amounts and valid ISO currency codes.
- Handle unknown currencies without crashing.
- Prevent duplicate expense creation from repeated UI actions where feasible.
- Keep demo data separate from any future real-user data namespace.
- Provide a “Reset demo data” or equivalent way to restore the initial demo state.

## 12. PWA and offline requirements

- Installable PWA with appropriate manifest metadata and app icons.
- Responsive layouts for mobile and desktop.
- Core app screens and local data operations work offline after initial load.
- Cache static application assets safely.
- Do not cache sensitive future authenticated responses indiscriminately.
- Show a subtle offline/connection status only when useful.
- Ensure local persistence survives refresh and browser restart.
- Document browser storage limitations and provide graceful handling if storage is unavailable or full.

## 13. Security and privacy

Even though V1 is local-only:
- Do not include secrets or API keys in the repository.
- Provide `.env.example` only for future integrations if needed, with placeholder names and no real values.
- Do not collect or transmit demo user data.
- Do not claim that V1 is cloud-backed or synchronized.
- Keep the demo clearly labeled.

For future releases:
- OAuth and provider tokens must be handled server-side and stored securely.
- Enforce per-user data isolation in Supabase with Row Level Security.
- Validate all server inputs.
- Apply least privilege to Gmail scopes.
- Avoid logging full email contents, tokens, or sensitive transaction data.
- Document retention, deletion, and provider data handling.

## 14. Testing and acceptance criteria

At minimum, test:

### Entry and demo
- Entry screen renders.
- Google button is visibly disabled and does not fake authentication.
- Try demo opens the app.
- Demo seed data loads.
- Refresh preserves user changes.
- Reset demo restores seed data.

### Expenses
- Create expense via form.
- Edit and delete expense.
- Validate missing amount/description.
- Parse examples such as `Coffee 4.50` and `Yesterday I spent €24.50 at Rimi buying groceries`.
- Missing essential fields do not create an expense.
- Natural-language flow works without network/API access.
- Expenses appear in Home and filters.

### Budgets
- Create monthly, weekly, yearly, recurring custom, and fixed-range budgets.
- Correct budget is active for a given date.
- Scheduled budget activates based on dates.
- Editing closes/versions the previous budget without destroying history.
- Overall and category budget progress is correct.
- 80%, 100%, and over-budget states are handled.

### Categories
- Create, edit, and delete categories safely.
- Category description/keywords influence local categorization.
- Low-confidence categorization falls back to Uncategorized.
- Deleting a category preserves associated expenses.

### Home
- Week/Month selector updates all relevant metrics.
- Total spent is correct.
- Budget progress and remaining/overspent values are correct.
- Category breakdown matches selected period.
- Recent expenses are current.
- Home updates after add/edit/delete operations.

### Quality
- Responsive mobile and desktop behavior.
- Keyboard and basic accessibility checks.
- Type check, lint, tests, and production build pass.
- No console errors in core flows.

## 15. Living documentation and Claude Code operating rules

Maintain these files throughout development:

### `CLAUDE.md`
Permanent instructions for Claude Code:
- Product summary and current release scope.
- Commands to run the project, tests, lint, and type checks.
- Architectural conventions and important constraints.
- Current project status and links to detailed docs.
- Explicit reminder to read relevant docs before making changes.

### `docs/PROJECT.md`
Product requirements, screens, user flows, release scope, and business rules.

### `docs/ARCHITECTURE.md`
Actual implemented architecture, folder responsibilities, data flow, service boundaries, and important technical decisions.

### `docs/DATABASE.md`
Current local data schema, persistence/versioning, entity relationships, and future Supabase mapping.

### `docs/CHANGELOG.md`
Chronological record of meaningful changes, decisions, fixes, and migrations.

Rules:
- Create these documents if absent.
- Update documentation in the same task/PR as the code change.
- Do not document planned functionality as implemented.
- Keep architecture documentation aligned with the real codebase, not an imagined architecture.
- Record meaningful trade-offs and deviations from this specification.
- If requirements change, update this specification and the relevant docs before or alongside implementation.
- At the end of each development task, report files changed, tests/checks run, outcomes, and remaining limitations.
- Do not claim tests passed unless they were actually run.

## 16. Definition of done for V1

V1 is complete when:
- A user can open Pockit and enter through Try demo.
- The app is installable as a PWA and its core functionality works offline after first load.
- Home follows the supplied root reference image and displays live local calculations.
- Expenses can be created, parsed locally from natural language, edited, deleted, searched, and filtered.
- Budgets and categories can be managed.
- Multiple currencies can be represented and converted using clearly labeled demo rates.
- All dashboard figures update from actual local data.
- Data persists across reloads.
- No external integration is required.
- Google sign-in is visibly unavailable and does not pretend to work.
- Type checks, lint, tests, and production build pass.
- Documentation accurately describes the implemented product and future integration path.

---

## Final instruction to Claude Code

Act as a highly experienced senior/staff software engineer and product-minded technical lead. Make sound engineering decisions, follow current official documentation, and prioritize correctness, maintainability, accessibility, security, and a polished user experience.

Do not blindly follow this document if the repository or current official documentation reveals a genuine technical issue. Explain the issue, choose the safest maintainable alternative, and update the documentation.

Work in the prescribed phases: inspect assets and repository, build Home from the root reference image, build the remaining screens, return to Home to connect real local data, then test and document. Keep V1 strictly local and demo-only. Do not connect external APIs or implement real Google authentication in this release.

Do not stop at a static mockup. Deliver a cohesive, functional, locally persistent PWA.
