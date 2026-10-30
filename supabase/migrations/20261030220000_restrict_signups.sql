-- Private beta: only allow-listed emails can create an account.
-- The list lives in a schema the Data API does not expose, so clients can
-- neither read nor change it. Add someone: insert their lower-cased email.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.allowed_emails (
  email text primary key check (email = lower(btrim(email))),
  added_at timestamptz not null default now()
);

insert into private.allowed_emails (email) values ('aaron.chavarryx@gmail.com');

create function private.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from private.allowed_emails a where a.email = lower(btrim(new.email))) then
    raise exception 'Pockit is invite-only right now.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enforce_allowed_email
  before insert or update of email on auth.users
  for each row execute function private.enforce_allowed_email();
