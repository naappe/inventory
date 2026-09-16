import { buildPaymentsPageModel } from '../payments-page-model.js';

const money = (n) => n == null ? 'Not entered' : `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function expenseTable(rows) {
  return `<article class="panel table-panel monthly-control-section">
    <div class="panel-head"><div><h2>Home & Other Expenses</h2><p>Monthly household and other spending.</p></div><button class="button secondary compact" data-action="add-by-category">+ Add expense</button></div>
    <div class="money-table-head"><span>Name</span><span>Planned</span><span>Paid</span><span>Remaining</span><span>Status</span><span></span></div>
    <div class="money-table">${rows.length ? rows.map((row) => `<div class="money-table-row">
      <div class="table-name"><b>${row.name_snapshot}</b><span>${row.category_snapshot}${row.due_date ? ` · due ${dateLabel(row.due_date)}` : ''}</span></div>
      <span>${money(row.planned)}</span><span>${money(row.paid)}</span><strong>${money(row.remaining)}</strong>
      <span><i class="status ${row.status.toLowerCase().replace(/\s+/g, '-')}">${row.status}</i></span>
      <span class="row-end payment-actions"><button class="text-button" data-action="edit-item" data-id="${row.item_id}">Edit</button><button class="text-button danger-text" data-action="delete-item" data-id="${row.item_id}" data-month-item-id="${row.id}" data-name="${row.name_snapshot}">Delete</button>${row.remaining > 0 ? `<button class="button compact" data-action="pay-item" data-id="${row.id}">Record payment</button>` : '<span class="paid-check">✓</span>'}</span>
    </div>`).join('') : '<div class="empty-state roomy">No Home or Other expenses in this month yet.</div>'}</div>
  </article>`;
}

function liabilityTable(title, rows, type) {
  const label = type === 'loan' ? 'loan' : 'credit';
  return `<article class="panel table-panel monthly-control-section liability-payment-section">
    <div class="panel-head"><div><h2>${title}</h2><p>Opening balance, this month’s payment, and balance still owed.</p></div><button class="button secondary compact" data-action="add-debt">+ Add ${label}</button></div>
    <div class="liability-table-head"><span>Account</span><span>Opening balance</span><span>Paid this month</span><span>Balance left</span><span>Monthly target</span><span></span></div>
    <div class="liability-table">${rows.length ? rows.map((row) => `<div class="liability-table-row">
      <div class="table-name"><b>${row.name}</b><span>${type === 'loan' ? 'Loan' : 'Credit'}${row.apr ? ` · ${Number(row.apr).toFixed(2)}% APR` : ''}</span></div>
      <span><small>Opening</small>${money(row.openingBalance)}</span>
      <span><small>Paid</small>${money(row.paidThisMonth)}</span>
      <strong><small>Left</small>${money(row.balanceLeft)}</strong>
      <span><small>Target</small>${money(row.target)}</span>
      <span class="row-end payment-actions"><button class="text-button" data-action="edit-debt" data-id="${row.id}">Edit</button>${row.balanceLeft > 0 ? `<button class="button compact" data-action="pay-debt" data-id="${row.id}">Pay ${label}</button>` : '<span class="paid-check">✓ Paid off</span>'}</span>
    </div>`).join('') : `<div class="empty-state roomy">No ${title.toLowerCase()} entered yet.</div>`}</div>
  </article>`;
}

export function renderPayments(bundle) {
  const model = buildPaymentsPageModel(bundle);

  return `
    <section class="page-head"><div><p class="eyebrow">MONTHLY MONEY CONTROL</p><h1>Payments</h1><p>See salary, bank balance, spending, home expenses, loans and credits together for this month.</p></div><button class="button primary" data-action="add-by-category">+ Add</button></section>

    <section class="payment-summary-grid">
      <article class="kpi-card tone-income"><span>Salary Got</span><strong>${money(model.salaryGot)}</strong><button class="text-button kpi-action" data-action="set-income">Edit salary</button></article>
      <article class="kpi-card tone-bank"><span>Bank Balance</span><strong>${money(model.bankBalance)}</strong><small>Manual actual balance</small><button class="text-button kpi-action" data-action="set-bank-balance">Update balance</button></article>
      <article class="kpi-card tone-paid"><span>Spent This Month</span><strong>${money(model.spentThisMonth)}</strong><small>Expenses + loan/credit payments + money lent</small></article>
      <article class="kpi-card tone-saving"><span>Salary Balance</span><strong>${money(model.salaryBalance)}</strong><small>Salary/cash in minus recorded spending</small></article>
      <article class="kpi-card tone-pending"><span>Still Left to Pay</span><strong>${money(model.stillToPay)}</strong><small>Remaining monthly plans and targets</small></article>
      <article class="kpi-card tone-debt"><span>Loans Left</span><strong>${money(model.loansLeft)}</strong><small>Outstanding loan balances</small></article>
      <article class="kpi-card tone-credit"><span>Credits Left</span><strong>${money(model.creditsLeft)}</strong><small>Outstanding credit balances</small></article>
    </section>

    ${expenseTable(model.expenses)}
    ${liabilityTable('Loans', model.loans, 'loan')}
    ${liabilityTable('Credits', model.credits, 'credit')}

    <article class="panel recent-panel monthly-control-section">
      <div class="panel-head"><div><h2>Recent Payments</h2><p>Expense, loan and credit payments. Corrections use Reverse so balances stay accurate.</p></div></div>
      <div class="simple-list">${model.recentPayments.length ? model.recentPayments.map((p) => `<div class="simple-row"><div><b>${p.payment_type === 'debt' ? 'Loan / Credit payment' : 'Expense payment'}</b><span>${dateLabel(p.payment_date)}</span></div><div class="row-end"><strong>${money(p.amount)}</strong><button class="text-button danger-text" data-action="reverse-payment" data-id="${p.id}">Reverse</button></div></div>`).join('') : '<div class="empty-state">No payments recorded yet.</div>'}</div>
    </article>`;
}
