import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDebtGuidance } from '../js/debt-guidance-model.js';

test('highest APR wins when APR exists', () => {
  const result = buildDebtGuidance({ debts:[
    {id:'a',name:'A',debt_type:'loan',current_balance:9000,monthly_plan:1000,apr:8},
    {id:'b',name:'B',debt_type:'credit',current_balance:12000,monthly_plan:1500,apr:18},
  ], availableNow:10000, stillToPay:3000, emergencyReserve:2000 });
  assert.equal(result.focusDebt.id, 'b');
});

test('smaller balance breaks APR tie', () => {
  const result = buildDebtGuidance({ debts:[
    {id:'a',name:'A',current_balance:5000,apr:12},
    {id:'b',name:'B',current_balance:3000,apr:12},
  ]});
  assert.equal(result.focusDebt.id, 'b');
});

test('smallest balance wins when APR is absent', () => {
  const result = buildDebtGuidance({ debts:[
    {id:'a',name:'A',current_balance:9000,apr:null},
    {id:'b',name:'B',current_balance:4000,apr:null},
  ]});
  assert.equal(result.focusDebt.id, 'b');
});

test('safe to save and extra payment never go negative', () => {
  const result = buildDebtGuidance({ debts:[{id:'a',name:'A',current_balance:9000}], availableNow:1000, stillToPay:2000, emergencyReserve:1000 });
  assert.equal(result.safeToSave, 0);
  assert.equal(result.suggestedExtraPayment, 0);
});

test('extra payment never exceeds focus balance', () => {
  const result = buildDebtGuidance({ debts:[{id:'a',name:'A',current_balance:1500}], availableNow:10000, stillToPay:1000, emergencyReserve:1000 });
  assert.equal(result.suggestedExtraPayment, 1500);
});

test('no active debt returns an empty guidance state', () => {
  const result = buildDebtGuidance({ debts:[] });
  assert.equal(result.focusDebt, null);
});
