alter table public.money_months
  add column if not exists saved_at timestamptz,
  add column if not exists saved_revision integer not null default 0,
  add column if not exists saved_snapshot jsonb,
  add column if not exists dirty_since_save boolean not null default false;

create table if not exists public.money_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emergency_reserve_target numeric(14,2) not null default 0 check (emergency_reserve_target >= 0),
  updated_at timestamptz not null default now()
);

alter table public.money_preferences enable row level security;

drop policy if exists money_preferences_select on public.money_preferences;
drop policy if exists money_preferences_insert on public.money_preferences;
drop policy if exists money_preferences_update on public.money_preferences;
create policy money_preferences_select on public.money_preferences
  for select using (public.money_allowed_user() and user_id=auth.uid());
create policy money_preferences_insert on public.money_preferences
  for insert with check (public.money_allowed_user() and user_id=auth.uid());
create policy money_preferences_update on public.money_preferences
  for update using (public.money_allowed_user() and user_id=auth.uid())
  with check (public.money_allowed_user() and user_id=auth.uid());

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='money_preferences_updated_at') then
    create trigger money_preferences_updated_at
    before update on public.money_preferences
    for each row execute function public.money_set_updated_at();
  end if;
end $$;

create or replace function public.money_save_month(p_month_id uuid, p_snapshot jsonb)
returns public.money_months
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid:=auth.uid();
  v_row public.money_months%rowtype;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;

  update public.money_months
  set saved_at=now(),
      saved_revision=saved_revision+1,
      saved_snapshot=coalesce(p_snapshot,'{}'::jsonb),
      dirty_since_save=false
  where id=p_month_id and user_id=v_uid
  returning * into v_row;

  if not found then raise exception 'Invalid month'; end if;
  return v_row;
end;
$$;

create or replace function public.money_mark_month_dirty(p_month_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_uid uuid:=auth.uid();
  v_count integer:=0;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;

  update public.money_months
  set dirty_since_save=true
  where id=p_month_id and user_id=v_uid and saved_at is not null and dirty_since_save=false;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.money_save_month(uuid,jsonb) from public, anon;
revoke all on function public.money_mark_month_dirty(uuid) from public, anon;
grant execute on function public.money_save_month(uuid,jsonb) to authenticated;
grant execute on function public.money_mark_month_dirty(uuid) to authenticated;
