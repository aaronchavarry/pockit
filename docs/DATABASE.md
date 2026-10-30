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

## Supabase (account mode)

- Project `pockit`, ref `yhjdsjlysdoqosbhjyfw`, region `eu-north-1` (Stockholm), org "aaronou's".
- Migrations (all applied): `20261030201800_initial_schema.sql`, `20261030220000_restrict_signups.sql`, `20261030223000_per_user_keys_and_apply_changes.sql`.
- Used by signed-in accounts through `src/data/supabase-store.ts`. The demo keeps using IndexedDB.
- Primary keys are `(user_id, id)`: client ids are unique per user only (built-in categories reuse `cat-groceries` etc. in every account).
- `public.apply_changes(changes jsonb)`: batch of `{collection, op: "put", row}` / `{collection, op: "delete", id}` applied in one transaction, `security invoker` (RLS applies) and `user_id` forced to `auth.uid()`. Executable by `authenticated` only.
- Gmail (`20261031000000_gmail_connections.sql`): `public.gmail_connections` (one per user: Google email, `active|needs_reconnect`, last sync, last error, `sync_after` cursor; owner can read). Private: `private.gmail_tokens` (Vault secret id of the refresh token) and `private.gmail_oauth_states` (single-use, 15 min). Service-role-only functions: `gmail_create_state`, `gmail_consume_state`, `gmail_save_connection`, `gmail_get_refresh_token`, `gmail_cron_token_valid`. User function: `gmail_disconnect()` (security definer, acts only on `auth.uid()`; the advisor warning about it is expected). pg_cron job `gmail-sync-hourly` (minute 7) calls the `gmail-sync` function through pg_net with the Vault secret `pockit_cron_token`.
- Known advisor warning: extension `pg_net` sits in `public`. Moving it needs a DROP/CREATE that requires owner confirmation; harmless meanwhile.
- Invite-only sign-up: `private.allowed_emails` (schema not exposed to the API) + trigger `enforce_allowed_email` on `auth.users` (insert or email change). Add someone with `insert into private.allowed_emails values ('their@email')`. Currently: the owner's Gmail.
- Tables `categories`, `expenses`, `budgets`, `preferences`: same fields as the local entities in snake_case, plus `user_id uuid` (defaults to `auth.uid()`, cascades on account delete). `amount_minor bigint`, `currency char(3)` (`^[A-Z]{3}$`), dates as `date`, `occurred_time time`, timestamps `timestamptz` with an `updated_at` trigger.
- IDs are client-generated `text` (`exp_<uuid>`, …) so records created offline keep their id when synced.
- Integrity: case-insensitive unique category name per user; `expenses (user_id, category_id)` → `categories (user_id, id)` with `on delete set null (category_id)` (expense kept, becomes Uncategorized, and can never point at another user's category); budget checks for scope/category, fixed_range ⇔ end_date, custom_recurring ⇔ anchor_day. Budget `category_id` and `supersedes_budget_id` stay soft references (closed budgets keep pointing at deleted categories). Budget status is still derived, not stored.
- `email_imports` (future Gmail): `(user_id, provider, message_id)` unique, status `imported|skipped|failed`, skip reason. `expenses (user_id, source_reference)` unique when set, for dedupe.
- `exchange_rates`: shared, PK `(base, quote, rate_date, source)`.
- RLS on every table. Users get full CRUD on their own rows in the four user tables; read-only on their `email_imports` and on `exchange_rates`. Writes to those two are reserved for the service role (backend).
- Verified on 2026-10-30 with two throwaway users: user B could not read, update or delete user A's rows; deleting A's category kept A's expense with `category_id = null`. Test users removed. Security advisor: no findings.
- The demo DB stays separate. Importing demo data into an account would be an explicit, optional action.
