import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMonthSummary } from '../js/money-calculations.js';

test('money lent is cash out and receivable balance stays separate', () => {
  const summary = calculateMonthSummary({
    income: 10000,
    receivables: [{ current_balance: 2000 }],
    receivableTransactions: [{ transaction_type: 'lend', amount: 2000 }],
  });
  assert.equal(summary.moneyLent, 2000);
  assert.equal(summary.cashOut, 2000);
  assert.equal(summary.availableNow, 8000);
  assert.equal(summary.receivablesLeft, 2000);
});

test('receivable repayment is cash in', () => {
  const summary = calculateMonthSummary({
    income: 10000,
    receivables: [{ current_balance: 1500 }],
    receivableTransactions: [{ transaction_type: 'repayment', amount: 500 }],
  });
  assert.equal(summary.receivableRepayments, 500);
  assert.equal(summary.cashIn, 10500);
  assert.equal(summary.availableNow, 10500);
  assert.equal(summary.receivablesLeft, 1500);
});

test('reversed receivable transaction is ignored', () => {
  const summary = calculateMonthSummary({
    income: 10000,
    receivableTransactions: [{ transaction_type: 'repayment', amount: 500, reversed_at: '2026-09-16T00:00:00Z' }],
  });
  assert.equal(summary.receivableRepayments, 0);
  assert.equal(summary.cashIn, 10000);
});
