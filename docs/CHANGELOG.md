# Changelog

## 2026-10-30 — Hosting

- Repo on GitHub (`aaronchavarry/pockit`, branch `main`) and Vercel project `pockit` linked to it: every push to `main` deploys to production at https://pockit-five.vercel.app. Still the local-only demo: no env vars, no backend, data stays in the browser.
- Supabase project `pockit` (eu-north-1) created with the initial schema and RLS (`supabase/migrations/`). Not wired into the app yet.

## 0.1.1 — 2026-10-30 — UI restyle from `ui-reference.jpg`

Visual only. Flows, data and copy are unchanged.

### Changed
- Tokens: white canvas, cool neutral grays, hairline borders, smaller radii (card 1rem, field 0.75rem, tile 0.625rem). `ink-4` added for large/decorative text only.
- Primary buttons, focus ring and active states use near-black ink. Teal stays for the logo, budget progress and "on track".
- Mobile bottom nav: Home · Expenses · black add pill · Budgets · Categories. The Home floating add button and the mobile "Add" button on Expenses are gone (desktop keeps its header button). `ExpenseEditorProvider` now wraps the whole shell so the nav can open it.
- Desktop sidebar: neutral active item (grey fill, black text) instead of teal.
- Home: uppercase section labels with hairlines, lighter big figure, thinner progress bar, flat recent rows. Category bars without a budget use neutral grey.
- Expense rows: flat, no tile ring, square icon tiles. Day headers get a hairline.
- Inputs: filled grey, no border until hover/focus. Segmented control and add-sheet tabs: grey track with white selected chip.
- Dialogs, toasts, badges, empty states and category/budget cards restyled to match. Theme color/manifest now `#FFFFFF`.
- Home pass 2: iOS-like palette (system grays, livelier teal/orange), bold large titles, iOS segmented control. Spent figure and budget bar centered. Category bars: rounded columns, every spent fill orange in a different tone (darkest = over budget), free emojis, no % under bars, no legend, no "Categories" heading or rule (kept for screen readers), hidden scrollbar and right edge cut off to hint at more. "Recent" is a bold title-case heading without a rule.
- Home pass 3: budget progress bar replaced by a usage tag with a small ring meter ("78% of €1,600"); the figure shows only currency, amount and "€x left" / "€x over". Category bars and Recent sit in cards (white, hairline, soft shadow). Bar orange now deepens with how much of the budget (or of the top unbudgeted category) is used, instead of alternating per category. Fixed a vertical scroll inside the bars row. Mobile nav is now a floating rounded bar. Semantic green/red tokens (`positive`, `negative`) sampled from `ui-reference.jpg`; the ring/tag use green → orange (≥80%) → red (over).
- Home pass 4: category bars are out of the card again (Recent keeps its card). Cards have no shadow. Mobile nav floats with a light translucent blur, no shadow. Selected nav icon is solid; Expenses now uses a receipt icon and Budgets a pie icon so the solid state is visible. "€x left" and the usage tag share one line. "On track" badges use the green semantic color.
- Home pass 5: motion — route content fades/slides in on every module change, the mobile nav has a sliding highlight behind the active tab, and the selected icon pops in (all disabled by `prefers-reduced-motion`). Category bars are now grey → near-black by how much is used (red when over). Week/month: active option is black with white text. "Left" and usage merged into one capsule: ring meter · "€x left" · "78% of €1,600".


## 0.1.0 — 2026-10-30 — V1 local demo

### Added
- Next.js 16 + TypeScript + Tailwind v4 project. Geist font, design tokens (#FFFBFB / #0F766E / #F97316).
- Entry screen: working "Try demo" and a disabled "Continue with Google (Coming soon)".
- App shell with a desktop sidebar, mobile bottom nav, Demo mode dialog (reset demo / back to welcome) and toasts.
- Home based on `home-reference.png`: week/month toggle, spent/budget figure, progress bar, % used and remaining/over, category bars, recent expenses, add button. All figures come from local data.
- Expenses: grouped list, search, filters (category, currency, date range, amount range), add/edit/delete with confirmation.
- Natural-language entry with a deterministic local parser (`ExpenseUnderstandingService`). It creates the expense directly when amount + description are present, and asks otherwise.
- Local categorization from category names, keywords and descriptions (`ExpenseCategorizationService`). Uncertain → Uncategorized.
- Budgets: weekly, monthly, yearly, custom-start monthly, fixed range. Overall and per category. Conflict checks, versioned edits, end/cancel, history, and 80% / 100% / over states.
- Categories: CRUD with case-insensitive unique names. Delete moves expenses and ends category budgets atomically.
- Currency: integer minor units, BigInt conversion, static labelled demo rates, and a visible note when a rate is missing.
- IndexedDB persistence (`pockit-demo` v1), in-memory fallback with a warning, demo seed relative to today.
- PWA: manifest, build-time generated icons, service worker with offline support for all screens.
- Tests: 78 unit/integration tests (Vitest) and 22 end-to-end runs (Playwright, mobile + desktop).
- Docs: PROJECT, ARCHITECTURE, DATABASE, CHANGELOG.

### Decisions / deviations
- Budget uniqueness is enforced per scope **and cadence** (one weekly + one monthly overall budget can coexist) so Home's Week/Month toggle works. Documented in PROJECT.md.
- Expense date/time is stored as `occurredOn` (plain date) + `occurredTime` + `timezone` instead of a single `occurredAt` instant.
- Budget status is derived from `effectiveFrom`/`closedOn`/`endDate` instead of being stored.
- Recurrence is metadata only. Occurrences are not auto-generated in V1.
