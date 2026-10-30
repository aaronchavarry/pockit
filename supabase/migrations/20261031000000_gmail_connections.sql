-- Gmail import (BCP card notifications), read-only, synced hourly.
-- The Google refresh token lives in Supabase Vault; only the Edge Functions
-- (service role) can read it, through the security-definer functions below.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Connection status, visible to its owner -----------------------------------

create table public.gmail_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_email text not null,
  status text not null default 'active' check (status in ('active', 'needs_reconnect')),
  last_synced_at timestamptz,
  last_error text,
  -- Only messages received after this instant are fetched (moves forward each sync).
  sync_after timestamptz not null default now() - interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger gmail_connections_updated_at before update on public.gmail_connections
  for each row execute function public.set_updated_at();

alter table public.gmail_connections enable row level security;
create policy "Read own Gmail connection" on public.gmail_connections for select to authenticated
  using ((select auth.uid()) = user_id);

-- Private bookkeeping (schema not exposed to the API) -------------------------

create table private.gmail_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  secret_id uuid not null
);

create table private.gmail_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  return_to text not null,
  created_at timestamptz not null default now()
);

-- Service-role helpers for the Edge Functions ---------------------------------

create function public.gmail_create_state(p_user_id uuid, p_return_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare s text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  delete from private.gmail_oauth_states where created_at < now() - interval '15 minutes';
  insert into private.gmail_oauth_states (state, user_id, return_to) values (s, p_user_id, p_return_to);
  return s;
end;
$$;

-- Single use: returns the row once and deletes it. Expired states return nothing.
create function public.gmail_consume_state(p_state text)
returns table (user_id uuid, return_to text)
language sql
security definer
set search_path = ''
as $$
  delete from private.gmail_oauth_states s
  where s.state = p_state and s.created_at > now() - interval '15 minutes'
  returning s.user_id, s.return_to;
$$;

create function public.gmail_save_connection(p_user_id uuid, p_google_email text, p_refresh_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare existing uuid;
begin
  select secret_id into existing from private.gmail_tokens where user_id = p_user_id;
  if existing is null then
    insert into private.gmail_tokens (user_id, secret_id)
    values (p_user_id, vault.create_secret(p_refresh_token, 'gmail_refresh_' || p_user_id::text, 'Gmail refresh token'));
  else
    perform vault.update_secret(existing, p_refresh_token);
  end if;

  insert into public.gmail_connections (user_id, google_email, status, last_error)
  values (p_user_id, p_google_email, 'active', null)
  on conflict (user_id) do update
    set google_email = excluded.google_email, status = 'active', last_error = null;
end;
$$;

create function public.gmail_get_refresh_token(p_user_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select d.decrypted_secret
  from private.gmail_tokens t
  join vault.decrypted_secrets d on d.id = t.secret_id
  where t.user_id = p_user_id;
$$;

-- Shared secret the hourly cron sends to the gmail-sync function.
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'pockit_cron_token',
  'Authenticates pg_cron calls to the gmail-sync Edge Function'
);

create function public.gmail_cron_token_valid(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'pockit_cron_token' and decrypted_secret = p_token);
$$;

revoke execute on function public.gmail_create_state(uuid, text) from public, anon, authenticated;
revoke execute on function public.gmail_consume_state(text) from public, anon, authenticated;
revoke execute on function public.gmail_save_connection(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.gmail_get_refresh_token(uuid) from public, anon, authenticated;
revoke execute on function public.gmail_cron_token_valid(text) from public, anon, authenticated;
grant execute on function public.gmail_create_state(uuid, text) to service_role;
grant execute on function public.gmail_consume_state(text) to service_role;
grant execute on function public.gmail_save_connection(uuid, text, text) to service_role;
grant execute on function public.gmail_get_refresh_token(uuid) to service_role;
grant execute on function public.gmail_cron_token_valid(text) to service_role;

-- User action: disconnect removes the token and the connection -------------

create function public.gmail_disconnect()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); sid uuid;
begin
  if uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  delete from private.gmail_tokens where user_id = uid returning secret_id into sid;
  if sid is not null then
    delete from vault.secrets where id = sid;
  end if;
  delete from public.gmail_connections where user_id = uid;
end;
$$;

revoke execute on function public.gmail_disconnect() from public, anon;
grant execute on function public.gmail_disconnect() to authenticated;

-- Hourly sync -----------------------------------------------------------------

select cron.schedule(
  'gmail-sync-hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://yhjdsjlysdoqosbhjyfw.supabase.co/functions/v1/gmail-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'pockit_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
