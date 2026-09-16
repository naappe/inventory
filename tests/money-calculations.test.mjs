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
    debts: [{ id: 'loan', monthly_plan: 2000, current_balance: 34500, apr: null }],
    payments: [
      { payment_type: 'expense', month_item_id: 'electric', amount: 1000, reversed_at: null },
      { payment_type: 'expense', month_item_id: 'food', amount: 10000, reversed_at: null },
      { payment_type: 'debt', debt_id: 'loan', amount: 1000, reversed_at: null },
    ],
  });
  assert.equal(summary.paid, 12000);
  assert.equal(summary.availableNow, 13000);
  assert.equal(summary.stillToPay, 8000);
  assert.equal(summary.safeToSave, 5000);
});

test('ignores reversed payments', () => {
  const summary = calculateMonthSummary({
    income: 5000,
    monthItems: [{ id: 'x', planned_amount: 1000 }],
    debts: [],
    payments: [{ payment_type: 'expense', month_item_id: 'x', amount: 1000, reversed_at: '2026-09-16T00:00:00Z' }],
  });
  assert.equal(summary.paid, 0);
  assert.equal(summary.stillToPay, 1000);
});

test('debt preview never goes below zero', () => {
  assert.deepEqual(calculateDebtPreview(1200, 2000), {
    effectiveAmount: 1200,
    afterPayment: 0,
  });
});

test('months remaining rounds upward', () => {
  assert.equal(monthsRemaining(35500, 1500), 24);
  assert.equal(monthsRemaining(0, 1500), 0);
  assert.equal(monthsRemaining(5000, 0), null);
});

test('focus debt prefers highest APR when APR exists', () => {
  const result = chooseFocusDebt([
    { id: 'a', current_balance: 10000, apr: 6 },
    { id: 'b', current_balance: 30000, apr: 18 },
  ]);
  assert.equal(result.id, 'b');
});

test('focus debt uses smallest balance when no APR is entered', () => {
  const result = chooseFocusDebt([
    { id: 'a', current_balance: 10000, apr: null },
    { id: 'b', current_balance: 30000, apr: null },
  ]);
  assert.equal(result.id, 'a');
});
