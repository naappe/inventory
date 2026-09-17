# Month Save, Debt Priority, and Savings Guidance Design

Date: 2026-09-17
Repository: naappe/inventory

## Goal

Add a month-completion workflow to My Money Plan without locking editing, and add clear guidance about which loan to focus on next and how much money may be safe to save.

## Confirmed decisions

- Saving a month does not lock it.
- After a month is saved, any finance edit changes its status to `Changes not saved`.
- The user must press `Save <Month> Again` to confirm the revised month snapshot.
- Debt priority uses a smart hybrid rule:
  - when APR data is meaningfully available, prioritize the highest APR among active debts;
  - otherwise prioritize the smallest remaining balance.
- Advice is informational only. It never records a payment or changes balances automatically.

## Month status model

Each month needs a persistent completion record with three visible states:

1. `Not Saved`
2. `Saved`
3. `Changes not saved`

Recommended persistent fields on `money_months`:

- `saved_at timestamptz null`
- `saved_revision integer not null default 0`
- `saved_snapshot jsonb null`
- `dirty_since_save boolean not null default false`

The saved snapshot stores the confirmed month totals at the time the Save Month button is pressed. Editing remains enabled at all times.

### Snapshot fields

The snapshot should contain at least:

- month key
- opening bank balance
- salary received
- total money available for the month
- actual spent this month
- still to pay
- available bank balance
- expected month-end balance
- loans remaining
- credits remaining
- money owed to the user
- safe-to-save value
- debt reduced during the month
- saved timestamp

The snapshot is historical evidence of what the user confirmed. Current live figures continue to come from the normal month data and payment records.

## Dirty-state behavior

Any change that can alter the month summary marks a previously saved month as dirty. This includes:

- salary changes
- opening bank balance changes
- expense add/edit/delete
- expense payment or reversal
- loan/credit add/edit/delete
- loan/credit payment or reversal
- monthly loan payment target changes
- money lent add/edit/delete
- repayment received or reversal

When the month has never been saved, edits do not need a dirty flag because the visible state remains `Not Saved`.

When a saved month is dirty:

- show `Changes not saved` prominently;
- change the main button to `Save <Month> Again`;
- keep all edit controls available.

Saving again replaces `saved_snapshot`, updates `saved_at`, increments `saved_revision`, and clears the dirty flag.

## Overview month completion card

Add a prominent card near the top of Overview.

### Not Saved state

- Status: `Not Saved`
- Main action: `Save September`
- Supporting text: `Finish your entries, then save this month’s confirmed summary.`

### Saved state

- Status: `Saved`
- Show exact save date/time
- Show saved revision number only in details, not as primary UI
- Main action can read `Save September Again` only after new edits; otherwise no urgent action is needed

### Changes not saved state

- Status: `Changes not saved`
- Main action: `Save September Again`
- Supporting text: `You changed this month after the last save.`

A details expander should show the saved snapshot versus current live totals when the month is dirty so the user can see what changed before saving again.

## Debt priority engine

Create a pure calculation module that accepts active loans/credits and returns a ranked focus result plus explanation text.

### Eligible debts

Only debts with a remaining balance greater than zero are considered.

### Smart hybrid rule

1. If at least one active debt has APR greater than zero, select the active debt with the highest APR.
2. When APR ties, prefer the smaller remaining balance.
3. If no active debt has a meaningful APR, select the smallest remaining balance.
4. Credits and loans are both eligible unless the user later chooses to exclude one type.

The result must include:

- debt id
- debt name
- debt type
- remaining balance
- APR if present
- monthly target
- reason selected
- second-choice debt if one exists

Example reason text:

- `Highest APR at 18.00%, so extra payment here reduces interest cost first.`
- `No APR entered, so the smallest remaining balance is the quickest account to clear.`

## Suggested extra payment

The app must not pretend it knows an exact optimal payment when APR schedules, minimums, and due dates are incomplete.

Use a conservative suggestion derived from available cash:

- `safeAfterPlans = max(0, availableBank - stillToPay)`
- keep an emergency reserve amount separate;
- extra payment suggestion is the smaller of:
  - remaining focus-debt balance;
  - discretionary amount after the emergency reserve.

If there is no discretionary amount, show `No extra payment suggested yet` rather than a negative or unrealistic number.

## Savings guidance

The guidance section should separate three concepts clearly:

- `Available now` — actual bank amount after recorded spending
- `Reserved for remaining plans` — unpaid planned expenses and debt targets
- `Safe to save` — what remains after planned obligations and the configured emergency reserve

