create extension if not exists citext;

create table if not exists public.money_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name citext not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.money_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.money_categories(id),
  name citext not null,
  default_planned_amount numeric(12,2) not null default 0 check (default_planned_amount >= 0),
  due_day integer check (due_day between 1 and 31),
  is_recurring boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.money_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  income numeric(12,2) not null default 0 check (income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_key)
);

create table if not exists public.money_month_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_id uuid not null references public.money_months(id) on delete cascade,
  item_id uuid references public.money_items(id),
  category_id uuid references public.money_categories(id),
  name_snapshot text not null,
  category_snapshot text not null,
  planned_amount numeric(12,2) not null default 0 check (planned_amount >= 0),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month_id, item_id)
);

create table if not exists public.money_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name citext not null,
  debt_type text not null check (debt_type in ('loan','credit')),
  opening_balance numeric(12,2) not null default 0 check (opening_balance >= 0),
  current_balance numeric(12,2) not null default 0 check (current_balance >= 0),
  monthly_plan numeric(12,2) not null default 0 check (monthly_plan >= 0),
  apr numeric(8,4) check (apr is null or apr >= 0),
  focus_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists money_debts_unique_active_name
on public.money_debts (user_id, lower(name::text))
where is_active;

create table if not exists public.money_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_id uuid not null references public.money_months(id) on delete cascade,
  month_item_id uuid references public.money_month_items(id),
  debt_id uuid references public.money_debts(id),
  payment_type text not null check (payment_type in ('expense','debt')),
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null,
  note text,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  check (
    (payment_type = 'expense' and month_item_id is not null and debt_id is null)
    or
    (payment_type = 'debt' and debt_id is not null and month_item_id is null)
  )
);

create index if not exists money_items_category_idx on public.money_items(category_id);
create index if not exists money_month_items_user_idx on public.money_month_items(user_id);
create index if not exists money_month_items_category_idx on public.money_month_items(category_id);
create index if not exists money_payments_user_idx on public.money_payments(user_id);
create index if not exists money_payments_month_idx on public.money_payments(month_id);
create index if not exists money_payments_month_item_idx on public.money_payments(month_item_id) where reversed_at is null;
create index if not exists money_payments_debt_idx on public.money_payments(debt_id) where reversed_at is null;

create or replace function public.money_allowed_user()
returns boolean
language sql
stable
security invoker
set search_path = public, auth
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt() ->> 'email', '') = 'naappe@gmail.com';
$$;

create or replace function public.money_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='money_categories_updated_at') then
    create trigger money_categories_updated_at before update on public.money_categories
    for each row execute function public.money_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='money_items_updated_at') then
    create trigger money_items_updated_at before update on public.money_items
    for each row execute function public.money_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='money_months_updated_at') then
    create trigger money_months_updated_at before update on public.money_months
    for each row execute function public.money_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='money_month_items_updated_at') then
    create trigger money_month_items_updated_at before update on public.money_month_items
    for each row execute function public.money_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='money_debts_updated_at') then
    create trigger money_debts_updated_at before update on public.money_debts
    for each row execute function public.money_set_updated_at();
  end if;
end $$;

alter table public.money_categories enable row level security;
alter table public.money_items enable row level security;
alter table public.money_months enable row level security;
alter table public.money_month_items enable row level security;
alter table public.money_debts enable row level security;
alter table public.money_payments enable row level security;

-- Idempotently recreate policies so this migration can be reviewed/reapplied safely.
do $$
declare
  t text;
