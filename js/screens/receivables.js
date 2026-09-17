const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date set';

export function renderReceivables(bundle) {
  const { receivables = [], receivableTransactions = [] } = bundle;
  const active = receivables.filter((r) => Number(r.current_balance || 0) > 0);
  const settled = receivables.filter((r) => Number(r.current_balance || 0) <= 0);
  const repaymentsFor = (id) => receivableTransactions
    .filter((t) => t.receivable_id === id && t.transaction_type === 'repayment' && !t.reversed_at)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return `
    <section class="page-head"><div><p class="eyebrow">MONEY LENT</p><h1>Money owed to me</h1><p>Track money you lend and every repayment without mixing it with your own debts.</p></div><button class="button primary" data-action="add-receivable">+ Lend money</button></section>
    <section class="receivable-grid">${active.length ? active.map((r) => `<article class="panel receivable-card">
      <div class="debt-card-top"><div><span class="debt-type">Receivable</span><h2>${r.name}</h2></div><div class="row-end"><strong>${money(r.current_balance)}</strong><button class="text-button" data-action="edit-receivable" data-id="${r.id}">Edit</button></div></div>
      <div class="debt-stats"><div><span>Originally lent</span><b>${money(r.opening_balance)}</b></div><div><span>Repaid this month</span><b>${money(repaymentsFor(r.id))}</b></div><div><span>Expected</span><b>${dateLabel(r.expected_repayment_date)}</b></div></div>
      ${r.remarks ? `<p class="receivable-note">${r.remarks}</p>` : ''}
      <button class="button primary full" data-action="repay-receivable" data-id="${r.id}">Record repayment</button>
    </article>`).join('') : '<article class="panel empty-state roomy">No money is currently owed to you.</article>'}</section>
    ${settled.length ? `<article class="panel completed-debts"><div class="panel-head"><div><h2>Settled</h2><p>Money fully repaid or closed.</p></div></div>${settled.map((r) => `<div class="simple-row"><div><b>${r.name}</b><span>Originally ${money(r.opening_balance)}</span></div><div class="row-end"><strong class="positive">Closed</strong><button class="text-button" data-action="edit-receivable" data-id="${r.id}">Edit</button></div></div>`).join('')}</article>` : ''}
    <article class="panel recent-panel"><div class="panel-head"><div><h2>Recent lent / repayment activity</h2><p>Corrections use reversal so the audit trail remains visible.</p></div></div><div class="simple-list">${receivableTransactions.filter((t)=>t.transaction_type !== 'reversal').length ? receivableTransactions.filter((t)=>t.transaction_type !== 'reversal').map((t)=>`<div class="simple-row"><div><b>${t.transaction_type === 'lend' ? 'Money lent' : 'Repayment received'}</b><span>${dateLabel(t.transaction_date)}${t.reversed_at ? ' · Reversed' : ''}</span></div><div class="row-end"><strong>${money(t.amount)}</strong>${!t.reversed_at ? `<button class="text-button danger-text" data-action="reverse-receivable-transaction" data-id="${t.id}">Reverse</button>` : ''}</div></div>`).join('') : '<div class="empty-state">No activity this month.</div>'}</div></article>`;
}