### Emergency reserve

For the first version, add a user-editable emergency reserve target in Settings. Default to zero rather than inventing a financial target.

The advice layer may then say:

- `You can set aside up to MVR X after the remaining planned payments and your reserve target.`
- `Finish <Debt Name> first, then its monthly target of MVR Y can be redirected to savings or the next debt.`

Do not claim guaranteed interest savings or payoff dates unless the necessary data exists.

## Debt & Savings Plan panel

Add a panel on Overview below the main cash summary.

It should show:

- `Focus debt`
- remaining balance
- APR if available
- why this account is prioritized
- planned payment this month
- suggested extra payment, if any
- projected remaining balance after the suggested extra payment
- `Cash freed after payoff` using the monthly target when one exists
- next debt after the focus account
- safe-to-save amount
- emergency reserve target

The panel should be clickable for a detailed explanation.

## History integration

Saved months should be visibly marked in History.

Example monthly history row:

`September 2026 — Saved`

Details should show the saved snapshot values, including:

- income
- spent
- month-end / available amount
- debt reduced
- loans remaining
- credits remaining
- safe-to-save amount

If a saved month later becomes dirty, History should continue to show the last confirmed saved snapshot until the user saves again. The current month screen separately shows `Changes not saved`.

## Data flow

1. Existing month bundle loads live finance records.
2. Existing payment model calculates current live totals.
3. Month-save model compares live state with month save metadata.
4. Debt-priority model analyzes active debts and safe cash.
5. Overview renders live totals, month status, and guidance.
6. Pressing Save Month writes the current calculated snapshot to the month row.
7. Subsequent finance mutations set `dirty_since_save = true` when `saved_at` is present.
8. Saving again updates the snapshot and clears dirty state.

## Mutation marking strategy

Prefer one shared API helper such as `markMonthDirty(monthId)` and call it from every successful finance mutation that changes the selected month.

Where an operation changes another month directly, mark that affected month rather than blindly marking the currently viewed month.

This avoids relying on fragile UI-only change detection.

## Files expected to change

Likely frontend changes:

- `js/money-api.js`
- `js/money-calculations.js` or a new focused month-save model
- new `js/debt-guidance-model.js`
- `js/screens/overview.js`
- `js/screens/history.js`
- `js/screens/settings.js`
- `js/money-app.js`
- CSS for status and guidance cards
- service-worker/cache version references

Likely database migration:

- add save-state fields to `money_months`
- optional RPC for atomic month save

Tests should be added for month state and debt guidance instead of embedding the logic only in screen rendering.

## Error handling

- If Save Month fails, leave the current state unchanged and show an error.
- Never show `Saved` unless the database write succeeds.
- If saved snapshot data is missing or malformed, fall back to `Not Saved` or a safe incomplete-state message rather than breaking Overview.
- Debt guidance should return a neutral empty state when there are no active debts.
- Missing APR must not be treated as 0% evidence; it simply triggers the smallest-balance fallback when no meaningful APR exists.

## Testing

Add unit tests covering:

- first save changes state from Not Saved to Saved;
- edit after save produces Changes not saved;
- save again clears dirty state and increments revision;
- saved snapshot contains the expected finance totals;
- highest APR wins when APR data exists;
- smaller balance breaks equal-APR ties;
- smallest balance wins when APR data is absent;
- safe-to-save never goes below zero;
- suggested extra payment never exceeds focus-debt balance;
- no active debt produces a clean empty guidance state;
- history uses the saved snapshot rather than unsaved live changes.

Existing money-plan verification should remain green after the change.

## Non-goals for this version

- No automatic payments.
- No bank API connection.
- No automatic transfer to savings.
- No guaranteed payoff-date calculation without complete loan terms.
- No month locking.
- No deletion of historical saved snapshots outside the normal resave flow.

## Acceptance criteria

The feature is complete when:

1. The user can save September as a completed month.
2. Saving does not disable any edit control.
3. A later edit visibly changes the month to `Changes not saved`.
4. `Save September Again` stores the revised snapshot and clears the warning.
5. Overview shows a clear focus-debt recommendation with the reason.
6. APR is used when present; otherwise the smallest balance is used.
7. The app shows safe-to-save guidance based on actual cash, remaining plans, and the configured reserve.
8. History visibly identifies saved months and shows the last confirmed saved snapshot.
9. Advice never automatically modifies finance data.
10. Automated tests cover the month save and debt-guidance rules.