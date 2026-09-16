# My Money Plan Supabase Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild My Money Plan as a spacious September-2026-first personal finance app backed only by Supabase, with single-user authentication, accurate debt/payment math, Safe to Save guidance, and clear financial graphs.

**Architecture:** GitHub Pages remains the static host. Supabase Auth and Postgres become the only authoritative finance store; dedicated Money Plan tables are protected by RLS and transactional RPC functions. The frontend is split into focused ES modules for auth, API calls, calculations, screens, sheets, and SVG charts so the old `money-core.html`/`debt-center.js` localStorage architecture can be retired cleanly.

**Tech Stack:** Static HTML/CSS/ES modules, Supabase JS v2 browser client, PostgreSQL/RLS/RPC, SVG charts, Node built-in test runner (`node --test`), GitHub Pages/PWA service worker.

**Spec:** `docs/superpowers/specs/2026-09-16-money-plan-supabase-redesign-design.md`

## Global Constraints

- Supabase project: `tmupbruwmwlrmewhoodn`.
- Allowed application account: `naappe@gmail.com` only.
- September 2026 is the first finance month.
- Do not migrate August 2026 or earlier finance history.
- Do not migrate old payment transactions or legacy paid/unpaid states.
- Do not persist finance data in `localStorage` or `sessionStorage`.
- GitHub Pages frontend may contain only the Supabase URL and publishable key; never a service-role/admin key.
- Every Money Plan table must have RLS enabled.
- Every finance row must be scoped by both `auth.uid()` and the allowed email claim.
- Failed writes must never appear as successful payments.
- Each active debt must appear once only.
- The UI must be spacious, light, breathable, and materially less dense than the current dark layout.
- Keep `ot.html` functional and independent from the Money Plan rebuild.

---

## File Map

### Database

- Create: `supabase/migrations/20260916_money_plan.sql` — Money Plan schema, indexes, RLS policies, triggers, RPCs, and September bootstrap helpers.
- Create: `supabase/tests/20260916_money_plan_checks.sql` — SQL verification queries for constraints, policies, duplicate prevention, and payment math.

### Frontend shell and styles

- Replace: `index.html` — authenticated app shell and module entrypoint.
- Create: `money-plan.css` — responsive visual system, dashboard cards, lists, side sheet, mobile bottom sheet, tables, and states.
- Update: `manifest.webmanifest` — current app naming/theme metadata.
- Replace: `sw.js` — network-first shell caching only; no finance JSON caching.

### Frontend modules

- Create: `js/config.js` — Supabase URL, publishable key, allowed email constant.
- Create: `js/supabase-client.js` — single Supabase client instance.
- Create: `js/auth.js` — session gate, email restriction, sign-in/sign-out.
- Create: `js/money-api.js` — all reads/writes and RPC calls.
- Create: `js/money-calculations.js` — pure derived-finance calculations.
- Create: `js/money-charts.js` — dependency-free SVG charts.
- Create: `js/money-sheets.js` — desktop side sheet / mobile bottom sheet form controller.
- Create: `js/money-app.js` — router, screen state, render orchestration.
- Create: `js/screens/setup.js` — September first-run setup.
- Create: `js/screens/overview.js` — dashboard KPIs, graphs, upcoming payments, debt summary.
- Create: `js/screens/payments.js` — monthly items and payment workflow.
- Create: `js/screens/debts.js` — debts, focus debt, payoff progress.
- Create: `js/screens/history.js` — month summaries, debt trend, savings trend.
- Create: `js/screens/settings.js` — categories, recurring items, sign out.

### Tests

- Create: `tests/money-calculations.test.mjs` — unit tests for month/debt/savings math.
- Create: `tests/money-ui-models.test.mjs` — pure-model tests for status, focus debt, chart series, and form preview calculations.

### Legacy retirement

- Remove after new app passes verification: `money-core.html`, `debt-center.js`, `professional-v3.css`.
- Keep: `ot.html`, `icons/`, `manifest.webmanifest`.

