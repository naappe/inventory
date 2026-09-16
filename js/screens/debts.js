import { chooseFocusDebt, debtPaymentTotal, monthsRemaining } from '../money-calculations.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderDebts(bundle) {
  const { debts = [], payments = [] } = bundle;
  const focus = chooseFocusDebt(debts);
  const active = debts.filter((d) => Number(d.current_balance || 0) > 0);
  const completed = debts.filter((d) => Number(d.current_balance || 0) <= 0);

  return `
    <section class="page-head"><div><p class="eyebrow">PAYOFF PLAN</p><h1>Debts</h1><p>Each loan or credit account appears once, with one current balance.</p></div><button class="button primary" data-action="add-debt">+ Add debt</button></section>
    ${focus ? `<article class="focus-hero panel"><div><p class="eyebrow">FOCUS DEBT</p><h2>${focus.name}</h2><p>Clearing this account can free <strong>${money(focus.monthly_plan)}</strong> each month.</p></div><div class="focus-number"><span>Balance left</span><strong>${money(focus.current_balance)}</strong>${monthsRemaining(focus.current_balance, focus.monthly_plan) ? `<small>About ${monthsRemaining(focus.current_balance, focus.monthly_plan)} months at current plan</small>` : ''}</div></article>` : ''}

    <section class="debt-card-grid">${active.length ? active.map((debt) => {
      const paid = debtPaymentTotal(debt.id, payments);
      const openingThisMonth = Number(debt.current_balance || 0) + paid;
      const original = Math.max(Number(debt.opening_balance || 0), openingThisMonth);
      const progress = original ? Math.max(0, Math.min(100, ((original - Number(debt.current_balance || 0)) / original) * 100)) : 100;
      return `<article class="debt-card panel">
        <div class="debt-card-top"><div><span class="debt-type">${debt.debt_type === 'loan' ? 'Loan' : 'Credit'}</span><h2>${debt.name}</h2></div><button class="text-button" data-action="edit-debt" data-id="${debt.id}">Edit</button></div>
        <div class="debt-balance"><span>Current balance</span><strong>${money(debt.current_balance)}</strong></div>
        <div class="debt-progress"><i style="width:${progress}%"></i></div>
        <div class="debt-stats"><div><span>Monthly plan</span><b>${money(debt.monthly_plan)}</b></div><div><span>Paid this month</span><b>${money(paid)}</b></div><div><span>After payments</span><b>${money(debt.current_balance)}</b></div>${debt.apr ? `<div><span>APR</span><b>${Number(debt.apr).toFixed(2)}%</b></div>` : ''}</div>
        <button class="button primary full" data-action="pay-debt" data-id="${debt.id}">Record debt payment</button>
      </article>`;
    }).join('') : '<article class="panel empty-state roomy">No active debt. Add one only if you have a real balance to track.</article>'}</section>

    ${completed.length ? `<article class="panel completed-debts"><div class="panel-head"><div><h2>Completed</h2><p>Debts you have finished.</p></div></div>${completed.map((d) => `<div class="simple-row"><div><b>${d.name}</b><span>${d.debt_type}</span></div><strong class="positive">Paid off</strong></div>`).join('')}</article>` : ''}`;
}
