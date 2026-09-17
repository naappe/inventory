import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthSaveState, buildMonthSnapshot } from '../js/month-save-model.js';

test('unsaved month is Not Saved', () => {
  assert.equal(buildMonthSaveState({ month_key:'2026-09' }).status, 'not-saved');
});

test('dirty saved month asks to save again', () => {
  const state = buildMonthSaveState({ month_key:'2026-09', saved_at:'2026-09-17T10:00:00Z', saved_revision:1, dirty_since_save:true });
  assert.equal(state.status, 'dirty');
  assert.equal(state.buttonLabel, 'Save September Again');
});

test('snapshot captures confirmed totals', () => {
  const snapshot = buildMonthSnapshot({
    month:{ month_key:'2026-09', bank_balance:8500, income:25000 },
    dashboard:{ openingBankBalance:8500, salaryReceived:25000, totalMoneyThisMonth:33500, paidThisMonth:7400, availableNow:26100, stillLeftToPay:2000, expectedAfterBills:24100, loansLeft:60000, creditsLeft:7285, moneyOwedToMe:0 },
    debtReduced:2500,
    safeToSave:4000,
    savedAt:'2026-09-17T10:00:00Z',
  });
  assert.equal(snapshot.totalMoneyThisMonth, 33500);
  assert.equal(snapshot.debtReduced, 2500);
  assert.equal(snapshot.safeToSave, 4000);
});
