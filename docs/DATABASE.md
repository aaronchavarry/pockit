# Pockit — Local data schema

## Storage

- IndexedDB database **`pockit-demo`**, schema version **1** (`src/data/indexeddb-store.ts`).
- The name is namespaced to the demo so future real-user data never mixes with demo data.
- Object stores:

| Store | Key | Contents |
|---|---|---|
| `expenses` | `id` | `Expense` |
| `budgets` | `id` | `Budget` |
| `categories` | `id` | `Category` |
| `meta` | out-of-line key | `"preferences"` → `Preferences` |

- Migrations: add `if (event.oldVersion < N)` blocks in `onupgradeneeded` and bump `DB_VERSION`.
- Multi-record changes (category delete, budget versioning) use one `readwrite` transaction across stores.
- Small datasets are loaded fully into memory. Everything else is computed from them.

## Entities (`src/domain/types.ts`)

### Expense
| Field | Type | Notes |
|---|---|---|
| id | string | `exp_<uuid>` |
| amountMinor | integer | original amount in minor units (cents; yen has 0 decimals) |
| currency | ISO 4217 | original currency, never changed by conversion |
| description | string | required |
| merchant | string \| null | |
| categoryId | string \| null | null = Uncategorized |
| occurredOn | `YYYY-MM-DD` | user's calendar date (spec's `occurredAt`, split for timezone safety) |
| occurredTime | `HH:mm` \| null | |
| timezone | IANA tz | timezone at entry |
| recurrence | `none\|daily\|weekly\|monthly\|yearly` | label only in V1 |
| source | `manual\|natural_language\|email` | |
| sourceReference | string \| null | future: email message / transaction id for dedupe |
| createdAt / updatedAt | ISO timestamp | |

### Budget
| Field | Type | Notes |
|---|---|---|
| id, name | string | |
| amountMinor, currency | integer, ISO | limit |
| scope | `overall\|category` | |
| categoryId | string \| null | null for overall |
| periodType | `weekly\|monthly\|yearly\|custom_recurring\|fixed_range` | |
| startDate | date | rule start / range start |
| endDate | date \| null | fixed_range end; null for recurring |
| anchorDay | 1–28 \| null | custom_recurring start day |
| effectiveFrom | date | first day this record is in force |
| closedOn | date \| null | last day in force (closed or replaced) |
| supersedesBudgetId | string \| null | previous version |
| createdAt / updatedAt | timestamp | |

`status` (`scheduled|active|closed`) is **derived** from `effectiveFrom`, `closedOn`, `endDate` and today. It is not stored.

### Category
`id, name, description, keywords[], icon (emoji), isSystem, createdAt, updatedAt`. There is no colour field (by spec).

### Preferences
`defaultCurrency` (EUR), `locale` (`en-IE`), `timezone` (device tz at seed).

### ExchangeRate (static, not stored)
`baseCurrency, quoteCurrency, rate (decimal string), rateDate, source, isDemoRate` in `src/services/currency/demo-rates.ts`.

## Relationships

- Expense.categoryId → Category.id (soft reference; dangling ids are treated as Uncategorized).
- Budget.categoryId → Category.id (category budgets end when the category is deleted).
- Budget.supersedesBudgetId → Budget.id (version chain).

## Future Supabase mapping (not implemented)

- Tables `expenses`, `budgets`, `categories`, `preferences` with a `user_id uuid references auth.users` column and RLS `user_id = auth.uid()`.
- `amount_minor bigint`, `currency char(3)`, dates as `date`, timestamps as `timestamptz`.
- `email_imports` table (provider message id, status, skip reason) with a unique `(user_id, provider, message_id)`. Add `expenses.source_reference` unique per user for dedupe.
- `exchange_rates (base, quote, rate numeric, rate_date, source)` with a unique `(base, quote, rate_date, source)`.
- The demo DB stays separate. Importing demo data into an account would be an explicit, optional action.
