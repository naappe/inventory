# My Money Plan — Supabase Redesign Specification

Date: 2026-09-16
Repository: `naappe/inventory`
Status: Approved design, awaiting implementation plan

## 1. Objective

Rebuild My Money Plan as a modern, spacious personal-finance web app using Supabase as the only persistent source of truth. The current localStorage-based monthly history is not migrated. The new system starts fresh from September 2026.

The redesign must remove duplicate debt entries, replace the old dense layout and browser-style popups, preserve a clear category structure, and make monthly planning, debt payoff, payment tracking, and safe-to-save calculations accurate and easy to understand.

## 2. User and Access Model

The app is personal and single-user.

- Allowed account: `naappe@gmail.com`
- Authentication: existing Supabase Auth in project `tmupbruwmwlrmewhoodn`
- Frontend host: GitHub Pages
- Persistent storage: Supabase Postgres only
- Browser localStorage must not store finance data
- Browser code may contain only the Supabase project URL and publishable key
- No service-role/admin key is permitted in the frontend
- All Money Plan tables must use Row Level Security
- Access must require both the authenticated user ID and the allowed email

## 3. Fresh Start Rules

September 2026 is the first month in the new system.

Do not migrate:

- August 2026 or any earlier month
- old payment transactions
- old paid/unpaid states
- duplicate debt rows
- legacy localStorage month history

Keep or recreate:

- category structure
- payment-item names as the user re-enters them
- recurring monthly planned amounts as the user re-enters them
- loan/credit names and real current balances as the user re-enters them

Initial September state:

- all new monthly items start at `paid = 0`
- all debt payments start at `paid_this_month = 0`
- current balances are entered manually as the September opening balances

## 4. Supabase Data Model

Use dedicated Money Plan tables isolated from Bills, Quo, Playhaus, SocialMV, and other applications in the same Supabase project.

### 4.1 `money_categories`

Purpose: user-owned payment categories.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `name text not null`
- `display_order integer not null default 0`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraint: unique category name per user using a normalized or case-insensitive strategy.

### 4.2 `money_items`

Purpose: reusable monthly payment/bill definitions.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `category_id uuid references money_categories(id)`
- `name text not null`
- `default_planned_amount numeric(12,2) not null default 0`
- `due_day integer null`
- `is_recurring boolean not null default true`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 4.3 `money_months`

Purpose: one record per calendar month, holding month-level inputs.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `month_key text not null` in `YYYY-MM` format
- `income numeric(12,2) not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraint: unique `(user_id, month_key)`.

### 4.4 `money_month_items`

Purpose: immutable monthly planning snapshot of each payment item.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `month_id uuid not null references money_months(id)`
- `item_id uuid null references money_items(id)`
- `category_id uuid null references money_categories(id)`
- `name_snapshot text not null`
- `category_snapshot text not null`
- `planned_amount numeric(12,2) not null default 0`
- `due_date date null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Historical month values remain unchanged when a reusable item is edited later.

### 4.5 `money_debts`