---

### Task 1: Create the Money Plan database schema and security boundary

**Files:**
- Create: `supabase/migrations/20260916_money_plan.sql`
- Create: `supabase/tests/20260916_money_plan_checks.sql`

**Interfaces:**
- Produces tables: `money_categories`, `money_items`, `money_months`, `money_month_items`, `money_debts`, `money_payments`.
- Produces RPCs: `money_bootstrap_september()`, `money_create_month(p_month_key text)`, `money_record_payment(...)`, `money_reverse_payment(...)`.
- Produces trigger helper: `money_set_updated_at()`.
- Later frontend tasks consume these objects through `js/money-api.js`.

- [ ] **Step 1: Write the SQL verification script before the migration**

Create `supabase/tests/20260916_money_plan_checks.sql` with queries that should fail or return zero rows until the migration exists:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'money_categories','money_items','money_months',
    'money_month_items','money_debts','money_payments'
  )
order by table_name;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'money_%'
order by tablename;

select proname
from pg_proc
where proname in (
  'money_bootstrap_september',
  'money_create_month',
  'money_record_payment',
  'money_reverse_payment'
)
order by proname;
```

- [ ] **Step 2: Run the verification script and confirm missing objects**

Run against Supabase SQL execution:

```sql
-- execute supabase/tests/20260916_money_plan_checks.sql
```

Expected: the table query returns fewer than 6 Money Plan tables and the function query returns fewer than 4 RPCs.

- [ ] **Step 3: Create the schema, constraints, and indexes**

In `supabase/migrations/20260916_money_plan.sql`, create the six tables exactly from the approved spec, plus these concrete constraints:

```sql
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
  month_key text not null check (month_key ~ '^\\d{4}-(0[1-9]|1[0-2])$'),
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

create index if not exists money_payments_month_idx on public.money_payments(month_id);
create index if not exists money_payments_debt_idx on public.money_payments(debt_id) where reversed_at is null;
```

- [ ] **Step 4: Add updated-at triggers and RLS policies**

Use one helper and explicit policies. Every policy must require the authenticated user ID and exact email:

```sql
create or replace function public.money_allowed_user()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt() ->> 'email', '') = 'naappe@gmail.com';
$$;

alter table public.money_categories enable row level security;
alter table public.money_items enable row level security;
alter table public.money_months enable row level security;
alter table public.money_month_items enable row level security;
alter table public.money_debts enable row level security;
alter table public.money_payments enable row level security;
```

For each table create `select`, `insert`, `update`, and `delete` policies with this shape:

```sql
create policy money_categories_select on public.money_categories
for select using (public.money_allowed_user() and user_id = auth.uid());

create policy money_categories_insert on public.money_categories
for insert with check (public.money_allowed_user() and user_id = auth.uid());

create policy money_categories_update on public.money_categories
for update using (public.money_allowed_user() and user_id = auth.uid())
with check (public.money_allowed_user() and user_id = auth.uid());

create policy money_categories_delete on public.money_categories
for delete using (public.money_allowed_user() and user_id = auth.uid());
```

Repeat with the same predicate for the remaining five tables.

- [ ] **Step 5: Add transactional payment and reversal RPCs**

`money_record_payment` must lock the target debt row for debt payments, cap the payment at the current balance, insert the payment, decrement the debt balance, and return the confirmed result. Use this signature:

```sql
money_record_payment(
  p_month_id uuid,
  p_payment_type text,
  p_amount numeric,
  p_payment_date date,
  p_month_item_id uuid default null,
  p_debt_id uuid default null,
  p_note text default null
) returns table(payment_id uuid, effective_amount numeric, debt_balance numeric)
```

`money_reverse_payment(p_payment_id uuid, p_reason text)` must mark `reversed_at`, restore a debt balance when relevant, and return the resulting debt balance.

Both functions must reject calls unless `money_allowed_user()` is true and every referenced row belongs to `auth.uid()`.

- [ ] **Step 6: Add bootstrap and month-creation RPCs**

`money_bootstrap_september()` must create `2026-09` only when the user has no Money Plan month rows and seed these category names only:

```text
Family
Utilities
Food
Credit
Loans
Transport
Other
```

`money_create_month(p_month_key text)` must create the month, snapshot every active recurring `money_items` row into `money_month_items`, and never duplicate a master debt.

- [ ] **Step 7: Apply migration and rerun checks**

Expected verification:

```text
6 Money Plan tables
6 tables with rowsecurity = true
4 named RPC functions present
```

Also attempt a duplicate active debt insert in a transaction and verify the unique index rejects it.

- [ ] **Step 8: Run Supabase security and performance advisors**

Expected: no Money Plan finding for missing RLS, public service-role exposure, or unindexed core foreign keys. Remediate any Money Plan-specific advisor result before continuing.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260916_money_plan.sql supabase/tests/20260916_money_plan_checks.sql
git commit -m "feat: add secure Money Plan Supabase schema"
```

