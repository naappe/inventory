# My Money Plan — Category-Driven Money Logic Design

Date: 2026-09-16
Repository: `naappe/inventory`
Status: Approved design, awaiting implementation plan

## 1. Goal

Update My Money Plan so that selecting a category determines the accounting behavior automatically. The app must distinguish money the user owes, normal spending, and money other people owe the user.

The design must preserve the existing Supabase-backed cloud architecture, current September 2026 data, audit-safe reversals, editable items, debt carry-forward logic, and mobile-first UI.

## 2. Category Behavior Model

Every category gets a `behavior_type`. Category names remain user-friendly, while calculations depend on behavior rather than hard-coded names.

Supported behavior types:

- `liability` — balances the user owes. Used by both Loans and Credits.
- `expense` — ordinary spending that does not carry an outstanding balance.
- `receivable` — money the user lends to someone and expects to collect back.

This avoids writing special calculation rules for names such as Agro, Kids, or White Saffron.

## 3. Initial Category Mapping

### Loans — `liability`

Tracked as separate debt accounts with balance carry-forward:

- Agro
- Council
- Naseembe
- Alikko
- BML

A loan does not require a fixed monthly payment. In any month the user may pay any amount, including zero.

For each loan, the app shows:

- opening balance for the month
- amount paid during the month
- remaining / closing balance
- next month's opening balance = previous month's closing balance

Example:

- September opening balance: MVR 9,000
- September payment: MVR 1,500
- September closing balance: MVR 7,500
- October opening balance: MVR 7,500

If October payment is MVR 500, October closing balance becomes MVR 7,000.

### Credits — `liability`

Credits use the same balance-carry logic as loans, but remain labelled separately in the UI.

Initial known credit accounts:

- White Saffron
- Tsuhail

Additional credit accounts can be created later without code changes.

### Home Expenses — `expense`

Normal monthly household spending:

- Food
- Phone bill
- Electricity
- Kids

These reduce cash and affect monthly spending and Safe to Save. They do not create a carried loan balance.

### Other Expenses — `expense`

One-off or miscellaneous spending. The transaction form includes a Remarks field so the reason is retained.

### Money Lent — `receivable`

Money given to another person as a loan. This is an asset / receivable, not the user's debt.

When money is lent:

- available cash decreases by the amount lent
- a receivable balance is created for the person
- the app records person/name, amount, date, optional expected repayment date, and remarks

When money is repaid:

- receivable balance decreases
- cash received increases
- repayment remains in transaction history

The receivable balance carries forward month to month until fully repaid.

## 4. Selection-Driven Form Logic

The add/record form changes immediately when the selected category behavior changes.

### For `liability`

Show:

- category
- account / loan / credit name
- current balance
- amount paid this month
- payment amount
- payment date
- projected balance after payment
- remarks / note

Saving a payment reduces the selected liability account balance exactly once.

### For `expense`

Show:

- category
- expense name
- amount
- payment date
- remarks
- recurring toggle where applicable

No carried balance is created.

### For `receivable`

When creating a loan to someone, show:

- person / borrower name
- amount lent
- date lent
- expected repayment date (optional)
- remarks

For an existing receivable, show a Record repayment action with:

- current amount still owed to the user
- repayment amount
- date received
- projected balance after repayment
- remarks

## 5. Data Model Changes

### `money_categories`

Add a constrained `behavior_type` field:

- `liability`
- `expense`
- `receivable`

Category display name remains separate from behavior.

### Liability accounts

Existing `money_debts` continues to hold liability accounts. Add/retain a subtype field distinguishing:

- `loan`
- `credit`

Required behavior:

- opening balance is persistent
- payments are transaction-ledger records
- current/as-of balance is derived from opening balance minus valid non-reversed payments and adjustments
- no mandatory fixed monthly payment
- historical monthly balances must not change when a later month is edited

### Expense items

`money_items` / `money_month_items` continue to represent recurring or one-off expenses. These are used only for `expense` behavior.

Loan and credit accounts must not also exist as normal expense rows, because that causes duplicate counting.

### Receivables

Add dedicated receivable storage rather than overloading `money_debts`.

Recommended tables:

- `money_receivables` — one balance-bearing record per person/loan
- `money_receivable_transactions` — lent amount, repayments, corrections/reversals

Each receivable belongs to the authenticated user and is protected by RLS.

## 6. Monthly Calculations

