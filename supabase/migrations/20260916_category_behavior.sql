alter table public.money_categories
  add column if not exists behavior_type text not null default 'expense';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='money_categories_behavior_type_check'
      and conrelid='public.money_categories'::regclass
  ) then
    alter table public.money_categories
      add constraint money_categories_behavior_type_check
      check (behavior_type in ('liability','expense','receivable'));
  end if;
end $$;

create table if not exists public.money_receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  opening_balance numeric(14,2) not null check (opening_balance >= 0),
  current_balance numeric(14,2) not null check (current_balance >= 0),
  expected_repayment_date date null,
  remarks text null,
  is_active boolean not null default true,
  start_month_key text not null default '2026-09' check (start_month_key ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_receivable_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receivable_id uuid not null references public.money_receivables(id) on delete cascade,
  month_id uuid not null references public.money_months(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('lend','repayment','reversal')),
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null,
  remarks text null,
  reverses_transaction_id uuid null references public.money_receivable_transactions(id) on delete restrict,
  reversed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists money_receivables_user_active_idx
  on public.money_receivables(user_id,is_active);
create index if not exists money_receivable_transactions_receivable_date_idx
  on public.money_receivable_transactions(receivable_id,transaction_date);
create index if not exists money_receivable_transactions_month_idx
  on public.money_receivable_transactions(month_id);
create index if not exists money_receivable_transactions_user_idx
  on public.money_receivable_transactions(user_id);

alter table public.money_receivables enable row level security;
alter table public.money_receivable_transactions enable row level security;

create policy money_receivables_select on public.money_receivables
for select using ((select public.money_allowed_user()) and user_id=(select auth.uid()));
create policy money_receivables_insert on public.money_receivables
for insert with check ((select public.money_allowed_user()) and user_id=(select auth.uid()));
create policy money_receivables_update on public.money_receivables
for update using ((select public.money_allowed_user()) and user_id=(select auth.uid()))
with check ((select public.money_allowed_user()) and user_id=(select auth.uid()));
create policy money_receivables_delete on public.money_receivables
for delete using ((select public.money_allowed_user()) and user_id=(select auth.uid()));

create policy money_receivable_transactions_select on public.money_receivable_transactions
for select using ((select public.money_allowed_user()) and user_id=(select auth.uid()));
create policy money_receivable_transactions_insert on public.money_receivable_transactions
for insert with check ((select public.money_allowed_user()) and user_id=(select auth.uid()));
create policy money_receivable_transactions_update on public.money_receivable_transactions
for update using ((select public.money_allowed_user()) and user_id=(select auth.uid()))
with check ((select public.money_allowed_user()) and user_id=(select auth.uid()));
create policy money_receivable_transactions_delete on public.money_receivable_transactions
for delete using ((select public.money_allowed_user()) and user_id=(select auth.uid()));

drop trigger if exists money_receivables_set_updated_at on public.money_receivables;
create trigger money_receivables_set_updated_at
before update on public.money_receivables
for each row execute function public.money_set_updated_at();
