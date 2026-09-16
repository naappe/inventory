# Category-Driven Money Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make category selection automatically apply the correct accounting behavior for liabilities, ordinary expenses, and money lent, while preserving monthly carry-forward balances, audit-safe reversals, Supabase security, and the existing mobile-first Money Plan UI.

**Architecture:** Extend `money_categories` with a behavior type, keep balance-bearing liabilities in `money_debts`, keep normal expenses in `money_items`/`money_month_items`, and add dedicated receivable tables for Money Lent. The frontend will use category behavior to render the correct form and route writes to the correct Supabase RPC/API path, while shared calculations aggregate cash in, cash out, liabilities, receivables, Still to Pay, and Safe to Save without double-counting.

**Tech Stack:** GitHub Pages, vanilla HTML/CSS/ES modules, Supabase Auth/Postgres/RLS/RPC, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-16-category-driven-money-logic-design.md`

## Global Constraints

- Finance data remains in Supabase, not browser localStorage.
- Access remains restricted to the authenticated approved user through existing Auth + RLS rules.
- No service-role/admin key may appear in browser code.
- September 2026 remains the first tracked month.
- Historical months must not change when later-month metadata or plans are edited.
- Financial corrections use reversal/correction records rather than destructive transaction deletion.
- Loans and Credits are balance-bearing liabilities and must not also be counted as ordinary expense rows.
- Home and Other Expenses are ordinary expenses and do not carry balances.
- Money Lent is a receivable asset and is displayed separately from liabilities.
- Mobile layout must remain fully usable.

---

## File Structure

- `supabase/migrations/20260916_category_behavior.sql` — adds category behavior, receivable tables, indexes, RLS, and helper constraints.
- `supabase/migrations/20260916_reclassify_money_plan.sql` — reclassifies current categories and removes liability/expense duplication without inventing unknown balances.
- `supabase/tests/20260916_category_behavior_checks.sql` — database-level integrity and RLS checks.
- `js/money-calculations.js` — pure category-aware finance calculations.
- `js/money-api.js` — Supabase CRUD/RPC access for liabilities, expenses, and receivables.
- `js/category-behavior.js` — small pure helpers that map category behavior to allowed form/action modes.
- `js/screens/payments.js` — normal expense rows only plus category-driven add flow.
- `js/screens/debts.js` — separate Loans and Credits groups, balance carry-forward, variable monthly payments.
- `js/screens/receivables.js` — Money Lent balances and repayments.
- `js/screens/overview.js` — separate liabilities, receivables, cash flow, and Safe to Save KPIs.
- `js/screens/settings.js` — editable category behavior and category metadata.
- `js/money-app.js` — category-driven routing, sheets, and navigation.
- `index.html` — adds Money Lent navigation entry if needed.
- `money-plan.css` — styles for new category selector states and receivable screen.
- `tests/money-category-logic.test.mjs` — category behavior and accounting tests.
- `tests/money-receivables.test.mjs` — receivable lifecycle tests.
- `.github/workflows/money-plan-verify.yml` — extends verification to the new modules and migration files.

---

### Task 1: Add category behavior and receivable schema

**Files:**
- Create: `supabase/migrations/20260916_category_behavior.sql`
- Create: `supabase/tests/20260916_category_behavior_checks.sql`

**Interfaces:**
- Produces category field: `money_categories.behavior_type text` constrained to `liability | expense | receivable`.
- Produces tables: `money_receivables`, `money_receivable_transactions`.
- Produces transaction kinds: `lend`, `repayment`, `reversal`.
- Produces RLS policies using the same approved-user ownership pattern as existing Money Plan tables.

- [ ] **Step 1: Write database checks first**

Add SQL assertions covering:

```sql
select behavior_type
from public.money_categories
where behavior_type not in ('liability','expense','receivable');
```

Expected result after implementation: zero rows.

Add checks that both receivable tables have RLS enabled and that every row carries `user_id`.

- [ ] **Step 2: Apply the checks against the current schema and confirm they fail**

Run the SQL checks in Supabase against project `tmupbruwmwlrmewhoodn`.

Expected: missing-column / missing-table failures.

- [ ] **Step 3: Implement the schema migration**

Create:

```sql
alter table public.money_categories
  add column if not exists behavior_type text not null default 'expense',
  add constraint money_categories_behavior_type_check
    check (behavior_type in ('liability','expense','receivable'));