begin
  foreach t in array array['money_categories','money_items','money_months','money_month_items','money_debts','money_payments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select using (public.money_allowed_user() and user_id = auth.uid())', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (public.money_allowed_user() and user_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.money_allowed_user() and user_id = auth.uid()) with check (public.money_allowed_user() and user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.money_allowed_user() and user_id = auth.uid())', t || '_delete', t);
  end loop;
end $$;

create or replace function public.money_create_month(p_month_key text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_month_id uuid;
  v_first date;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  if p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month'; end if;
  if p_month_key < '2026-09' then raise exception 'Money Plan starts in September 2026'; end if;

  insert into public.money_months(user_id, month_key)
  values (v_uid, p_month_key)
  on conflict (user_id, month_key) do update set month_key=excluded.month_key
  returning id into v_month_id;

  v_first := to_date(p_month_key || '-01','YYYY-MM-DD');

  insert into public.money_month_items(user_id, month_id, item_id, category_id, name_snapshot, category_snapshot, planned_amount, due_date)
  select v_uid, v_month_id, i.id, i.category_id, i.name::text,
         coalesce(c.name::text,'Other'), i.default_planned_amount,
         case when i.due_day is null then null else
           make_date(extract(year from v_first)::int, extract(month from v_first)::int,
             least(i.due_day, extract(day from (date_trunc('month',v_first) + interval '1 month - 1 day'))::int)) end
  from public.money_items i
  left join public.money_categories c on c.id=i.category_id
  where i.user_id=v_uid and i.is_active and i.is_recurring
  on conflict (month_id,item_id) do nothing;

  return v_month_id;
end;
$$;

create or replace function public.money_bootstrap_september()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_month_id uuid;
  v_names text[] := array['Family','Utilities','Food','Credit','Loans','Transport','Other'];
  v_name text;
  v_order int := 0;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.money_months where user_id=v_uid) then
    select id into v_month_id from public.money_months where user_id=v_uid order by month_key limit 1;
    return v_month_id;
  end if;

  foreach v_name in array v_names loop
    insert into public.money_categories(user_id,name,display_order)
    values(v_uid,v_name,v_order)
    on conflict(user_id,name) do nothing;
    v_order := v_order + 1;
  end loop;

  v_month_id := public.money_create_month('2026-09');
  return v_month_id;
end;
$$;

create or replace function public.money_record_payment(
  p_month_id uuid,
  p_payment_type text,
  p_amount numeric,
  p_payment_date date,
  p_month_item_id uuid default null,
  p_debt_id uuid default null,
  p_note text default null
)
returns table(payment_id uuid, effective_amount numeric, debt_balance numeric)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_effective numeric(12,2);
  v_balance numeric(12,2);
  v_payment uuid;
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_type not in ('expense','debt') then raise exception 'Invalid payment type'; end if;
  if not exists(select 1 from public.money_months where id=p_month_id and user_id=v_uid) then raise exception 'Invalid month'; end if;

  if p_payment_type='expense' then
    if p_month_item_id is null or p_debt_id is not null then raise exception 'Expense payment requires month item only'; end if;
    if not exists(select 1 from public.money_month_items where id=p_month_item_id and month_id=p_month_id and user_id=v_uid) then raise exception 'Invalid month item'; end if;
    v_effective := round(p_amount,2);
    v_balance := null;
  else
    if p_debt_id is null or p_month_item_id is not null then raise exception 'Debt payment requires debt only'; end if;
    select current_balance into v_balance
    from public.money_debts
    where id=p_debt_id and user_id=v_uid and is_active
    for update;
    if not found then raise exception 'Invalid debt'; end if;
    if v_balance <= 0 then raise exception 'Debt is already paid'; end if;
    v_effective := least(round(p_amount,2),v_balance);
    v_balance := round(v_balance-v_effective,2);
    update public.money_debts
      set current_balance=v_balance, is_active=(v_balance>0)
      where id=p_debt_id and user_id=v_uid;
  end if;

  insert into public.money_payments(user_id,month_id,month_item_id,debt_id,payment_type,amount,payment_date,note)
  values(v_uid,p_month_id,p_month_item_id,p_debt_id,p_payment_type,v_effective,p_payment_date,nullif(trim(p_note),''))
  returning id into v_payment;

  return query select v_payment,v_effective,v_balance;
end;
$$;

create or replace function public.money_reverse_payment(p_payment_id uuid, p_reason text)
returns numeric
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.money_payments%rowtype;
  v_balance numeric(12,2);
begin
  if not public.money_allowed_user() then raise exception 'Not authorized'; end if;
  select * into v_payment from public.money_payments
    where id=p_payment_id and user_id=v_uid for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.reversed_at is not null then raise exception 'Payment already reversed'; end if;

  update public.money_payments
    set reversed_at=now(), reversal_reason=coalesce(nullif(trim(p_reason),''),'Correction')
    where id=p_payment_id and user_id=v_uid;

  if v_payment.payment_type='debt' then
    update public.money_debts
      set current_balance=round(current_balance+v_payment.amount,2), is_active=true
      where id=v_payment.debt_id and user_id=v_uid
      returning current_balance into v_balance;
  end if;
  return v_balance;
end;
$$;

revoke all on function public.money_allowed_user() from public, anon;
revoke all on function public.money_create_month(text) from public, anon;
revoke all on function public.money_bootstrap_september() from public, anon;
revoke all on function public.money_record_payment(uuid,text,numeric,date,uuid,uuid,text) from public, anon;
revoke all on function public.money_reverse_payment(uuid,text) from public, anon;
grant execute on function public.money_allowed_user() to authenticated;
grant execute on function public.money_create_month(text) to authenticated;
grant execute on function public.money_bootstrap_september() to authenticated;
grant execute on function public.money_record_payment(uuid,text,numeric,date,uuid,uuid,text) to authenticated;
grant execute on function public.money_reverse_payment(uuid,text) to authenticated;
