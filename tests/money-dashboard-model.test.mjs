import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardModel } from '../js/money-dashboard-model.js';

test('dashboard combines opening bank balance and salary before subtracting spending', () => {
  const model = buildDashboardModel({
    month: { income: 27000, bank_balance: 12345 },
    summary: { paid: 6500, stillToPay: 8200, loansLeft: 9000, creditLeft: 2500, receivablesLeft: 1800, cashIn: 27000, cashOut: 6500 },
  });

  assert.equal(model.openingBankBalance, 12345);
  assert.equal(model.salaryReceived, 27000);
  assert.equal(model.totalMoneyThisMonth, 39345);
  assert.equal(model.paidThisMonth, 6500);
  assert.equal(model.availableNow, 32845);
  assert.equal(model.bankBalance, 32845);
  assert.equal(model.stillLeftToPay, 8200);
  assert.equal(model.expectedAfterBills, 24645);
  assert.equal(model.loansLeft, 9000);
  assert.equal(model.creditsLeft, 2500);
  assert.equal(model.moneyOwedToMe, 1800);
});

test('missing opening bank balance is treated as zero while salary remains available', () => {
  const model = buildDashboardModel({ month: { income: 27000, bank_balance: null }, summary: {} });
  assert.equal(model.openingBankBalance, 0);
  assert.equal(model.totalMoneyThisMonth, 27000);
  assert.equal(model.availableNow, 27000);
  assert.equal(model.bankBalance, 27000);
});
