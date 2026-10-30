# Pockit — Architecture (as implemented)

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict, `noUncheckedIndexedAccess`)
- Tailwind CSS v4 (tokens in `src/app/globals.css` `@theme`)
- Geist via the `geist` package (fonts are bundled locally, no Google Fonts fetch)
- Persistence: IndexedDB through a small hand-written wrapper (no extra dependency), with an in-memory fallback
- Tests: Vitest (+ `fake-indexeddb`) for domain/application, Playwright for end-to-end
- No UI library: primitives are in `src/components/ui`, and dialogs use the native `<dialog>` element

All pages are static. Data lives only in the browser, so screens are client components under one `DataProvider`.

## Folders

```text
src/
  app/                    routes only
    page.tsx              entry screen (outside the app shell)
    (app)/layout.tsx      app shell: DataProvider, toasts, nav, expense editor
    (app)/home|expenses|budgets|categories/page.tsx
    manifest.ts           PWA manifest
    icons/[name]/route.tsx  PNG icons generated at build time (next/og)
  domain/                 pure types + rules, no I/O
    types.ts              Expense, Budget, Category, Preferences, ExchangeRate
    budget.ts             periods, validity, status, conflicts, warning levels
  application/            use cases (validate → service → repository)
    expenses.ts           validate, create/update/delete, quickAddExpense (NL)
    budgets.ts            validate, create, editBudget (versioning), closeBudget
    categories.ts         validate, create/update, deleteCategory (atomic reassignment)
    insights.ts           totals, budgetProgress, buildDashboard, filterExpenses
  services/               replaceable providers behind interfaces
    expense-understanding/  ExpenseUnderstandingService + LocalExpenseUnderstandingService
    categorization/         ExpenseCategorizationService + LocalCategorizationService
    currency/               CurrencyRateService + StaticCurrencyRateService (demo rates)
  data/                   infrastructure
    repositories.ts       Repository<T>, Store (incl. transaction) interfaces
    indexeddb-store.ts    IndexedDB implementation (versioned schema)
    memory-store.ts       fallback / tests
    seed.ts               demo seed, relative to today
  state/                  React glue
    data-provider.tsx     opens store, seeds, loads, mutate(), resetDemo(), today
    use-format.ts         locale-bound formatters
  components/             ui/, layout/, home/, expenses/, budgets/, categories/
  lib/                    dates, money, ids, result
  tests/setup.ts
e2e/                      Playwright specs (run against the production build)
public/sw.js              service worker
```

## Data flow

```
UI component ──calls──▶ application use case ──▶ services (parse/categorize/convert)
      ▲                         │
      │                         ▼
DataProvider.mutate(fn) ──▶ Store (IndexedDB) ──reload──▶ AppData (React state)
      │
      └─ selectors (buildDashboard, budgetProgress, filterExpenses) derive every figure
```

- Components never touch storage directly. They call `mutate(store => useCase(store, …))`, and the provider reloads afterwards.
- Every number on screen comes from `application/insights.ts`. No totals are stored.
- Money math uses integer minor units. Conversion uses BigInt with rates scaled by 1e8 and rounds once.

## Service boundaries (for future providers)

| Interface | V1 implementation | Future |
|---|---|---|
| `ExpenseUnderstandingService` | deterministic local parser | server-side OpenAI adapter with schema-validated output, keeping the local fallback |
| `ExpenseCategorizationService` | keyword/name/description matcher | AI categorizer; must still return `null` when unsure |
| `CurrencyRateService` | static demo dataset | free rate API with caching and historical rates |
| `Store` / `Repository<T>` | IndexedDB (`pockit-demo` DB) | Supabase adapter with RLS, per-user namespace |
| `EmailTransactionSource` | — (not created) | Gmail import job on a secure backend; dedupe via `sourceReference` |

## Key decisions

- **Plain dates** (`YYYY-MM-DD`) instead of instants for expenses and budgets. This avoids DST and month-boundary bugs. Time is stored separately and is optional.
- **Budget validity vs period**: `effectiveFrom`/`closedOn` say when a record is in force, and `periodType`/`anchorDay`/`startDate`/`endDate` define the spending window. This lets versioning keep history without breaking the current period's figures.
- **Per-cadence uniqueness** for budgets (see PROJECT.md for why this deviates from the spec).
- **Status derived on read**, so no background scheduler is needed for activation or closing.
- **Single expense editor** (`ExpenseEditorProvider`) shared across screens. It wraps the whole app shell so the mobile nav add pill can open it.
- **Service worker** registers in production only. It is network-first for pages and cache-first for hashed `/_next/static` assets. It precaches every route plus the assets each route references, and never caches cross-origin, non-GET or RSC requests.
- **Storage fallback**: if IndexedDB fails to open, an in-memory store is used and a banner warns that changes won't persist.
- `navigator.storage.persist()` is requested on a best-effort basis.
