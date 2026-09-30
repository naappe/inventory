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
      { id: 'food', planned_amount: 17000 },
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


test('financial reconciliation: cash in minus cash out equals available now', () => {
  const summary = calculateMonthSummary({
    income: 27000,
    monthItems: [{ id: 'food', planned_amount: 4500 }],
    debts: [
      { id: 'loan', debt_type: 'loan', monthly_plan: 2000, current_balance: 34000 },
      { id: 'credit', debt_type: 'credit', monthly_plan: 2000, current_balance: 5642 },
    ],
    payments: [
      { payment_type: 'expense', month_item_id: 'food', amount: 4500, reversed_at: null },
      { payment_type: 'debt', debt_id: 'loan', amount: 1500, reversed_at: null },
      { payment_type: 'debt', debt_id: 'credit', amount: 2000, reversed_at: null },
    ],
  });
  assert.equal(summary.cashIn - summary.cashOut, summary.availableNow);
  assert.equal(summary.loansLeft + summary.creditLeft, summary.totalDebt);
  assert.equal(summary.expenseStillToPay + summary.debtStillToPay, summary.stillToPay);
  assert.equal(summary.availableNow - summary.stillToPay, summary.safeToSave);
});

test('undo restores expense to still-to-pay and cash balance', () => {
  const base = {
    income: 10000,
    monthItems: [{ id: 'phone', planned_amount: 700 }],
    debts: [],
  };
  const paid = calculateMonthSummary({...base, payments:[{payment_type:'expense',month_item_id:'phone',amount:700,reversed_at:null}]});
  const undone = calculateMonthSummary({...base, payments:[{payment_type:'expense',month_item_id:'phone',amount:700,reversed_at:'2026-09-30T00:00:00Z'}]});
  assert.equal(paid.availableNow, 9300);
  assert.equal(paid.stillToPay, 0);
  assert.equal(undone.availableNow, 10000);
  assert.equal(undone.stillToPay, 700);
});

test('multiple debt payments reconcile against one monthly target', () => {
  const summary = calculateMonthSummary({
    income: 10000,
    debts: [{ id:'agro', debt_type:'loan', monthly_plan:1000, current_balance:10249 }],
    payments: [
      { payment_type:'debt', debt_id:'agro', amount:400, reversed_at:null },
      { payment_type:'debt', debt_id:'agro', amount:600, reversed_at:null },
    ],
  });
  assert.equal(summary.liabilityPaid, 1000);
  assert.equal(summary.debtStillToPay, 0);
  assert.equal(summary.totalDebt, 10249);
});

test('receivable lending and repayment affect cash in opposite directions', () => {
  const summary = calculateMonthSummary({
    income: 5000,
    receivables:[{id:'r1',current_balance:700,is_active:true}],
    receivableTransactions:[
      {transaction_type:'lend',amount:1000,reversed_at:null},
      {transaction_type:'repayment',amount:300,reversed_at:null},
    ],
  });
  assert.equal(summary.moneyLent,1000);
  assert.equal(summary.receivableRepayments,300);
  assert.equal(summary.cashIn,5300);
  assert.equal(summary.cashOut,1000);
  assert.equal(summary.availableNow,4300);
  assert.equal(summary.receivablesLeft,700);
});