---

### Task 2: Add pure financial calculations with tests

**Files:**
- Create: `js/money-calculations.js`
- Create: `tests/money-calculations.test.mjs`

**Interfaces:**
- Produces `calculateMonthSummary({ income, monthItems, payments, debts })`.
- Produces `calculateDebtPreview(currentBalance, enteredAmount)`.
- Produces `monthsRemaining(balance, monthlyPlan)`.
- Produces `chooseFocusDebt(debts)`.
- Used by Overview, Payments, Debts, History, and sheet previews.

- [ ] **Step 1: Write failing calculation tests**

Create tests covering this exact example:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMonthSummary,
  calculateDebtPreview,
  monthsRemaining,
  chooseFocusDebt,
} from '../js/money-calculations.js';

test('separates available now, still to pay, and safe to save', () => {
  const summary = calculateMonthSummary({
    income: 25000,
    monthItems: [
      { id: 'electric', planned_amount: 1000 },
      { id: 'food', planned_amount: 7000 },
    ],
    debts: [{ id: 'loan', monthly_plan: 2000, current_balance: 35500, apr: null }],
    payments: [
      { payment_type: 'expense', month_item_id: 'electric', amount: 1000, reversed_at: null },
      { payment_type: 'debt', debt_id: 'loan', amount: 1000, reversed_at: null },
      { payment_type: 'expense', month_item_id: 'food', amount: 10000, reversed_at: null },
    ],
  });
  assert.equal(summary.paid, 12000);
  assert.equal(summary.availableNow, 13000);
  assert.equal(summary.stillToPay, 8000);
  assert.equal(summary.safeToSave, 5000);
});

test('debt preview never goes below zero', () => {
  assert.deepEqual(calculateDebtPreview(1200, 2000), {
    effectiveAmount: 1200,
    afterPayment: 0,
  });
});

test('months remaining rounds upward', () => {
  assert.equal(monthsRemaining(35500, 1500), 24);
});

test('focus debt prefers highest APR when APR exists', () => {
  const result = chooseFocusDebt([
    { id: 'a', current_balance: 10000, apr: 6 },
    { id: 'b', current_balance: 30000, apr: 18 },
  ]);
  assert.equal(result.id, 'b');
});

