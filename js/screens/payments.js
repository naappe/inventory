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
  return `<article class="panel monthly-control-section liability-payment-section">
    <div class="panel-head"><div><h2>${title}</h2><p>Opening balance − paid this month = balance left.</p></div><button class="button secondary compact" data-action="add-debt">+ Add ${label}</button></div>
    <div class="liability-card-grid">${rows.length ? rows.map((row) => `<div class="liability-card">
      <div class="liability-card-head"><div><b>${row.name}</b><span>${type === 'loan' ? 'Loan' : 'Credit'}${row.apr ? ` · ${Number(row.apr).toFixed(2)}% APR` : ''}</span></div><button class="text-button" data-action="edit-debt" data-id="${row.id}">Edit</button></div>
      <div class="liability-math"><div><small>Opening</small><strong>${money(row.openingBalance)}</strong></div><i>−</i><div><small>Paid this month</small><strong>${money(row.paidThisMonth)}</strong></div><i>=</i><div class="liability-left"><small>Balance left</small><strong>${money(row.balanceLeft)}</strong></div></div>
      ${row.target > 0 ? `<div class="target-note">Monthly target ${money(row.target)} · ${money(row.targetRemaining)} still targeted</div>` : ''}
      <div class="liability-actions">${undoButton(row, row.name)}${row.balanceLeft > 0 ? `<button class="button compact" data-action="pay-debt" data-id="${row.id}">${row.paidThisMonth > 0 ? `Pay ${label} again` : `Pay ${label}`}</button>` : '<span class="paid-check">✓ Paid off</span>'}</div>
    </div>`).join('') : `<div class="empty-state roomy">No ${title.toLowerCase()} entered yet.</div>`}</div>
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

  return `
    <section class="page-head"><div><p class="eyebrow">MONTHLY MONEY CONTROL</p><h1>Payments</h1><p>Your salary is counted as money entering the bank. Recorded payments reduce the bank automatically.</p></div><button class="button primary" data-action="add-by-category">+ Add</button></section>

    <section class="bank-hero">
      <div><span>AVAILABLE IN BANK</span><strong>${money(model.bankBalance)}</strong><p>Opening ${money(model.openingBankBalance)} + salary ${money(model.salaryGot)} − spent ${money(model.spentThisMonth)}</p></div>
      <button class="button secondary compact" data-action="set-bank-balance">Set opening bank balance</button>
    </section>

    <section class="payment-summary-grid dashboard-click-grid">
      ${kpiCard({ tone: 'tone-income', label: 'Salary Received', value: money(model.salaryGot), hint: 'Added to your bank this month', detail: `<div class="detail-equation"><span>Salary deposited</span><strong>+ ${money(model.salaryGot)}</strong></div>`, action: '<button class="text-button kpi-action" data-action="set-income">Edit salary</button>' })}
      ${kpiCard({ tone: 'tone-paid', label: 'Spent This Month', value: money(model.spentThisMonth), hint: 'Actual recorded money out', detail: `<div class="detail-equation"><span>Expenses + loan/credit payments + money lent</span><strong>− ${money(model.spentThisMonth)}</strong></div>` })}
      ${kpiCard({ tone: 'tone-pending', label: 'Still To Pay', value: money(model.stillToPay), hint: 'Planned payments not completed yet', detail: `<div class="detail-equation"><span>Reserve this amount for upcoming plans</span><strong>${money(model.stillToPay)}</strong></div>` })}
      ${kpiCard({ tone: 'tone-saving', label: 'Expected Month-End', value: money(model.expectedMonthEnd), hint: 'Bank after everything still planned', detail: `<div class="detail-equation"><span>${money(model.bankBalance)} bank − ${money(model.stillToPay)} still due</span><strong>${money(model.expectedMonthEnd)}</strong></div>` })}
      ${kpiCard({ tone: 'tone-debt', label: 'Loans Remaining', value: money(model.loansLeft), hint: `${model.loans.length} loan account${model.loans.length === 1 ? '' : 's'}`, detail: model.loans.length ? model.loans.map((loan) => `<div class="detail-row"><span>${loan.name}</span><strong>${money(loan.balanceLeft)}</strong></div>`).join('') : '<p>No loans.</p>' })}
      ${kpiCard({ tone: 'tone-credit', label: 'Credits Remaining', value: money(model.creditsLeft), hint: `${model.credits.length} credit account${model.credits.length === 1 ? '' : 's'}`, detail: model.credits.length ? model.credits.map((credit) => `<div class="detail-row"><span>${credit.name}</span><strong>${money(credit.balanceLeft)}</strong></div>`).join('') : '<p>No credits.</p>' })}
    </section>

    ${tipsPanel(model)}
    ${expensePanel(model.expenses)}
    ${liabilityCards('Loans', model.loans, 'loan')}
    ${liabilityCards('Credits', model.credits, 'credit')}

    <article class="panel recent-panel monthly-control-section">
      <div class="panel-head"><div><h2>Recent Payments</h2><p>Your latest recorded money-out activity.</p></div></div>
      <div class="simple-list">${model.recentPayments.length ? model.recentPayments.map((p) => `<div class="simple-row"><div><b>${p.payment_type === 'debt' ? 'Loan / Credit payment' : 'Expense payment'}</b><span>${dateLabel(p.payment_date)}</span></div><div class="row-end"><strong>${money(p.amount)}</strong><button class="text-button danger-text" data-action="reverse-payment" data-id="${p.id}">Reverse</button></div></div>`).join('') : '<div class="empty-state">No payments recorded yet.</div>'}</div>
    </article>`;
}