### Cash outflows

Cash paid out this month includes:

- home/other expense payments
- liability payments
- money lent to others

### Cash inflows

Cash received includes:

- monthly income
- receivable repayments

### Available Now

`income + receivable repayments - all cash outflows`

### Still to Pay

Includes only planned unpaid expense obligations and any explicit current-month liability payment targets the user chooses to set. A loan with no chosen target contributes zero to Still to Pay.

### Safe to Save

`Available Now - remaining planned obligations`

Money Lent reduces Safe to Save because it reduces available cash, even though it creates a receivable asset.

### Liability totals

Keep separate dashboard totals for:

- Loans left
- Credits left
- Total liabilities

### Receivable totals

Show separately:

- Money others owe me
- Repayments received this month

Receivables must never be netted invisibly against debts because the user needs to see both sides clearly.

## 7. Dashboard and Navigation

The app should present clear financial buckets instead of mixing them.

Recommended dashboard summary:

- Income / cash in
- Paid / cash out
- Still to Pay
- Safe to Save
- Loans Left
- Credits Left
- Money Owed to Me

Main sections remain simple:

- Overview
- Payments
- Debts
- Money Lent
- History
- Settings

`Debts` contains Loans and Credits as separate grouped sections.

`Money Lent` contains active receivables and repayment actions.

## 8. Payment Page Rules

The Payments page must not list Agro, Council, Naseembe, Alikko, BML, White Saffron, or Tsuhail as ordinary expense rows when they are balance-bearing accounts.

Instead:

- normal monthly rows contain Home / Other expenses
- balance-bearing Loan/Credit accounts are handled as liability accounts
- payments against liabilities reduce balances and remain in history

This removes double counting and makes the due/current balance visible.

## 9. Editing and Corrections

### Expense edit

Editing a current-month expense updates the current month snapshot and the reusable default for future months, while historical months remain unchanged.

### Liability edit

Editable metadata:

- name
- subtype (loan/credit)
- optional notes
- optional monthly target for the selected month

Historical payments are never rewritten.

### Payment corrections

Existing financial transactions are corrected through reversal/correction records, not silent deletion.

Reversing a liability payment restores the liability balance.

Reversing a receivable repayment restores the receivable balance.

## 10. Migration of Current Data

Existing restored data should be reclassified without inventing payment history.

### Liability accounts

Keep known balances for:

- Agro
- Council
- Naseembe
- Alikko
- BML, once its correct current balance is entered/confirmed

Credit accounts:

- White Saffron
- Tsuhail

Any current balance not known with confidence must remain unset until entered by the user. Do not invent figures.

### Expenses

Keep / create:

- Food — Home Expense
- Phone bill — Home Expense
- Electricity — Home Expense
- Kids — Home Expense
- Other Expense — generic one-off category with remarks

Existing expense records that were incorrectly duplicated as debt items must be migrated carefully so the user is not charged twice in September calculations.

## 11. Security

All new tables use the existing Supabase Auth user ownership model and RLS.

Only the approved authenticated user can read or mutate Money Plan rows.

No service-role key is exposed in GitHub Pages.

Finance data remains in Supabase, not browser localStorage.

## 12. Error Handling

For financial writes:

1. validate input
2. disable duplicate submission while saving
3. write to Supabase
4. wait for confirmed response
5. refresh the relevant balances

On network or database failure:

- keep the form open
- preserve entered values
- show a clear Not saved / Retry state
- do not optimistically alter a loan or receivable balance

## 13. Testing Requirements

Implementation must include tests for:

- category behavior selection changes the form correctly
- expense payment affects cash but not carried balances
- liability payment reduces only the selected account
- zero liability payment leaves next month opening unchanged
- next month opening equals previous month closing
- reversed liability payment restores the correct balance
- money lent reduces available cash and creates receivable balance
- repayment increases cash and reduces receivable balance
- reversed repayment restores receivable balance
- Loan and Credit totals stay separate
- liability rows are not double-counted as expenses
- historical months remain unchanged after later edits
- RLS denies other users
- mobile UI remains usable

## 14. Success Criteria

The redesign is successful when the user can select a category and trust that the app automatically applies the correct financial logic without needing to understand the database structure.

The critical rule is:

**Category selection determines whether the transaction is a liability payment, ordinary expense, or receivable transaction, and all balances and monthly calculations follow that behavior automatically.**