test('focus debt falls back to smallest balance when no APR exists', () => {
  const result = chooseFocusDebt([
    { id: 'a', current_balance: 10000, apr: null },
    { id: 'b', current_balance: 30000, apr: null },
  ]);
  assert.equal(result.id, 'a');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test tests/money-calculations.test.mjs
```

Expected: FAIL because `js/money-calculations.js` does not exist.

- [ ] **Step 3: Implement the calculation module**

Implement pure functions with decimal values rounded to 2 places and ignoring reversed payments. `safeToSave` must be `max(0, availableNow - stillToPay)` while `projectedAfterPlan` must remain unclamped.

- [ ] **Step 4: Run tests**

Run:

```bash
node --test tests/money-calculations.test.mjs
```

Expected: all calculation tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/money-calculations.js tests/money-calculations.test.mjs
git commit -m "test: lock Money Plan financial calculations"
```

---

### Task 3: Build the Supabase client, auth gate, and API layer

**Files:**
- Create: `js/config.js`
- Create: `js/supabase-client.js`
- Create: `js/auth.js`
- Create: `js/money-api.js`
- Create: `tests/money-ui-models.test.mjs`

**Interfaces:**
- `auth.requireSession(): Promise<{ user, session }>` rejects disallowed email sessions.
- `auth.signIn(email, password)` signs in through Supabase Auth.
- `auth.signOut()` signs out and clears only the Supabase Auth session.
- `moneyApi.loadMonth(monthKey)` returns `{ month, items, payments, debts, categories }`.
- `moneyApi.bootstrapSeptember()` invokes `money_bootstrap_september`.
- `moneyApi.recordPayment(input)` invokes `money_record_payment`.
- `moneyApi.reversePayment(paymentId, reason)` invokes `money_reverse_payment`.

- [ ] **Step 1: Add model tests for session and API normalization helpers**

Keep helper logic pure so Node tests can verify that only `naappe@gmail.com` is accepted and that Supabase numeric strings are normalized to JavaScript numbers before calculations.

- [ ] **Step 2: Verify tests fail before implementation**

Run:

```bash
node --test tests/money-ui-models.test.mjs
```

Expected: FAIL due to missing modules.

- [ ] **Step 3: Add config and Supabase client**

`js/config.js` must export:

```js
export const SUPABASE_URL = 'https://tmupbruwmwlrmewhoodn.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = '<insert active publishable key from Supabase project settings>';
export const ALLOWED_EMAIL = 'naappe@gmail.com';
```

During execution, replace the angle-bracket token with the actual active publishable key fetched from Supabase. Do not place a secret/service-role key in this file.

`js/supabase-client.js` imports `createClient` from the pinned Supabase browser ESM URL and exports one shared client.

- [ ] **Step 4: Implement the auth gate**

Login screen rules:

```text
No session -> show email/password sign-in.
Session email != naappe@gmail.com -> sign out immediately and show Access denied.
Allowed session -> proceed to Money Plan.
```

Never treat the existence of a browser session alone as authorization; the database RLS remains the authority.

- [ ] **Step 5: Implement API reads and writes**

Use `.select()` reads for categories/items/months/month items/debts/payments and `.rpc()` only for balance-changing operations and month bootstrap/creation. Return normalized numeric values.

- [ ] **Step 6: Run model tests**

Run:

```bash
node --test tests/money-ui-models.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/config.js js/supabase-client.js js/auth.js js/money-api.js tests/money-ui-models.test.mjs
git commit -m "feat: add Money Plan Supabase auth and API layer"
```

---

### Task 4: Replace the legacy shell with the spacious authenticated app frame

**Files:**
- Replace: `index.html`
- Create: `money-plan.css`
- Create: `js/money-app.js`

**Interfaces:**
- `money-app.js` owns selected month/view state in memory only.
- Screens expose `renderXxx(context)` and event-binding functions.
- Navigation routes: `overview`, `payments`, `debts`, `history`, `settings`.

- [ ] **Step 1: Create the new semantic shell**

`index.html` contains only the login root, app root, sheet root, toast/status live region, stylesheet, and `type="module"` entrypoint. Remove the dynamic `fetch('./money-core.html')` loader entirely.

- [ ] **Step 2: Implement the approved visual system**

Use CSS variables such as:

```css
:root{
  --bg:#f6f8fb;
  --surface:#ffffff;
  --text:#10213f;
  --muted:#6d7b93;
  --line:#e5eaf1;
  --green:#118c67;
  --blue:#2f6fec;
  --amber:#e98b24;
  --red:#d95067;
  --radius:18px;
  --space-1:8px;
  --space-2:12px;
  --space-3:18px;
  --space-4:24px;
  --space-5:32px;
  --space-6:48px;
}
```

Desktop content max width: `1440px`. Main card gaps: at least `24px`. Section gaps: at least `32px`. Avoid the current dense full-width rows.

- [ ] **Step 3: Add responsive navigation**

Desktop: left navigation rail.

Mobile: compact bottom navigation with Overview, Payments, Debts, History, More. Settings is accessible from More.

- [ ] **Step 4: Add loading, empty, error, and offline states**

All finance screens must have explicit loading and error regions. An offline state may display already-rendered in-memory data for the current page session, but it must not fabricate or persist new transactions.

- [ ] **Step 5: Manually verify layout at 1440px, 1024px, 768px, and 390px widths**

Expected: no horizontal scrolling in primary workflows; wide whitespace remains visible on desktop; mobile controls remain thumb-sized.

- [ ] **Step 6: Commit**

```bash
git add index.html money-plan.css js/money-app.js
git commit -m "feat: replace Money Plan legacy shell"
```

---

### Task 5: Implement September first-run setup

**Files:**
- Create: `js/screens/setup.js`
- Modify: `js/money-app.js`
- Modify: `js/money-api.js`

**Interfaces:**
- `renderSetup({ categories, onComplete })` guides the user through income, categories, recurring items, and debts.
- On completion, `moneyApi.loadMonth('2026-09')` becomes the first dashboard load.

- [ ] **Step 1: Detect an empty Money Plan account after authentication**

Call `money_bootstrap_september`. If it creates or returns the September month and no user-created items/debts exist, route to Setup rather than Overview.

- [ ] **Step 2: Build a four-step setup flow**

Steps:

```text
1. Income
2. Categories
3. Monthly payments
4. Debts
```

Do not import localStorage. Do not inspect the old `moneyPlanAdvanced` key.

- [ ] **Step 3: Save each setup stage directly to Supabase**

Each stage must show `Saving…`, then `Saved`, or keep the form open with `Not saved — retry` on failure.

- [ ] **Step 4: Create September snapshots after recurring items are entered**

Invoke `money_create_month('2026-09')` idempotently or create snapshots using the bootstrap routine so September starts with all newly entered recurring items and zero payments.

- [ ] **Step 5: Verify refresh behavior**

Refresh after every setup stage. Expected: previously confirmed Supabase data reappears; unsaved text does not claim to be stored.

- [ ] **Step 6: Commit**

```bash
git add js/screens/setup.js js/money-app.js js/money-api.js
git commit -m "feat: add September Money Plan setup"
```

---

### Task 6: Build overview calculations and decision-useful SVG graphics

**Files:**
- Create: `js/money-charts.js`
- Create: `js/screens/overview.js`
- Modify: `js/money-app.js`
- Modify: `tests/money-ui-models.test.mjs`

**Interfaces:**
- `renderMoneyFlowChart({ income, paid, stillToPay, safeToSave })` returns SVG markup.
- `renderCompositionDonut({ paid, stillToPay, safeToSave })` returns SVG markup.
- `renderTrendLine(points, options)` renders debt and savings history charts.

- [ ] **Step 1: Add chart-model tests**

Test that chart series preserve exact values and that zero-data charts return an explicit empty model instead of `NaN` geometry.

- [ ] **Step 2: Implement dependency-free SVG chart helpers**

Do not add a third-party chart package. Generate accessible SVG with `<title>` and textual values below/alongside the chart so financial meaning remains available if the chart fails to render.

- [ ] **Step 3: Build the spacious Overview screen**

Top KPI order:

```text
Income | Paid this month | Still to pay | Safe to save | Total debt left
```

Below KPIs show only:

```text
Monthly Money Flow
Your Money This Month
Upcoming Payments
Your Debts
Focus Debt
```

Do not add full payment/history tables to Overview.

- [ ] **Step 4: Keep Safe to Save prominent**

Use the exact derived formula from `calculateMonthSummary`. Never substitute `Available Now` for `Safe to Save`.

- [ ] **Step 5: Run tests**

```bash
node --test tests/money-calculations.test.mjs tests/money-ui-models.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/money-charts.js js/screens/overview.js js/money-app.js tests/money-ui-models.test.mjs
git commit -m "feat: add Money Plan overview and graphs"
```

---

### Task 7: Add modern payment entry and payment management

**Files:**
- Create: `js/money-sheets.js`
- Create: `js/screens/payments.js`
- Modify: `js/money-app.js`
- Modify: `js/money-api.js`
- Modify: `money-plan.css`

**Interfaces:**
- `openSheet({ title, body, onSubmit })` is the common form surface.
- Desktop uses a right side sheet; mobile uses a bottom sheet/full-screen form.
- `moneyApi.recordPayment()` returns confirmed payment amount and balance.

- [ ] **Step 1: Implement one reusable sheet controller**

The controller must trap focus while open, close on explicit Cancel/Escape, restore focus to the launch button, and disable Save while a request is pending.

- [ ] **Step 2: Build the Payments screen**

Columns/content:

```text
Name | Category | Planned | Paid | Remaining | Status
```

Use comfortable row height, not dense legacy rows. Status values: Waiting, Partial, Paid.

- [ ] **Step 3: Build Record Payment form**

For a monthly item show:

```text
Item name
Planned this month
Paid so far
Amount paid
Payment date
Remaining after this payment
```

Preview uses pure calculations only; confirmed UI state updates only after the Supabase RPC succeeds.

- [ ] **Step 4: Implement failure behavior**

On failed write:

```text
Keep sheet open
Keep entered values in live DOM memory
Show Not saved — retry
Do not alter status/progress in the underlying screen
```

- [ ] **Step 5: Add payment reversal UI**

A reversal requires a reason. After confirmed reversal, reload the selected month from Supabase.

- [ ] **Step 6: Verify keyboard and 390px mobile behavior**

Expected: no tiny browser-style dialog; fields and Save button are comfortably reachable.

- [ ] **Step 7: Commit**

```bash
git add js/money-sheets.js js/screens/payments.js js/money-app.js js/money-api.js money-plan.css
git commit -m "feat: add modern Money Plan payment workflow"
```

---

### Task 8: Build debt tracking, payoff focus, and balance-safe payment flow

**Files:**
- Create: `js/screens/debts.js`
- Modify: `js/money-api.js`
- Modify: `js/money-sheets.js`
- Modify: `tests/money-calculations.test.mjs`

**Interfaces:**
- Debts screen consumes unique active `money_debts` rows.
- Debt payments go only through `money_record_payment` RPC.
- Focus debt comes from `chooseFocusDebt(debts)` unless a user focus order is explicitly set.

- [ ] **Step 1: Add tests for debt completion and freed monthly money**

Test that paying the full balance returns zero and that a completed debt contributes its `monthly_plan` to the displayed monthly money freed.

- [ ] **Step 2: Build one-card-per-debt UI**

Each debt shows:

```text
Current balance
Monthly plan
Paid this month
After-payment balance
Progress
Estimated months remaining
APR when present
```

Do not duplicate the debt in monthly payment lists as a second debt master row.

- [ ] **Step 3: Build debt payment sheet**

Show live preview:

```text
Current balance: MVR 35,500
Entered payment: MVR 1,500
After payment: MVR 34,000
```

If entered payment exceeds the outstanding balance, preview and RPC both cap it at the outstanding balance.

- [ ] **Step 4: Build Focus Debt panel**

When no APR exists, use smallest balance first. If one or more APRs exist, prioritize highest APR. Display the rule in plain language.

- [ ] **Step 5: Show monthly money freed when debt completes**

Example copy format:

```text
Loan finished — MVR 1,500/month is now free for your next goal.
```

- [ ] **Step 6: Run tests**

```bash
node --test tests/money-calculations.test.mjs tests/money-ui-models.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/screens/debts.js js/money-api.js js/money-sheets.js tests/money-calculations.test.mjs
git commit -m "feat: add debt payoff tracking"
```

---

### Task 9: Add month rollover, history, debt trend, and savings trend

**Files:**
- Create: `js/screens/history.js`
- Modify: `js/money-api.js`
- Modify: `js/money-app.js`
- Modify: `js/money-charts.js`

**Interfaces:**
- `moneyApi.createMonth(monthKey)` invokes `money_create_month`.
- `moneyApi.loadHistory()` returns ordered month summaries from September 2026 onward.
- History graphs consume monthly summary objects, never legacy localStorage data.

- [ ] **Step 1: Implement month creation from September onward**

Changing from September to October calls `money_create_month('2026-10')` once. Recurring item snapshots use the latest reusable item amounts; September snapshots remain unchanged.

- [ ] **Step 2: Build History screen**

Each month summary shows:

```text
Income
Paid
Still to pay / end-of-month unpaid plan
Safe to save
Total debt remaining
```

- [ ] **Step 3: Add Debt Balance Trend**

Plot one point per existing month. September 2026 is the first point.

- [ ] **Step 4: Add Savings Growth with truthful labels**

Until a dedicated savings transaction exists, label the series:

```text
Potential savings / Safe to save
Cumulative potential savings
```

Do not label the series `Actual savings` unless actual savings transactions are later introduced.

- [ ] **Step 5: Verify historical snapshots**

Change a reusable item's October default amount and verify September's `money_month_items.planned_amount` stays unchanged.

- [ ] **Step 6: Commit**

```bash
git add js/screens/history.js js/money-api.js js/money-app.js js/money-charts.js
git commit -m "feat: add Money Plan monthly history"
```

---

### Task 10: Add Settings and category/recurring-item management

**Files:**
- Create: `js/screens/settings.js`
- Modify: `js/money-api.js`
- Modify: `js/money-app.js`

**Interfaces:**
- Settings manages categories and reusable `money_items` only.
- Edits affect future month snapshots, not past snapshots.

- [ ] **Step 1: Build category management**

Allow add, rename, reorder, and deactivate. Reject duplicate category names with a friendly message mapped from the database unique constraint.

- [ ] **Step 2: Build reusable monthly item management**

Allow edit of name, category, default planned amount, due day, recurring flag, active flag.

- [ ] **Step 3: Add account/security panel**

Show the signed-in email and a Sign out button. Do not expose Supabase project secrets or admin controls.

- [ ] **Step 4: Verify past-month integrity**

Edit an item's default planned amount and verify an existing September snapshot does not change.

- [ ] **Step 5: Commit**

```bash
git add js/screens/settings.js js/money-api.js js/money-app.js
git commit -m "feat: add Money Plan settings"
```

---

### Task 11: Update PWA behavior and retire the localStorage implementation

**Files:**
- Replace: `sw.js`
- Modify: `manifest.webmanifest`
- Delete: `money-core.html`
- Delete: `debt-center.js`
- Delete: `professional-v3.css`

**Interfaces:**
- Service worker caches static shell assets only.
- Finance API requests are never cached as authoritative offline data.

- [ ] **Step 1: Replace the service worker cache list**

Cache only:

```text
./
./index.html
./money-plan.css
./manifest.webmanifest
./icons/icon.svg
./icons/icon-192.png
./icons/icon-512.png
./js/config.js
./js/supabase-client.js
./js/auth.js
./js/money-api.js
./js/money-calculations.js
./js/money-charts.js
./js/money-sheets.js
./js/money-app.js
./js/screens/setup.js
./js/screens/overview.js
./js/screens/payments.js
./js/screens/debts.js
./js/screens/history.js
./js/screens/settings.js
./ot.html
```

For Supabase origins, use network only; do not `cache.put()` responses.

- [ ] **Step 2: Update manifest theme metadata**

Use the new light background/theme values and keep existing app icons.

- [ ] **Step 3: Search for forbidden storage calls**

Run:

```bash
grep -R "localStorage\|sessionStorage" index.html js money-plan.css sw.js
```

Expected: no finance-data persistence usage. Supabase Auth internals are external to this search.

- [ ] **Step 4: Delete old implementation files**

Remove `money-core.html`, `debt-center.js`, and `professional-v3.css` only after the new shell is working and no remaining import points to them.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: retire legacy Money Plan storage and UI"
```

---

### Task 12: End-to-end verification and GitHub Pages release

**Files:**
- Verify all files above.
- No new production file is required unless a defect is found.

**Interfaces:**
- Validates the complete user journey from authentication through September setup, payment, debt reduction, graphs, refresh, and cross-device persistence.

- [ ] **Step 1: Run all JavaScript tests**

```bash
node --test tests/money-calculations.test.mjs tests/money-ui-models.test.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 2: Verify unauthorized access**

Open the GitHub Pages site signed out. Expected: login screen only, no finance numbers.

Attempt a disallowed Supabase user. Expected: immediate denial/sign-out and RLS prevents Money Plan row reads.

- [ ] **Step 3: Verify September fresh start**

Expected:

```text
No August finance month
No old localStorage payments imported
September 2026 exists
Paid totals start at MVR 0.00 before new payments
Each debt appears once
```

- [ ] **Step 4: Verify payment math with a controlled example**

Set income to MVR 25,000 and create plans such that, after confirmed payments, the selected month has:

```text
Paid = MVR 12,000
Still to pay = MVR 8,000
Available now = MVR 13,000
Safe to save = MVR 5,000
```

Expected: dashboard cards and Monthly Money Flow graph show exactly these values.

- [ ] **Step 5: Verify debt transaction safety**

Create a debt at MVR 35,500 with MVR 1,500 monthly plan, record MVR 1,500, and verify confirmed balance MVR 34,000. Reverse the payment and verify balance returns to MVR 35,500.

- [ ] **Step 6: Verify failure handling**

Block the network and try to save a payment. Expected:

```text
Sheet stays open
Entered value remains visible in memory
UI says Not saved — retry
Underlying status and balance do not change
```

Reconnect and retry. Expected: one confirmed transaction, not two.

- [ ] **Step 7: Verify cross-device persistence**

After a confirmed payment on desktop, log into the same account on mobile and verify the same balance and payment appear from Supabase.

- [ ] **Step 8: Verify visual density**

At desktop width, confirm at least 24px card gaps and 32px section gaps. On 390px mobile, confirm no primary workflow requires horizontal scrolling and the payment form renders as a bottom/full-screen sheet.

- [ ] **Step 9: Verify graphs**

Confirm Monthly Money Flow, monthly composition, Debt Balance Trend, and Savings Growth render with text equivalents and truthful labels.

- [ ] **Step 10: Verify GitHub Pages deployment**

Wait for the Pages build/deploy workflow for the final commit. Expected: build and deploy jobs both succeed and `https://naappe.github.io/inventory/` loads the new Supabase-backed app.

- [ ] **Step 11: Final commit for any verification-only fixes**

```bash
git add -A
git commit -m "fix: complete Money Plan Supabase release verification"
```

Do not create this commit if verification required no code changes.

---

## Self-Review Results

- **Spec coverage:** All approved requirements are mapped to tasks: single-user auth/RLS, fresh September start, isolated Supabase tables, snapshot history, transactional debt payments, duplicate prevention, Safe to Save, modern sheets, spacious responsive layout, debt payoff, graphs, truthful savings labels, PWA behavior, and cross-device persistence.
- **Placeholder scan:** The only value intentionally resolved during execution is the active Supabase publishable key. It is explicitly obtained from the project and is not a secret. There are no implementation placeholders for behavior or tests.
- **Type/name consistency:** Frontend method names and SQL RPC names are consistent across tasks: `money_bootstrap_september`, `money_create_month`, `money_record_payment`, `money_reverse_payment`; `calculateMonthSummary`, `calculateDebtPreview`, `monthsRemaining`, `chooseFocusDebt`; and `moneyApi` wrapper names match their consumers.
