import { debtPaymentTotal } from '../money-calculations.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function cards(debts, payments) {
  return debts.length ? debts.map((debt) => {
    const paid = debtPaymentTotal(debt.id, payments);
    const openingThisMonth = Number(debt.current_balance || 0) + paid;
    const target = Number(debt.monthly_plan || 0);
    const remainingTarget = Math.max(0, Math.min(target, openingThisMonth) - paid);
    const original = Math.max(Number(debt.opening_balance || 0), openingThisMonth);
    const progress = original ? Math.max(0, Math.min(100, ((original - Number(debt.current_balance || 0)) / original) * 100)) : 100;
    return `<article class="debt-card panel">
      <div class="debt-card-top"><div><span class="debt-type">${debt.debt_type === 'loan' ? 'Loan' : 'Credit'}</span><h2>${debt.name}</h2></div><button class="text-button" data-action="edit-debt" data-id="${debt.id}">Edit</button></div>
      <div class="debt-balance"><span>Remaining balance</span><strong>${money(debt.current_balance)}</strong></div>
      <div class="debt-progress"><i style="width:${progress}%"></i></div>
      <div class="debt-stats"><div><span>Opening this month</span><b>${money(openingThisMonth)}</b></div><div><span>Paid this month</span><b>${money(paid)}</b></div><div><span>Monthly target</span><b>${target > 0 ? money(target) : 'No fixed target'}</b></div>${target > 0 ? `<div><span>Target still left</span><b>${money(remainingTarget)}</b></div>` : ''}</div>
      <button class="button primary full" data-action="pay-debt" data-id="${debt.id}">Record ${debt.debt_type === 'loan' ? 'loan' : 'credit'} payment</button>
    </article>`;
  }).join('') : '<article class="panel empty-state roomy">No active accounts in this group.</article>';
}

export function renderDebts(bundle) {
  const { debts = [], payments = [] } = bundle;
  const active = debts.filter((d) => Number(d.current_balance || 0) > 0);
  const loans = active.filter((d) => d.debt_type === 'loan');
  const credits = active.filter((d) => d.debt_type === 'credit');
  const completed = debts.filter((d) => Number(d.current_balance || 0) <= 0);

  return `
    <section class="page-head"><div><p class="eyebrow">BALANCES YOU OWE</p><h1>Loans & Credits</h1><p>Pay any amount you choose. The remaining balance carries into the next month automatically.</p></div><button class="button primary" data-action="add-by-category">+ Add</button></section>

    <section class="liability-section"><div class="section-title"><div><p class="eyebrow">LOANS</p><h2>Agro, Council, Naseembe, Alikko, BML and other loans</h2></div><strong>${money(loans.reduce((s,d)=>s+Number(d.current_balance||0),0))}</strong></div><div class="debt-card-grid">${cards(loans, payments)}</div></section>

    <section class="liability-section"><div class="section-title"><div><p class="eyebrow">CREDITS</p><h2>White Saffron, Tsuhail and other credit balances</h2></div><strong>${money(credits.reduce((s,d)=>s+Number(d.current_balance||0),0))}</strong></div><div class="debt-card-grid">${cards(credits, payments)}</div></section>

    ${completed.length ? `<article class="panel completed-debts"><div class="panel-head"><div><h2>Completed</h2><p>Balances you have fully cleared.</p></div></div>${completed.map((d) => `<div class="simple-row"><div><b>${d.name}</b><span>${d.debt_type === 'loan' ? 'Loan' : 'Credit'}</span></div><strong class="positive">Paid off</strong></div>`).join('')}</article>` : ''}`;
}
