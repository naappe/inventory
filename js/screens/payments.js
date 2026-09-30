import { buildPaymentsPageModel } from '../payments-page-model.js';

const money = (n) => n == null ? 'Not entered' : `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const undoButton = (row, name) => row.canUndoPayment
  ? `<button class="button secondary compact" data-action="undo-row-payments" data-payment-ids="${row.activePaymentIds.join(',')}" data-name="${name}">Undo</button>`
  : '';

function kpiCard({ tone, label, value, hint, detail, action = '' }) {
  return `<details class="kpi-card clickable-kpi ${tone}">
    <summary><span>${label}</span><strong>${value}</strong><small>${hint}</small><em>View details</em></summary>
    <div class="kpi-detail">${detail}${action}</div>
  </details>`;
}

function groupedSpendingRows(bundle, expectedTotal) {
  const payments = (bundle.payments || []).filter((p) => !p.reversed_at);
  const items = new Map((bundle.monthItems || []).map((x) => [x.id, x]));
  const debts = new Map((bundle.debts || []).map((x) => [x.id, x]));
  const receivables = new Map((bundle.receivables || []).map((x) => [x.id, x]));
  const groups = new Map();

  const add = (group, label, amount, date = '') => {
    const value = Number(amount || 0);
    if (value <= 0) return;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ label, amount: value, date });
  };

  payments.forEach((p) => {
    if (p.payment_type === 'expense') {
      const item = items.get(p.month_item_id);
      add('Expenses', item?.name_snapshot || 'Expense', p.amount, p.payment_date);
    } else if (p.payment_type === 'debt') {
      const debt = debts.get(p.debt_id);
      const group = debt?.debt_type === 'credit' ? 'Credit payments' : 'Loan payments';
      add(group, debt?.name || (group === 'Credit payments' ? 'Credit payment' : 'Loan payment'), p.amount, p.payment_date);
    }
  });

  (bundle.receivableTransactions || [])
    .filter((t) => t.transaction_type === 'lend' && !t.reversed_at)
    .forEach((t) => add('Money lent', receivables.get(t.receivable_id)?.name || 'Money lent', t.amount, t.transaction_date));

  const detailedTotal = [...groups.values()].flat().reduce((sum, row) => sum + row.amount, 0);
  const residual = Math.max(0, Number(expectedTotal || 0) - detailedTotal);
  if (residual > 0.005) add('Other', 'Other recorded money out', residual);

  if (!groups.size) return '<p>No spending has been recorded yet.</p>';

  return [...groups.entries()].map(([group, rows]) => {
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return `<div class="spending-detail-group"><div class="detail-row spending-group-head"><span>${group}</span><strong>${money(total)}</strong></div>${rows.map((row) => `<div class="detail-row spending-line"><span>${row.label}${row.date ? `<small>${dateLabel(row.date)}</small>` : ''}</span><strong>− ${money(row.amount)}</strong></div>`).join('')}</div>`;
  }).join('') + `<div class="detail-equation spending-total"><span>Total spent this month</span><strong>− ${money(expectedTotal)}</strong></div>`;
}

function paymentName(bundle, payment) {
  if (payment.payment_type === 'expense') return (bundle.monthItems || []).find((x) => x.id === payment.month_item_id)?.name_snapshot || 'Expense payment';
  if (payment.payment_type === 'debt') return (bundle.debts || []).find((x) => x.id === payment.debt_id)?.name || 'Loan / Credit payment';
  return 'Payment';
}

function expenseRow(row) {
  return `<div class="expense-line ${row.remaining <= 0 ? 'is-paid' : 'is-unpaid'}">
    <div class="expense-main"><b>${row.name_snapshot}</b><span>${row.due_date ? `Due ${dateLabel(row.due_date)}` : 'No due date'}</span></div>
    <div class="expense-money"><small>Planned</small><strong>${money(row.planned)}</strong></div>
    <div class="expense-money"><small>Paid</small><strong>${money(row.paid)}</strong></div>
    <div class="expense-money remaining"><small>Remaining</small><strong>${money(row.remaining)}</strong></div>
    <div class="expense-status"><i class="status ${row.status.toLowerCase().replace(/\s+/g, '-')}">${row.status}</i></div>
    <div class="expense-actions"><button class="text-button" data-action="edit-item" data-id="${row.item_id}">Edit</button><button class="text-button danger-text" data-action="delete-item" data-id="${row.item_id}" data-month-item-id="${row.id}" data-name="${row.name_snapshot}">Delete</button>${undoButton(row, row.name_snapshot)}${row.remaining > 0 ? `<button class="button compact" data-action="pay-item" data-id="${row.id}">${row.paid > 0 ? 'Pay more' : 'Pay'}</button>` : '<span class="paid-check">✓ Paid</span>'}</div>
  </div>`;
}

function expenseCategories(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.category_snapshot || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  if (!groups.size) return '<div class="empty-state roomy">No monthly expenses yet.</div>';

  return [...groups.entries()].map(([category, categoryRows]) => {
    const unpaid = categoryRows.filter((row) => row.remaining > 0).sort((a, b) => b.remaining - a.remaining);
    const paid = categoryRows.filter((row) => row.remaining <= 0);
    const planned = categoryRows.reduce((sum, row) => sum + row.planned, 0);
    const paidTotal = categoryRows.reduce((sum, row) => sum + row.paid, 0);
    const remaining = categoryRows.reduce((sum, row) => sum + row.remaining, 0);

    return `<section class="expense-category">
      <div class="category-head"><div><h3>${category}</h3><p>${money(paidTotal)} paid · ${money(remaining)} remaining</p></div><strong>${money(planned)}</strong></div>
      ${unpaid.length ? `<div class="expense-subhead"><span>Need to pay</span><b>${unpaid.length}</b></div>${unpaid.map(expenseRow).join('')}` : '<div class="category-complete">✓ Everything in this category is paid</div>'}
      ${paid.length ? `<details class="paid-group"><summary>Paid this month <span>${paid.length}</span></summary><div>${paid.map(expenseRow).join('')}</div></details>` : ''}
    </section>`;
  }).join('');
}

function expensePanel(rows) {
  return `<article class="panel monthly-control-section organized-expenses">
    <div class="panel-head"><div><h2>Monthly Expenses</h2><p>Kept in your categories. Unpaid items stay visible; paid items are folded underneath.</p></div><button class="button secondary compact" data-action="add-by-category">+ Add expense</button></div>
    <div class="expense-category-list">${expenseCategories(rows)}</div>
  </article>`;
}

function liabilityCards(title, rows, type) {
  const label = type === 'loan' ? 'loan' : 'credit';
  const totalBalance = rows.reduce((sum, row) => sum + Number(row.balanceLeft || 0), 0);
  const totalPaid = rows.reduce((sum, row) => sum + Number(row.paidThisMonth || 0), 0);
  const plannedRemaining = rows.reduce((sum, row) => sum + Number(row.targetRemaining || 0), 0);
  const needAction = rows.filter((row) => row.balanceLeft > 0 && row.targetRemaining > 0);
  const noPlan = rows.filter((row) => row.balanceLeft > 0 && Number(row.target || 0) <= 0);
  const paidRows = rows.filter((row) => Number(row.paidThisMonth || 0) > 0);

  const card = (row) => {
    const paid = Number(row.paidThisMonth || 0);
    const target = Number(row.target || 0);
    const due = Number(row.targetRemaining || 0);
    const state = row.balanceLeft <= 0 ? 'paid-off' : due > 0 ? 'needs-payment' : paid > 0 ? 'paid-month' : 'no-plan';
    const badge = row.balanceLeft <= 0 ? 'PAID OFF' : due > 0 ? 'PAY THIS MONTH' : paid > 0 ? 'PAID THIS MONTH' : 'NO PAYMENT PLANNED';
    return `<div class="liability-card payment-focus-card ${state}">
      <div class="liability-card-head"><div><b>${row.name}</b><span>${type === 'loan' ? 'Loan' : 'Credit'}${row.apr ? ` · ${Number(row.apr).toFixed(2)}% APR` : ''}</span></div><span class="payment-state-badge">${badge}</span></div>
      <div class="focus-balance"><small>BALANCE LEFT</small><strong>${money(row.balanceLeft)}</strong></div>
      <div class="payment-facts">
        <div><small>Opening</small><strong>${money(row.openingBalance)}</strong></div>
        <div><small>Paid this month</small><strong>${money(paid)}</strong></div>
        <div><small>${target > 0 ? 'Still planned' : 'Monthly target'}</small><strong>${target > 0 ? money(due) : 'Not set'}</strong></div>
      </div>
      <div class="liability-actions primary-actions">
        ${row.balanceLeft > 0 ? `<button class="button compact pay-now" data-action="pay-debt" data-id="${row.id}">${paid > 0 ? `Pay ${label} again` : `Pay ${label}`}</button>` : '<span class="paid-check">✓ Paid off</span>'}
        ${undoButton(row, row.name)}
        <button class="text-button" data-action="edit-debt" data-id="${row.id}">Edit</button>
      </div>
    </div>`;
  };

  return `<article class="panel monthly-control-section liability-payment-section clearer-liabilities">
    <div class="panel-head"><div><h2>${title}</h2><p>See what needs payment first. Paid accounts stay clearly marked.</p></div><button class="button secondary compact" data-action="add-debt">+ Add ${label}</button></div>
    <div class="liability-summary-strip">
      <div><small>Total balance</small><strong>${money(totalBalance)}</strong></div>
      <div><small>Paid this month</small><strong>${money(totalPaid)}</strong></div>
      <div class="${plannedRemaining > 0 ? 'attention' : ''}"><small>Still planned to pay</small><strong>${money(plannedRemaining)}</strong></div>
      <div><small>Accounts needing payment</small><strong>${needAction.length}</strong></div>
    </div>
    ${needAction.length ? `<div class="payment-priority"><span>PAY NEXT</span><strong>${needAction.map(r => r.name).join(' · ')}</strong><small>${money(plannedRemaining)} still planned this month</small></div>` : ''}
    <div class="liability-card-grid priority-grid">${rows.length ? [...needAction, ...noPlan.filter(r=>!needAction.includes(r)), ...paidRows.filter(r=>!needAction.includes(r)&&!noPlan.includes(r)), ...rows.filter(r=>r.balanceLeft<=0)].filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i).map(card).join('') : `<div class="empty-state roomy">No ${title.toLowerCase()} entered yet.</div>`}</div>
  </article>`;
}

function tipsPanel(model) {
  return `<article class="panel money-tips-panel monthly-control-section">
    <div class="panel-head"><div><p class="eyebrow">SMART CHECK</p><h2>Money Tips</h2><p>Based on this month’s actual numbers.</p></div><div class="safe-spend"><small>Safe to spend after planned payments</small><strong>${money(model.safeToSpend)}</strong></div></div>
    <div class="tips-grid">${model.tips.map((tip) => `<div class="tip-card"><b>${tip.title}</b><p>${tip.text}</p></div>`).join('')}</div>
  </article>`;
}

export function renderPayments(bundle) {
  const model = buildPaymentsPageModel(bundle);
  const due = [
    ...model.expenses.filter(x=>x.remaining>0).map(x=>({kind:'expense',id:x.id,name:x.name_snapshot,type:'Expense',amount:x.remaining})),
    ...model.loans.filter(x=>x.targetRemaining>0).map(x=>({kind:'debt',id:x.id,name:x.name,type:'Loan',amount:x.targetRemaining})),
    ...model.credits.filter(x=>x.targetRemaining>0).map(x=>({kind:'debt',id:x.id,name:x.name,type:'Credit',amount:x.targetRemaining}))
  ].sort((a,b)=>b.amount-a.amount);
  const completed=(model.recentPayments || []).map(p=>({id:p.id,name:paymentName(bundle,p),amount:Number(p.amount||0),date:p.payment_date||''}));
  const noPlan=[...model.loans,...model.credits].filter(x=>x.balanceLeft>0&&x.target<=0);
  const dueRows=due.length?due.map(x=>`<tr><td><b>${x.name}</b><small>${x.type}</small></td><td class="amount-cell">${money(x.amount)}</td><td class="row-actions"><button class="text-button edit-row" data-action="${x.kind==='expense'?'edit-item':'edit-debt'}" data-id="${x.id}">Edit</button><button class="button compact" data-action="${x.kind==='expense'?'pay-item':'pay-debt'}" data-id="${x.id}">Pay</button></td></tr>`).join(''):'<tr><td colspan="3" class="empty-cell">No payments waiting.</td></tr>';
  const noPlanRows=noPlan.map(x=>`<tr><td><b>${x.name}</b><small>${x.debt_type==='credit'?'Credit':'Loan'}</small></td><td class="amount-cell">${money(x.balanceLeft)}</td><td class="row-actions"><button class="text-button edit-row" data-action="edit-debt" data-id="${x.id}">Edit / Set plan</button></td></tr>`).join('');
  return `
  <section class="standard-payments">
    <header class="standard-page-head"><div><h1>Payments</h1><p>September 2026 · Manage this month’s bills and debt payments.</p></div><div class="page-head-actions"><button class="button secondary compact" data-action="add-by-category">+ Add</button><button class="button primary compact save-month-button" data-action="save-month">Save September</button></div></header>
    <section class="standard-summary">
      <div><span>Available</span><strong>${money(model.bankBalance)}</strong></div>
      <div><span>Still to pay</span><strong>${money(model.stillToPay)}</strong></div>
      <div><span>After payments</span><strong>${money(model.expectedMonthEnd)}</strong></div>
      <div><span>Paid this month</span><strong>${money(model.spentThisMonth)}</strong></div>
    </section>
    <div class="standard-layout">
      <main class="standard-main">
        <section class="standard-panel">
          <div class="standard-panel-head"><div><h2>To pay</h2><p>Only items requiring action this month.</p></div><span class="count-pill">${due.length}</span></div>
          <table class="payment-table"><thead><tr><th>Payment</th><th>Amount</th><th></th></tr></thead><tbody>${dueRows}</tbody></table>
        </section>
        ${noPlan.length?`<section class="standard-panel compact-panel"><div class="standard-panel-head"><div><h2>No monthly plan</h2><p>These debts are not included in “Still to pay”.</p></div><span class="count-pill neutral">${noPlan.length}</span></div><table class="payment-table"><tbody>${noPlanRows}</tbody></table></section>`:''}
        <details class="standard-panel manage-details"><summary><div><b>Manage payment setup</b><span>Edit expenses, loans and credits</span></div><span>Open</span></summary><div class="manage-tabs">
          <button class="button secondary compact" data-action="add-by-category">+ Expense</button><button class="button secondary compact" data-action="add-debt">+ Loan / Credit</button>
          <div class="manage-summary"><span>Loans ${money(model.loansLeft)}</span><span>Credits ${money(model.creditsLeft)}</span></div>
        </div></details>
      </main>
      <aside class="standard-side">
        <details class="standard-panel status-details"><summary><div><h3>Month status</h3><small>Click for details</small></div><span>Details</span></summary><div class="status-detail-body"><div class="status-group"><b>Waiting <em>${due.length}</em></b>${due.length?due.map(x=>`<p><span>${x.name}<small>${x.kind==='expense'?'Expense':x.kind==='loan'?'Loan':'Credit'}</small></span><strong>${money(x.remaining)}</strong></p>`).join(''):'<p class="status-empty">Nothing waiting</p>'}</div><div class="status-group"><b>Completed <em>${completed.length}</em></b>${completed.length?completed.map(x=>`<p><span>${x.name}<small>${x.date?dateLabel(x.date):'Paid'}</small></span><strong>${money(x.amount)}</strong></p>`).join(''):'<p class="status-empty">No completed payments</p>'}</div><div class="status-group"><b>No plan <em>${noPlan.length}</em></b>${noPlan.length?noPlan.map(x=>`<p><span>${x.name}<small>${x.kind==='loan'?'Loan':'Credit'}</small></span><strong>${money(x.balanceLeft)}</strong></p>`).join(''):'<p class="status-empty">All debts have a plan</p>'}</div></div></details>
        <details class="standard-panel debt-details" open><summary><div><h3>Debt balance</h3><strong>${money(model.loansLeft+model.creditsLeft)}</strong><small>${model.loans.length} loans · ${model.credits.length} credits</small></div><span>Details</span></summary><div class="debt-detail-list"><div class="debt-detail-head"><span>Account</span><span>Balance</span></div>${[...model.loans,...model.credits].sort((a,b)=>b.balanceLeft-a.balanceLeft).map(x=>`<div class="debt-detail-row"><span><b>${x.name}</b><small>${x.debt_type==='credit'?'Credit':'Loan'}${x.target>0?` · plan ${money(x.target)}`:' · no monthly plan'}</small></span><strong>${money(x.balanceLeft)}</strong></div>`).join('')}<div class="debt-detail-total"><span>Total debt</span><strong>${money(model.loansLeft+model.creditsLeft)}</strong></div></div></details><button class="text-button bank-balance-link" data-action="set-bank-balance">Set opening bank balance</button>
        ${completed.length?`<details class="standard-panel completed-fold" open><summary>Paid / Undo <span>${completed.length}</span></summary><div>${completed.map(x=>`<p><span>✓ ${x.name}${x.date?`<small>${dateLabel(x.date)}</small>`:''}</span><b>${money(x.amount)}</b><button class="text-button undo-row" data-action="reverse-payment" data-id="${x.id}">Undo</button></p>`).join('')}</div></details>`:''}
      </aside>
    </div>
  </section>`;
}