```

Create `money_receivables` with:

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id)
name text not null
opening_balance numeric(14,2) not null check (opening_balance >= 0)
current_balance numeric(14,2) not null check (current_balance >= 0)
expected_repayment_date date null
remarks text null
is_active boolean not null default true
start_month_key text not null default '2026-09'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Create `money_receivable_transactions` with:

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id)
receivable_id uuid not null references public.money_receivables(id)
month_id uuid not null references public.money_months(id)
transaction_type text not null check (transaction_type in ('lend','repayment','reversal'))
amount numeric(14,2) not null check (amount > 0)
transaction_date date not null
remarks text null
reverses_transaction_id uuid null references public.money_receivable_transactions(id)
reversed_at timestamptz null
created_at timestamptz not null default now()
```

Add indexes on `(user_id, is_active)`, `(receivable_id, transaction_date)`, and `(month_id)`.

Add select/insert/update/delete RLS policies matching the existing approved-account policy shape.

- [ ] **Step 4: Re-run database checks**

Expected: zero invalid category rows; both receivable tables present; RLS enabled.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260916_category_behavior.sql supabase/tests/20260916_category_behavior_checks.sql
git commit -m "feat: add category behavior and receivables schema"
```

---

### Task 2: Reclassify existing Money Plan data safely

**Files:**
- Create: `supabase/migrations/20260916_reclassify_money_plan.sql`

**Interfaces:**
- Consumes: `money_categories.behavior_type` from Task 1.
- Produces initial behavior mapping without fabricating unknown balances.

- [ ] **Step 1: Write a pre-migration inspection query**

Verify current rows for categories, money items, debts, and September month items. Capture counts for later comparison.

- [ ] **Step 2: Apply category mapping**

Map:

```text
Loans -> liability
Credit -> liability
Home -> expense
Utilities -> expense
Family -> expense
Food -> expense
Other -> expense
Money Lent -> receivable
```

Create missing user-facing categories if absent:

```text
Loans
Credits
Home Expenses
Other Expenses
Money Lent
```

Preserve existing category IDs where practical; do not delete historical categories that are already referenced.

- [ ] **Step 3: Normalize known balance-bearing accounts**

Ensure known liabilities are represented only in `money_debts`:

```text
Agro
Council
Naseembe
Alikko
BML
White Saffron
Tsuhail
```

Set `debt_type = 'loan'` for Agro, Council, Naseembe, Alikko, BML.
Set `debt_type = 'credit'` for White Saffron and Tsuhail.

Do not insert a balance when the correct balance is unknown. Unknown accounts remain absent until the user enters the correct balance.

- [ ] **Step 4: Remove current-month double counting**

For September 2026 only, deactivate/remove liability-linked ordinary expense snapshots for Agro and Council from `money_month_items` once their debt accounts are confirmed, while keeping the historical audit trail intact.

Retain ordinary expense items for:

```text
Food
Phone bill
Electricity
Kids
Other Expense
```

- [ ] **Step 5: Verify migration totals**

Run queries proving:

```text
Agro/Council are not counted in money_month_items as normal expenses.
Food/Phone bill/Electricity/Kids remain expense items.
Existing debt balances remain unchanged.
No payment rows were invented.
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260916_reclassify_money_plan.sql
git commit -m "data: reclassify money plan categories"
```

---

### Task 3: Implement pure category-aware accounting logic

**Files:**
- Create: `js/category-behavior.js`
- Modify: `js/money-calculations.js`
- Create: `tests/money-category-logic.test.mjs`
- Create: `tests/money-receivables.test.mjs`

**Interfaces:**
- Produces `behaviorForCategory(category): 'liability' | 'expense' | 'receivable'`.
- Produces `formModeForBehavior(behavior): 'liability-payment' | 'expense-payment' | 'receivable'`.
- Extends `calculateMonthSummary(...)` to accept receivable transactions and return `cashIn`, `cashOut`, `receivableRepayments`, `moneyLent`, `receivablesLeft`, `loansLeft`, `creditLeft`, `safeToSave`.

- [ ] **Step 1: Write failing tests for category behavior**

```js
assert.equal(formModeForBehavior('liability'), 'liability-payment');
assert.equal(formModeForBehavior('expense'), 'expense-payment');
assert.equal(formModeForBehavior('receivable'), 'receivable');
```

- [ ] **Step 2: Write failing accounting tests**

Cover:

```text
expense payment reduces cash but not liability balance
loan payment reduces only selected loan
credit payment reduces only selected credit
money lent reduces available cash and increases receivable balance
repayment increases cash and reduces receivable balance
reversal restores prior receivable balance
zero loan payment leaves next-month opening unchanged
next month opening equals previous month closing
```

- [ ] **Step 3: Run tests and confirm failures**

```bash
node --test tests/money-category-logic.test.mjs tests/money-receivables.test.mjs
```

Expected: failures for missing helpers/new summary fields.

- [ ] **Step 4: Implement minimal pure helpers**

`category-behavior.js` must contain no DOM or Supabase code.

Update `calculateMonthSummary` so:

```text
cashIn = income + valid receivable repayments
cashOut = ordinary expense payments + liability payments + money lent
availableNow = cashIn - cashOut
stillToPay = unpaid planned ordinary expenses + explicit monthly liability targets only
safeToSave = max(0, availableNow - stillToPay)
```

Keep liabilities and receivables separate in returned totals.

- [ ] **Step 5: Run all calculation tests**

```bash
node --test tests/money-calculations.test.mjs tests/money-ui-models.test.mjs tests/money-category-logic.test.mjs tests/money-receivables.test.mjs
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add js/category-behavior.js js/money-calculations.js tests/money-category-logic.test.mjs tests/money-receivables.test.mjs
git commit -m "feat: add category-aware money calculations"
```

---

### Task 4: Add Supabase API for receivables and behavior-aware writes

**Files:**
- Modify: `js/money-api.js`
- Create: `supabase/migrations/20260916_receivable_rpcs.sql`

**Interfaces:**
- Produces `listReceivables({ includeCompleted })`.
- Produces `createReceivable({ name, amount, date, monthId, expectedRepaymentDate, remarks })`.
- Produces `recordReceivableRepayment({ receivableId, monthId, amount, date, remarks })`.
- Produces `reverseReceivableTransaction(transactionId, reason)`.
- Keeps `recordPayment(...)` for expense/liability payments.

- [ ] **Step 1: Add failing API-contract tests or isolated mocks**

Assert the exported function names exist and that invalid zero/negative amounts are rejected client-side before RPC submission.

- [ ] **Step 2: Create transactional RPCs**

Create `money_create_receivable`, `money_record_receivable_repayment`, and `money_reverse_receivable_transaction` as database functions that:

```text
validate auth ownership
lock the target receivable row for update
cap repayment at current balance
write ledger row
update current_balance once
mark closed when balance reaches zero
restore balance on reversal
return the resulting balance
```

- [ ] **Step 3: Add API wrappers**

Each wrapper must call `requireUser()` first and surface Supabase errors unchanged to the sheet error handler.

- [ ] **Step 4: Verify with a rolled-back authenticated SQL transaction**

Simulate:

```text
lend MVR 2,000
repay MVR 500
balance becomes MVR 1,500
reverse repayment
balance returns to MVR 2,000
```

Rollback so no test data remains.

- [ ] **Step 5: Commit**

```bash
git add js/money-api.js supabase/migrations/20260916_receivable_rpcs.sql
git commit -m "feat: add receivable transaction API"
```

---

### Task 5: Make forms and navigation category-driven

**Files:**
- Modify: `js/money-app.js`
- Modify: `index.html`
- Modify: `money-plan.css`
- Create: `js/screens/receivables.js`
- Modify: `js/screens/payments.js`
- Modify: `js/screens/debts.js`
- Modify: `js/screens/settings.js`

**Interfaces:**
- Consumes `behaviorForCategory` and `formModeForBehavior` from Task 3.
- Adds app view `receivables`.
- Adds action handlers `add-receivable`, `repay-receivable`, `reverse-receivable-transaction`.

- [ ] **Step 1: Add UI-model tests for form switching**

Test that selecting a category with each behavior yields the correct field model:

```text
liability -> account/current balance/payment amount/projected balance/date/remarks
expense -> name/amount/date/remarks/recurring
receivable -> borrower/amount lent/date/expected repayment date/remarks
```

- [ ] **Step 2: Update navigation**

Add `Money Lent` alongside Overview, Payments, Debts, History, Settings.

- [ ] **Step 3: Update Payments screen**

Display only expense-behavior rows.

For Home/Other rows show:

```text
name
category
planned
paid
remaining
status
Edit
Record payment
```

Do not display Agro, Council, Naseembe, Alikko, BML, White Saffron, or Tsuhail here when they are liability accounts.

- [ ] **Step 4: Update Debts screen**

Group separately:

```text
Loans
Credits
```

Each card shows opening/current balance, paid this month, remaining balance, optional target, Record payment, Edit.

No fixed payment is required.

- [ ] **Step 5: Create Money Lent screen**

Each receivable card shows:

```text
person/name
amount originally lent
current amount owed to me
repayments this month
expected repayment date if present
remarks
Record repayment
```

- [ ] **Step 6: Replace generic add-item flow with behavior-driven flow**

First choose category. Then render only the fields appropriate for that category behavior. Prevent saving until the required fields for that behavior are valid.

- [ ] **Step 7: Update Settings**

Category rows show both display name and behavior type. Editing a category behavior requires confirmation if existing records reference it.

- [ ] **Step 8: Run UI tests and syntax checks**

```bash
node --test tests/*.test.mjs
find js -name '*.js' -print0 | while IFS= read -r -d '' file; do node --check "$file"; done
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add index.html money-plan.css js/money-app.js js/screens/payments.js js/screens/debts.js js/screens/receivables.js js/screens/settings.js tests
git commit -m "feat: drive money forms from category behavior"
```

---

### Task 6: Update dashboard and history calculations

**Files:**
- Modify: `js/screens/overview.js`
- Modify: `js/screens/history.js`
- Modify: `js/money-charts.js`
- Modify: `js/money-app.js`

**Interfaces:**
- Consumes extended summary from Task 3.
- Adds overview KPIs: `Loans Left`, `Credits Left`, `Money Owed to Me`.
- History keeps liabilities and receivables separate.

- [ ] **Step 1: Add failing dashboard-model tests**

Given sample data, assert:

```text
Loans Left = sum loan balances only
Credits Left = sum credit balances only
Money Owed to Me = sum active receivable balances
Safe to Save excludes unpaid future receivable repayments
Money Lent counts as cash outflow
Repayments Received counts as cash inflow
```

- [ ] **Step 2: Update Overview**

Use breathable KPI groups rather than one dense row. Keep the primary money-flow cards visually separate from balance-sheet cards.

- [ ] **Step 3: Update history model**

For each month calculate as-of balances from valid non-reversed transactions so later reversals or edits do not mutate historical snapshots incorrectly.

- [ ] **Step 4: Update charts**

Keep existing cash-flow/debt trend graphs and add receivable trend only if data exists. Do not render empty decorative charts.

- [ ] **Step 5: Run tests**

```bash
node --test tests/*.test.mjs
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add js/screens/overview.js js/screens/history.js js/money-charts.js js/money-app.js tests
git commit -m "feat: separate liabilities and receivables in dashboard"
```

---

### Task 7: Final security, migration, and deployment verification

**Files:**
- Modify: `.github/workflows/money-plan-verify.yml`
- Test: `supabase/tests/20260916_category_behavior_checks.sql`

**Interfaces:**
- Produces a deployable branch with verified category logic and no regression to localStorage or service-role exposure.

- [ ] **Step 1: Extend CI checks**

Add checks that:

```bash
node --test tests/*.test.mjs
! grep -R -E 'localStorage\.(getItem|setItem|removeItem|clear)' js index.html
! grep -R -E 'service[_-]?role' js index.html
grep -q 'receivables' js/money-app.js
grep -q 'behavior_type' supabase/migrations/20260916_category_behavior.sql
```

- [ ] **Step 2: Run Supabase advisor/security checks**

Confirm new tables have RLS enabled, no exposed service functions bypass ownership, and no missing indexes on foreign keys used by the receivable flow.

- [ ] **Step 3: Run end-to-end database verification with rollback**

Verify these exact flows:

```text
Home expense payment -> affects cash only
Agro payment -> reduces Agro only
White Saffron payment -> reduces credit only
Money lent -> creates receivable and reduces cash
Receivable repayment -> reduces receivable and increases cash
Reverse loan payment -> restores liability
Reverse receivable repayment -> restores receivable
October opening balance -> equals September closing balance
```

Rollback synthetic rows after verification.

- [ ] **Step 4: Run GitHub Actions on the implementation branch**

Expected: Money Plan verify workflow completes successfully.

- [ ] **Step 5: Review main-vs-branch diff**

Confirm no unrelated changes to `ot.html` or other repository apps.

- [ ] **Step 6: Commit final verification changes**

```bash
git add .github/workflows/money-plan-verify.yml supabase/tests/20260916_category_behavior_checks.sql
git commit -m "ci: verify category-driven money logic"
```

---

## Self-Review Notes

- Spec coverage: category behavior, loans, credits, home expenses, other expenses, remarks, money lent, repayments, reversals, carry-forward balances, separate dashboard totals, security, mobile UI, and migration rules are all mapped to tasks above.
- Placeholder scan: no TBD/TODO/future placeholder steps remain.
- Type consistency: behavior values are consistently `liability | expense | receivable`; liability subtype remains `loan | credit`; receivable transaction types remain `lend | repayment | reversal`.
- Scope: this is one coherent accounting-behavior change because all UI, data, and calculations depend on the same category behavior contract.
