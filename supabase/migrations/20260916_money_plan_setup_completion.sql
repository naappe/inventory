alter table public.money_months
add column if not exists setup_complete boolean not null default false;
