alter table public.money_months
  add column if not exists bank_balance numeric(14,2) null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'money_months_bank_balance_nonnegative'
      and conrelid = 'public.money_months'::regclass
  ) then
    alter table public.money_months
      add constraint money_months_bank_balance_nonnegative
      check (bank_balance is null or bank_balance >= 0);
  end if;
end $$;
