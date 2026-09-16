import { itemPaymentTotal, debtPaymentTotal, paymentStatus } from '../money-calculations.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function renderPayments(bundle) {
  const { monthItems = [], payments = [], debts = [] } = bundle;
  const debtById = new Map(debts.map((debt) => [debt.id, debt]));
  const rows = monthItems.map((item) => {
    const linkedDebt = item.debt_id ? debtById.get(item.debt_id) : null;
    const paid = linkedDebt ? debtPaymentTotal(linkedDebt.id, payments) : itemPaymentTotal(item.id, payments);
    const planned = linkedDebt ? Number(linkedDebt.monthly_plan || item.planned_amount || 0) : Number(item.planned_amount || 0);
    const remaining = Math.max(0, planned - paid);
    const status = paymentStatus(planned, paid);
    return { ...item, linkedDebt, planned, paid, remaining, status };
  });
  const recent = payments.filter((p) => !p.reversed_at).slice(0, 12);

  return `
    <section class="page-head"><div><p class="eyebrow">SEPTEMBER PLAN</p><h1>Payments</h1><p>Plan, record and correct monthly payments without losing the audit trail.</p></div><button class="button primary" data-action="add-item">+ Add payment item</button></section>
    <article class="panel table-panel">
      <div class="money-table-head"><span>Name</span><span>Planned</span><span>Paid</span><span>Remaining</span><span>Status</span><span></span></div>
      <div class="money-table">${rows.length ? rows.map((row) => `<div class="money-table-row">
        <div class="table-name"><b>${row.name_snapshot}</b><span>${row.category_snapshot}${row.due_date ? ` · due ${dateLabel(row.due_date)}` : ''}${row.linkedDebt ? ` · Outstanding loan ${money(row.linkedDebt.current_balance)}` : ''}</span></div>
        <span>${money(row.planned)}</span><span>${money(row.paid)}</span><strong>${money(row.remaining)}</strong>
        <span><i class="status ${row.status.toLowerCase().replace(/\s+/g, '-')}">${row.status}</i></span>
        <span class="row-end"><button class="text-button" data-action="${row.linkedDebt ? 'edit-debt' : 'edit-item'}" data-id="${row.linkedDebt ? row.linkedDebt.id : row.item_id}">${row.linkedDebt ? 'Loan details' : 'Edit'}</button>${row.remaining > 0 ? `<button class="button compact" data-action="${row.linkedDebt ? 'pay-debt' : 'pay-item'}" data-id="${row.linkedDebt ? row.linkedDebt.id : row.id}">Record payment</button>` : '<span class="paid-check">✓</span>'}</span>
      </div>`).join('') : '<div class="empty-state roomy">No payment items yet. Add your first monthly payment item.</div>'}</div>
    </article>

    <article class="panel recent-panel">
      <div class="panel-head"><div><h2>Recent payments</h2><p>Corrections are reversed, not silently deleted.</p></div></div>
      <div class="simple-list">${recent.length ? recent.map((p) => `<div class="simple-row"><div><b>${p.payment_type === 'debt' ? 'Debt payment' : 'Monthly payment'}</b><span>${dateLabel(p.payment_date)}</span></div><div class="row-end"><strong>${money(p.amount)}</strong><button class="text-button danger-text" data-action="reverse-payment" data-id="${p.id}">Reverse</button></div></div>`).join('') : '<div class="empty-state">No payments recorded yet.</div>'}</div>
    </article>`;
}
