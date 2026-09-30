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
  const allDue = [
    ...model.expenses.filter(x => x.remaining > 0).map(x => ({ kind:'expense', id:x.id, name:x.name_snapshot, due:x.remaining, paid:x.paid, label:x.due_date ? `Due ${dateLabel(x.due_date)}` : 'Monthly expense' })),
    ...model.loans.filter(x => x.targetRemaining > 0).map(x => ({ kind:'debt', id:x.id, name:x.name, due:x.targetRemaining, paid:x.paidThisMonth, label:'Loan payment' })),
    ...model.credits.filter(x => x.targetRemaining > 0).map(x => ({ kind:'debt', id:x.id, name:x.name, due:x.targetRemaining, paid:x.paidThisMonth, label:'Credit payment' }))
  ].sort((a,b) => b.due-a.due);
  const completed = [
    ...model.expenses.filter(x => x.paid > 0 && x.remaining <= 0).map(x => ({name:x.name_snapshot, paid:x.paid})),
    ...model.loans.filter(x => x.paidThisMonth > 0 && x.targetRemaining <= 0).map(x => ({name:x.name, paid:x.paidThisMonth})),
    ...model.credits.filter(x => x.paidThisMonth > 0 && x.targetRemaining <= 0).map(x => ({name:x.name, paid:x.paidThisMonth}))
  ];
  const unplanned = [...model.loans, ...model.credits].filter(x => x.balanceLeft > 0 && x.target <= 0);
  const dueRows = allDue.length ? allDue.map((x,i)=>`<div class="action-payment-row">
    <div class="action-number">${String(i+1).padStart(2,'0')}</div>
    <div class="action-name"><b>${x.name}</b><span>${x.label}${x.paid>0 ? ` · ${money(x.paid)} already paid` : ''}</span></div>
    <div class="action-amount"><small>TO PAY</small><strong>${money(x.due)}</strong></div>
    <button class="button pay-action" data-action="${x.kind==='expense'?'pay-item':'pay-debt'}" data-id="${x.id}">Pay now</button>
  </div>`).join('') : '<div class="all-clear-state"><b>Nothing is waiting for payment.</b><span>Your currently planned payments are complete.</span></div>';

  return `
    <section class="paydesk-head">
      <div><p class="eyebrow">SEPTEMBER PAYMENT DESK</p><h1>What needs to be paid?</h1><p>One place for this month’s payments. Work from the list below.</p></div>
      <button class="button primary" data-action="add-by-category">+ Add payment</button>
    </section>

    <section class="paydesk-strip">
      <div class="paydesk-money"><small>AVAILABLE NOW</small><strong>${money(model.bankBalance)}</strong></div>
      <div class="paydesk-arrow">−</div>
      <div class="paydesk-money due"><small>TO PAY</small><strong>${money(model.stillToPay)}</strong></div>
      <div class="paydesk-arrow">=</div>
      <div class="paydesk-money left"><small>LEFT AFTER PLANS</small><strong>${money(model.expectedMonthEnd)}</strong></div>
    </section>

    <section class="paydesk-work">
      <div class="paydesk-main">
        <div class="work-title"><div><span class="work-kicker">ACTION LIST</span><h2>Pay now</h2></div><strong>${allDue.length} waiting</strong></div>
        <div class="action-payment-list">${dueRows}</div>
      </div>
      <aside class="paydesk-side">
        <section><span>MONTH PROGRESS</span><strong>${money(model.spentThisMonth)}</strong><p>paid so far</p><div class="progress-track"><i style="width:${Math.min(100, model.spentThisMonth/(model.spentThisMonth+model.stillToPay||1)*100)}%"></i></div></section>
        <section><span>TOTAL DEBT</span><strong>${money(model.loansLeft + model.creditsLeft)}</strong><p>${model.loans.length} loans · ${model.credits.length} credits</p></section>
        <button class="side-link" data-action="set-bank-balance">Set opening bank balance</button>
      </aside>
    </section>

    <section class="paydesk-lower">
      <details class="desk-fold" ${completed.length?'':'open'}><summary><b>Completed this month</b><span>${completed.length}</span></summary><div class="desk-fold-body">${completed.length ? completed.map(x=>`<div><span>✓ ${x.name}</span><strong>${money(x.paid)}</strong></div>`).join('') : '<p>No completed payments yet.</p>'}</div></details>
      <details class="desk-fold"><summary><b>Loans & credits with no monthly payment set</b><span>${unplanned.length}</span></summary><div class="desk-fold-body">${unplanned.length ? unplanned.map(x=>`<div><span>${x.name}</span><strong>${money(x.balanceLeft)}</strong><button class="text-button" data-action="edit-debt" data-id="${x.id}">Set plan</button></div>`).join('') : '<p>Every active debt has a plan.</p>'}</div></details>
      <details class="desk-fold"><summary><b>Manage all expenses, loans & credits</b><span>Open</span></summary><div class="desk-fold-body manage-fold">${expensePanel(model.expenses)}${liabilityCards('Loans',model.loans,'loan')}${liabilityCards('Credits',model.credits,'credit')}</div></details>
    </section>`;
}

