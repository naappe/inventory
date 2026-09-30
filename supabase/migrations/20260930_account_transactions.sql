-- Link money movement to accounts and support transfers.
alter table public.money_payments add column if not exists account_id uuid references public.money_accounts(id) on delete set null;
alter table public.money_receivable_transactions add column if not exists account_id uuid references public.money_accounts(id) on delete set null;
alter table public.money_months add column if not exists income_account_id uuid references public.money_accounts(id) on delete set null;

create table if not exists public.money_account_transfers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 month_id uuid not null references public.money_months(id) on delete cascade,
 from_account_id uuid not null references public.money_accounts(id) on delete restrict,
 to_account_id uuid not null references public.money_accounts(id) on delete restrict,
 amount numeric(14,2) not null check(amount > 0),
 transfer_date date not null default current_date,
 note text,
 reversed_at timestamptz,
 created_at timestamptz not null default now(),
 check(from_account_id <> to_account_id)
);
alter table public.money_account_transfers enable row level security;
drop policy if exists money_account_transfers_owner on public.money_account_transfers;
create policy money_account_transfers_owner on public.money_account_transfers for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create index if not exists money_payments_account_idx on public.money_payments(account_id);
create index if not exists money_receivable_tx_account_idx on public.money_receivable_transactions(account_id);
create index if not exists money_account_transfers_month_idx on public.money_account_transfers(month_id);
