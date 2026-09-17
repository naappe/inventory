import { renderTrendLine } from '../money-charts.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const savedTime = (value) => value ? new Date(value).toLocaleString('en-US', { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' }) : '';

function historyDetails(row) {
  if (row.saveStatus !== 'Saved' && row.saveStatus !== 'Changes not saved') return '';
  return `<details class="history-snapshot-details"><summary>Saved details</summary><div class="simple-list"><div class="simple-row"><span>Spent</span><strong>${money(row.paid)}</strong></div><div class="simple-row"><span>Available / month-end</span><strong>${money(row.availableNow)}</strong></div><div class="simple-row"><span>Debt reduced</span><strong>${money(row.debtReduced)}</strong></div><div class="simple-row"><span>Loans remaining</span><strong>${money(row.loansRemaining)}</strong></div><div class="simple-row"><span>Credits remaining</span><strong>${money(row.creditsRemaining)}</strong></div><div class="simple-row"><span>Safe to save</span><strong>${money(row.safeToSave)}</strong></div><div class="simple-row"><span>Saved time</span><strong>${savedTime(row.savedAt)}</strong></div></div></details>`;
}

export function renderHistory({ rows = [], debtTrend = [], savingsTrend = [] }) {
  return `
    <section class="page-head"><div><p class="eyebrow">FROM SEPTEMBER 2026</p><h1>History</h1><p>Saved months keep their last confirmed snapshot even if you later make unsaved changes.</p></div></section>
    <section class="dashboard-grid charts-grid">
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Debt balance trend</h2><p>Total debt remaining at each month end.</p></div></div>${renderTrendLine(debtTrend, { label: 'Debt balance trend' })}</article>
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Potential savings trend</h2><p>Safe-to-save amount calculated after planned payments.</p></div></div>${renderTrendLine(savingsTrend, { label: 'Potential savings trend' })}</article>
    </section>
    <article class="panel history-table">
      <div class="panel-head"><div><h2>Monthly summary</h2><p>September 2026 is the first month.</p></div></div>
      <div class="money-table-head history-head"><span>Month</span><span>Income</span><span>Paid</span><span>Still to pay</span><span>Safe to save</span></div>
      <div class="money-table">${rows.length ? rows.slice().reverse().map((row) => `<div class="history-month-block"><div class="money-table-row history-row"><div class="table-name"><b>${row.label}${row.saveStatus === 'Saved' || row.saveStatus === 'Changes not saved' ? ' — Saved' : ''}</b><span>${row.paymentCount} payment${row.paymentCount === 1 ? '' : 's'}${row.isDirty ? ' · Current month has unsaved changes' : ''}</span></div><span>${money(row.income)}</span><span>${money(row.paid)}</span><span>${money(row.stillToPay)}</span><strong class="positive">${money(row.safeToSave)}</strong></div>${historyDetails(row)}</div>`).join('') : '<div class="empty-state roomy">No monthly history yet.</div>'}</div>
    </article>`;
}
