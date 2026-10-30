-- 1. Primary keys become (user_id, id). Client ids are only unique per user:
--    built-in categories use fixed ids ("cat-groceries") in every account.
alter table public.expenses drop constraint expenses_user_id_category_id_fkey;
alter table public.categories drop constraint categories_user_id_id_key;
alter table public.categories drop constraint categories_pkey;
alter table public.categories add primary key (user_id, id);
alter table public.expenses drop constraint expenses_pkey;
alter table public.expenses add primary key (user_id, id);
alter table public.budgets drop constraint budgets_pkey;
alter table public.budgets add primary key (user_id, id);
alter table public.expenses
  add constraint expenses_user_id_category_id_fkey foreign key (user_id, category_id)
  references public.categories (user_id, id) on delete set null (category_id);

-- 2. Atomic batch writes for the app's Store.transaction().
--    changes: [{ "collection": "expenses"|"budgets"|"categories",
--                "op": "put", "row": {...snake_case columns...} }
--              | { "collection": ..., "op": "delete", "id": "..." }]
--    Runs as the caller, so RLS applies; user_id is always forced to auth.uid().
create function public.apply_changes(changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c jsonb;
  coll text;
  r jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) <> 'array' then
    raise exception 'changes must be an array' using errcode = '22023';
  end if;

  for c in select value from jsonb_array_elements(changes) loop
    coll := c ->> 'collection';

    if c ->> 'op' = 'delete' then
      case coll
        when 'expenses' then delete from public.expenses where user_id = uid and id = c ->> 'id';
        when 'budgets' then delete from public.budgets where user_id = uid and id = c ->> 'id';
        when 'categories' then delete from public.categories where user_id = uid and id = c ->> 'id';
        else raise exception 'Unknown collection %', coll using errcode = '22023';
      end case;

    elsif c ->> 'op' = 'put' then
      r := (c -> 'row') || jsonb_build_object('user_id', uid);
      case coll
        when 'expenses' then
          insert into public.expenses
          select * from jsonb_populate_record(null::public.expenses, r)
          on conflict (user_id, id) do update set
            amount_minor = excluded.amount_minor,
            currency = excluded.currency,
            description = excluded.description,
            merchant = excluded.merchant,
            category_id = excluded.category_id,
            occurred_on = excluded.occurred_on,
            occurred_time = excluded.occurred_time,
            timezone = excluded.timezone,
            recurrence = excluded.recurrence,
            source = excluded.source,
            source_reference = excluded.source_reference;
        when 'budgets' then
          insert into public.budgets
          select * from jsonb_populate_record(null::public.budgets, r)
          on conflict (user_id, id) do update set
            name = excluded.name,
            amount_minor = excluded.amount_minor,
            currency = excluded.currency,
            scope = excluded.scope,
            category_id = excluded.category_id,
            period_type = excluded.period_type,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            anchor_day = excluded.anchor_day,
            effective_from = excluded.effective_from,
            closed_on = excluded.closed_on,
            supersedes_budget_id = excluded.supersedes_budget_id;
        when 'categories' then
          insert into public.categories
          select * from jsonb_populate_record(null::public.categories, r)
          on conflict (user_id, id) do update set
            name = excluded.name,
            description = excluded.description,
            keywords = excluded.keywords,
            icon = excluded.icon,
            is_system = excluded.is_system;
        else raise exception 'Unknown collection %', coll using errcode = '22023';
      end case;

    else
      raise exception 'Unknown op %', c ->> 'op' using errcode = '22023';
    end if;
  end loop;
end;
$$;

revoke execute on function public.apply_changes(jsonb) from public, anon;
grant execute on function public.apply_changes(jsonb) to authenticated;
