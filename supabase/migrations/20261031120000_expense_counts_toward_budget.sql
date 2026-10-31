-- Expenses can be kept out of budget totals (e.g. a flight). Default: counted.
alter table public.expenses add column counts_toward_budget boolean not null default true;

-- apply_changes must also update the new column on upsert.
create or replace function public.apply_changes(changes jsonb)
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
          -- Clients that predate the column omit it: keep the default instead of inserting null.
          r := r || jsonb_build_object('counts_toward_budget', coalesce((r ->> 'counts_toward_budget')::boolean, true));
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
            source_reference = excluded.source_reference,
            counts_toward_budget = excluded.counts_toward_budget;
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
