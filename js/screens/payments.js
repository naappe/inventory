import { itemPaymentTotal, paymentStatus } from '../money-calculations.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function renderPayments(bundle) {
  const { monthItems = [], payments = [] } = bundle;
  const rows = monthItems.map((item) => {
    const paid = itemPaymentTotal(item.id, payments);
    const planned = Number(item.planned_amount || 0);
    const remaining = Math.max(0, planned - paid);
    return { ...item, planned, paid, remaining, status: paymentStatus(planned, paid) };
  });
  const recent = payments.filter((p) => !p.reversed_at && p.payment_type === 'expense').slice(0, 12);

  return `
    <section class="page-head"><div><p class="eyebrow">MONTHLY EXPENSES</p><h1>Payments</h1><p>Home and other expenses only. Loans and credits are tracked separately in Debts.</p></div><button class="button primary" data-action="add-by-category">+ Add</button></section>
    <article class="panel table-panel">
      <div class="money-table-head"><span>Name</span><span>Planned</span><span>Paid</span><span>Remaining</span><span>Status</span><span></span></div>
      <div class="money-table">${rows.length ? rows.map((row) => `<div class="money-table-row">
        <div class="table-name"><b>${row.name_snapshot}</b><span>${row.category_snapshot}${row.due_date ? ` · due ${dateLabel(row.due_date)}` : ''}</span></div>
        <span>${money(row.planned)}</span><span>${money(row.paid)}</span><strong>${money(row.remaining)}</strong>
        <span><i class="status ${row.status.toLowerCase().replace(/\s+/g, '-')}">${row.status}</i></span>
        <span class="row-end payment-actions"><button class="text-button" data-action="edit-item" data-id="${row.item_id}">Edit</button><button class="text-button danger-text" data-action="delete-item" data-id="${row.item_id}" data-month-item-id="${row.id}" data-name="${row.name_snapshot}">Delete</button>${row.remaining > 0 ? `<button class="button compact" data-action="pay-item" data-id="${row.id}">Record payment</button>` : '<span class="paid-check">✓</span>'}</span>
      </div>`).join('') : '<div class="empty-state roomy">No Home or Other expenses in this month yet.</div>'}</div>
    </article>

    <article class="panel recent-panel">
      <div class="panel-head"><div><h2>Recent expense payments</h2><p>Recorded payments are corrected with Reverse, never silently deleted.</p></div></div>
      <div class="simple-list">${recent.length ? recent.map((p) => `<div class="simple-row"><div><b>Expense payment</b><span>${dateLabel(p.payment_date)}</span></div><div class="row-end"><strong>${money(p.amount)}</strong><button class="text-button danger-text" data-action="reverse-payment" data-id="${p.id}">Reverse</button></div></div>`).join('') : '<div class="empty-state">No expense payments recorded yet.</div>'}</div>
    </article>`;
}
