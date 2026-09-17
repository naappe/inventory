import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentsPageModel } from '../js/payments-page-model.js';

test('builds monthly control totals and separates loans from credits', () => {
  const model = buildPaymentsPageModel({
    month: { income: 25000, bank_balance: 8700 },
    monthItems: [
      { id: 'food', name_snapshot: 'Food', planned_amount: 5000 },
      { id: 'electric', name_snapshot: 'Electricity', planned_amount: 1000 },
    ],
    payments: [
      { payment_type: 'expense', month_item_id: 'food', amount: 1500 },
      { payment_type: 'debt', debt_id: 'agro', amount: 1250 },
      { payment_type: 'debt', debt_id: 'ws', amount: 500 },
    ],
    debts: [
      { id: 'agro', name: 'Agro', debt_type: 'loan', current_balance: 7750, monthly_plan: 1500 },
      { id: 'ws', name: 'White Saffron', debt_type: 'credit', current_balance: 2500, monthly_plan: 500 },
    ],
    receivables: [],
    receivableTransactions: [],
  });

  assert.equal(model.salaryGot, 25000);
  assert.equal(model.openingBankBalance, 8700);
  assert.equal(model.spentThisMonth, 3250);
  assert.equal(model.bankBalance, 30450);
  assert.equal(model.stillToPay, 4750);
  assert.equal(model.expectedMonthEnd, 25700);
  assert.equal(model.safeToSpend, 25700);
  assert.equal(model.loansLeft, 7750);
  assert.equal(model.creditsLeft, 2500);
  assert.equal(model.loans[0].openingBalance, 9000);
  assert.equal(model.loans[0].paidThisMonth, 1250);
  assert.equal(model.loans[0].balanceLeft, 7750);
  assert.equal(model.credits[0].openingBalance, 3000);
  assert.equal(model.credits[0].paidThisMonth, 500);
  assert.equal(model.credits[0].balanceLeft, 2500);
});

test('does not count reversed payments in spent or liability paid', () => {
  const model = buildPaymentsPageModel({
    month: { income: 10000, bank_balance: 4000 },
    monthItems: [],
    payments: [
      { payment_type: 'debt', debt_id: 'loan', amount: 1000, reversed_at: '2026-09-16T10:00:00Z' },
    ],
    debts: [{ id: 'loan', name: 'BML', debt_type: 'loan', current_balance: 5000, monthly_plan: 0 }],
  });
  assert.equal(model.spentThisMonth, 0);
  assert.equal(model.bankBalance, 14000);
  assert.equal(model.loans[0].paidThisMonth, 0);
  assert.equal(model.loans[0].openingBalance, 5000);
});
