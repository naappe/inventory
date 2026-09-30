-- Accounts foundation for My Money Plan
create table if not exists public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null default 'bank' check (account_type in ('bank','cash')),
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.money_accounts enable row level security;
drop policy if exists money_accounts_owner on public.money_accounts;
create policy money_accounts_owner on public.money_accounts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create unique index if not exists money_accounts_one_primary on public.money_accounts(user_id) where is_primary and is_active;
insert into public.money_accounts(user_id,name,account_type,opening_balance,is_primary,display_order)
select id,'Main bank','bank',0,true,0 from auth.users u
where lower(u.email)=lower('naappe@gmail.com') and not exists(select 1 from public.money_accounts a where a.user_id=u.id);
