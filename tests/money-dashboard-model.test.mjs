import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardModel } from '../js/money-dashboard-model.js';

test('dashboard keeps manual bank balance separate from calculated cash flow', () => {
  const model = buildDashboardModel({
    month: { income: 27000, bank_balance: 12345 },
    summary: { paid: 6500, stillToPay: 8200, loansLeft: 9000, creditLeft: 2500, receivablesLeft: 1800, cashIn: 27000, cashOut: 6500 },
  });
  assert.equal(model.salaryReceived, 27000);
  assert.equal(model.paidThisMonth, 6500);
  assert.equal(model.stillLeftToPay, 8200);
  assert.equal(model.bankBalance, 12345);
  assert.equal(model.loansLeft, 9000);
  assert.equal(model.creditsLeft, 2500);
  assert.equal(model.moneyOwedToMe, 1800);
});

test('bank balance can be unset without becoming zero', () => {
  const model = buildDashboardModel({ month: { income: 27000, bank_balance: null }, summary: {} });
  assert.equal(model.bankBalance, null);
});