Purpose: one master row per loan or credit account, preventing duplicate active debt cards.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `name text not null`
- `debt_type text not null check (debt_type in ('loan','credit'))`
- `opening_balance numeric(12,2) not null default 0`
- `current_balance numeric(12,2) not null default 0`
- `monthly_plan numeric(12,2) not null default 0`
- `apr numeric(8,4) null`
- `focus_order integer null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraint: prevent multiple active debts with the same normalized name for the same user.

### 4.6 `money_payments`

Purpose: append-only financial transaction history for regular items and debts.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `month_id uuid not null references money_months(id)`
- `month_item_id uuid null references money_month_items(id)`
- `debt_id uuid null references money_debts(id)`
- `payment_type text not null check (payment_type in ('expense','debt'))`
- `amount numeric(12,2) not null check (amount > 0)`
- `payment_date date not null`
- `note text null`
- `reversed_at timestamptz null`
- `reversal_reason text null`
- `created_at timestamptz not null default now()`

Exactly one of `month_item_id` or `debt_id` should be populated according to payment type.

Payments should be reversed, not silently destroyed, when correcting an important financial record.

## 5. Monthly Snapshot and Carry-Forward Rules

Creating a new month must:

1. create one `money_months` row
2. snapshot active recurring `money_items` into `money_month_items`
3. use each debt's previous closing/current balance as the new month's opening debt balance conceptually
4. never create a second master debt row

October therefore starts from September's closing debt state without duplicating the debt.

## 6. Financial Calculations

All calculations are derived from confirmed Supabase rows. The frontend should not maintain authoritative hidden totals.

For selected month:

### Paid this month

`sum(non-reversed money_payments.amount for the selected month)`

### Available now

`monthly income - actual payments already made`

### Still to pay

For each monthly item:

`max(0, planned_amount - actual non-reversed payments linked to that month item)`

For debt plans, the monthly debt amount remaining should similarly be:

`max(0, monthly planned debt payment - actual debt payments in selected month)`

Dashboard total:

`sum(all remaining planned expense amounts + remaining planned debt amounts)`

### Safe to save

`max(0, available now - still to pay)`

This figure is intentionally different from Available Now and is the primary savings guidance figure.

### Projected money left after full plan

`income - total planned month spending`

This may be negative and must not be clamped when used as a warning signal.

## 7. Debt Rules

Each debt appears once in the active debt list.

When a debt payment is saved:

1. validate the payment amount
2. reject zero or negative payments
3. cap the effective payment at the current outstanding balance
4. insert a `money_payments` row
5. update/recalculate the debt current balance transactionally
6. return the confirmed new balance

A debt balance must never become negative.

If a payment is reversed, the debt balance must be restored consistently.

If APR is supplied, payoff guidance can prioritize the highest APR first. If APR is unavailable, the UI may use the smallest balance first as a simple payoff order. This guidance is informational and should remain clearly distinguishable from recorded facts.

When a debt reaches zero:

- mark it completed/inactive or display it as completed
- show the monthly amount freed by finishing that debt
- include that amount in the "monthly money freed" / future-saving opportunity display

## 8. Dashboard Information Architecture

The approved visual direction is spacious, breathable, modern, light, and significantly less dense than the previous version.

Primary navigation:

- Overview
- Payments
- Debts
- History
- Settings

Categories and security/account controls belong under Settings rather than primary navigation.

### Overview top row

Show five high-priority cards:

- Income
- Paid this month
- Still to pay
- Safe to save
- Total debt left

Use generous spacing and avoid stacking too many labels inside cards.

### Overview content

Keep the first screen focused. Do not place every possible data table on the dashboard.

Show:

- Monthly Money Flow chart
- one concise monthly composition chart
- Upcoming Payments list
- Your Debts summary
- a focused debt payoff callout

Secondary details should move to Payments, Debts, or History screens.

## 9. Graphs

Graphs must support decisions rather than decorate the UI.

### 9.1 Monthly Money Flow

Shows selected month values:

- Income
- Paid
- Still to pay
- Safe to save

### 9.2 Debt Balance Trend

Line chart by month showing total debt remaining.

September 2026 is the first data point in the new system.

### 9.3 Savings Growth

History chart showing:

- amount actually saved per month
- cumulative saved amount

If explicit savings transfers are not recorded separately in the first implementation, the app must label calculated savings as "safe to save" or "potential savings" rather than claiming money was actually saved. Actual-savings history requires a recorded savings transaction or a dedicated savings field/table.

## 10. Payments Screen

Use a clean table/list with ample row height and whitespace.

Columns/content:

- Name
- Category
- Planned
- Paid
- Remaining
- Status

Statuses:

- Waiting
- Partial
- Paid

Avoid duplicate controls in every row. Use a concise overflow/details action or row interaction where appropriate.

## 11. Debts Screen

Each debt card/row shows:

- debt name
- type
- current balance
- monthly planned payment
- amount paid this month
- balance after confirmed payment
- progress
- optional estimated months remaining
- optional APR

A single "Focus debt" panel highlights the current target and shows the monthly cash flow that becomes available when it is cleared.

## 12. Modern Data Entry

Replace browser-style dialogs with designed application panels.

Desktop:

- right-side sheet/panel

Mobile:

- bottom sheet or full-screen mobile form

### Record Payment form

Show:

- item/debt name
- current balance when relevant
- amount
- payment date
- live calculated after-payment balance
- Cancel
- Save payment

While typing, calculations may preview locally, but only confirmed Supabase results become authoritative after Save.

### Error behavior

On network/database failure:

- keep the panel open
- preserve entered form values in memory while the page remains open
- show "Not saved — retry"
- do not change the visible payment status to Paid until Supabase confirms the write

No financial form data should be persisted to localStorage as a retry queue.

## 13. First-Run September Setup

After successful login, if no Money Plan data exists:

1. show September 2026 setup
2. set monthly income
3. create/review categories
4. create recurring payment items
5. add each loan/credit with its real current balance
6. set planned monthly debt payments
7. create September snapshots
8. start all September payments at zero
9. open Overview

No legacy auto-import is offered in this flow.

## 14. Security and RLS

All Money Plan tables must have RLS enabled.

Policy intent:

- user must be authenticated
- `auth.uid()` must equal the row's `user_id`
- JWT email must equal `naappe@gmail.com`

Use restrictive policies for SELECT, INSERT, UPDATE, and DELETE/soft-delete operations.

Where possible, use database constraints and transactional RPC/database functions for balance-changing operations so a manipulated browser cannot create inconsistent debt totals.

After schema creation, run Supabase security and performance advisors and remediate Money Plan issues before considering the database complete.

## 15. Frontend Storage Rules

Forbidden for finance data:

- localStorage
- sessionStorage as authoritative storage
- embedded JSON finance records in the GitHub repository

Allowed browser persistence:

- Supabase Auth session handling as provided by the Supabase client
- non-sensitive UI preferences only if needed later

The frontend always reloads financial state from Supabase after authentication.

## 16. Responsive Design

Desktop should use an airy two-column content grid with generous margins and no cramped full-width transaction wall.

Mobile should:

- convert sidebar navigation to a compact mobile navigation pattern
- stack KPI cards sensibly
- keep Safe to Save visible near the top
- make payment/debt actions thumb-friendly
- use bottom-sheet/full-screen forms rather than tiny dialogs
- avoid horizontal scrolling for primary workflows

## 17. Visual Direction

Approved direction:

- light neutral background
- subtle mint/blue/amber/red semantic accents
- large whitespace between cards and sections
- soft borders rather than heavy outlines
- restrained shadows
- rounded but not excessively pill-shaped cards
- large section headings
- low visual density
- no decorative chart overload

The old dense dark layout should not be preserved merely for backward compatibility.

## 18. History

History starts in September 2026.

Each month should preserve:

- income
- planned item snapshots
- actual payment transactions
- total paid
- safe-to-save calculation
- debt closing state/trend

Changing a reusable item in a later month must not rewrite past monthly snapshots.

## 19. Success Criteria

The redesign is successful when:

1. `naappe@gmail.com` can log in through Supabase Auth.
2. Unauthenticated visitors cannot read Money Plan finance records.
3. No Money Plan finance data is stored in localStorage.
4. September 2026 is the first finance month.
5. Old August/history data is not imported.
6. Each active debt appears once only.
7. Payments immediately produce a confirmed new debt balance after Supabase save.
8. Available Now, Still to Pay, and Safe to Save remain distinct and mathematically correct.
9. The dashboard shows savings and debt trend graphics without feeling crowded.
10. Payment entry uses a modern responsive panel instead of the old popup.
11. Laptop and phone show the same Supabase-backed data after login.
12. Failed saves never appear as successful payments.
13. Historical monthly snapshots remain unchanged by later edits.
14. The new UI is visibly more breathable and simpler than the existing layout.

## 20. Out of Scope for Initial Rebuild

To keep the first cloud version focused, do not add unless separately approved:

- bank API integration
- automatic BML transaction import
- automatic bill payment
- multi-user household sharing
- investment portfolio tracking
- AI spending recommendations
- offline finance-data write queues

These can be considered after the Supabase-backed core is stable.
