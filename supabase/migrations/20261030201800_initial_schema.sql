-- Pockit initial cloud schema.
-- Mirrors the local domain model (src/domain/types.ts). Every user-owned row
-- carries user_id and is isolated by RLS. Money is integer minor units.
-- IDs are client-generated text ("exp_<uuid>", ...) so offline-created records
-- keep their identity when synced.

-- updated_at maintenance ----------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- categories ----------------------------------------------------------------

create table public.categories (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 60),
  description text not null default '' check (char_length(description) <= 500),
  keywords text[] not null default '{}',
  icon text not null default '' check (char_length(icon) <= 16),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for the composite FK from expenses (keeps references inside one user).
  unique (user_id, id)
);

-- Case-insensitive unique names per user (spec 4.6).
create unique index categories_user_name_key on public.categories (user_id, lower(btrim(name)));

-- expenses ------------------------------------------------------------------

create table public.expenses (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  description text not null check (btrim(description) <> '' and char_length(description) <= 200),
  merchant text check (char_length(merchant) <= 120),
  -- null = Uncategorized. Deleting a category keeps the expense (spec 4.6).
  category_id text,
  occurred_on date not null,
  occurred_time time,
  timezone text not null,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  source text not null default 'manual' check (source in ('manual', 'natural_language', 'email')),
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, category_id) references public.categories (user_id, id) on delete set null (category_id)
);

create index expenses_user_occurred_idx on public.expenses (user_id, occurred_on desc);
create index expenses_user_category_idx on public.expenses (user_id, category_id);
-- Email import dedupe: one expense per source reference per user.
create unique index expenses_user_source_ref_key on public.expenses (user_id, source_reference)
  where source_reference is not null;

-- budgets -------------------------------------------------------------------

create table public.budgets (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  scope text not null check (scope in ('overall', 'category')),
  -- Soft reference: category budgets are closed, not deleted, when their category goes.
  category_id text,
  period_type text not null check (period_type in ('weekly', 'monthly', 'yearly', 'custom_recurring', 'fixed_range')),
  start_date date not null,
  end_date date,
  anchor_day smallint check (anchor_day between 1 and 28),
  effective_from date not null,
  closed_on date,
  -- Version chain; status is derived from dates at read time, never stored.
  supersedes_budget_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'overall') = (category_id is null)),
  check ((period_type = 'fixed_range') = (end_date is not null)),
  check ((period_type = 'custom_recurring') = (anchor_day is not null)),
  -- closed_on may precede effective_from: cancelling a scheduled budget closes it before it starts.
  check (end_date is null or end_date >= start_date)
);

create index budgets_user_idx on public.budgets (user_id);

-- preferences ---------------------------------------------------------------

create table public.preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  default_currency char(3) not null default 'EUR' check (default_currency ~ '^[A-Z]{3}$'),
  locale text not null default 'en-IE',
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);

-- email_imports (future Gmail sync; written only by the backend) ------------

create table public.email_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'gmail' check (provider in ('gmail')),
  message_id text not null,
  status text not null check (status in ('imported', 'skipped', 'failed')),
  skip_reason text,
  expense_id text,
  received_at timestamptz,
  processed_at timestamptz not null default now(),
  unique (user_id, provider, message_id)
);

create index email_imports_user_processed_idx on public.email_imports (user_id, processed_at desc);

-- exchange_rates (shared reference data; written only by the backend) -------

create table public.exchange_rates (
  base_currency char(3) not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency char(3) not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate numeric(24, 12) not null check (rate > 0),
  rate_date date not null,
  source text not null,
  is_demo_rate boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (base_currency, quote_currency, rate_date, source)
);

-- triggers ------------------------------------------------------------------

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();
create trigger preferences_updated_at before update on public.preferences
  for each row execute function public.set_updated_at();

-- row level security --------------------------------------------------------

alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.preferences enable row level security;
alter table public.email_imports enable row level security;
alter table public.exchange_rates enable row level security;

-- Owner-only CRUD for the user's own data.
create policy "Own categories" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own expenses" on public.expenses for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own budgets" on public.budgets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own preferences" on public.preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Users can read their import log; only the service role writes it.
create policy "Read own email imports" on public.email_imports for select to authenticated
  using ((select auth.uid()) = user_id);

-- Rates are readable by signed-in users; only the service role writes them.
create policy "Read exchange rates" on public.exchange_rates for select to authenticated
  using (true);
