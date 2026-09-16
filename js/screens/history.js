import { renderTrendLine } from '../money-charts.js';

const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderHistory({ rows = [], debtTrend = [], savingsTrend = [] }) {
  return `
    <section class="page-head"><div><p class="eyebrow">FROM SEPTEMBER 2026</p><h1>History</h1><p>Past months remain unchanged when you edit future plans.</p></div></section>
    <section class="dashboard-grid charts-grid">
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Debt balance trend</h2><p>Total debt remaining at each month end.</p></div></div>${renderTrendLine(debtTrend, { label: 'Debt balance trend' })}</article>
      <article class="panel chart-panel"><div class="panel-head"><div><h2>Potential savings trend</h2><p>Safe-to-save amount calculated after planned payments.</p></div></div>${renderTrendLine(savingsTrend, { label: 'Potential savings trend' })}</article>
    </section>
    <article class="panel history-table">
      <div class="panel-head"><div><h2>Monthly summary</h2><p>September 2026 is the first month.</p></div></div>
      <div class="money-table-head history-head"><span>Month</span><span>Income</span><span>Paid</span><span>Still to pay</span><span>Safe to save</span></div>
      <div class="money-table">${rows.length ? rows.slice().reverse().map((row) => `<div class="money-table-row history-row"><div class="table-name"><b>${row.label}</b><span>${row.paymentCount} payment${row.paymentCount === 1 ? '' : 's'}</span></div><span>${money(row.income)}</span><span>${money(row.paid)}</span><span>${money(row.stillToPay)}</span><strong class="positive">${money(row.safeToSave)}</strong></div>`).join('') : '<div class="empty-state roomy">No monthly history yet.</div>'}</div>
    </article>`;
}
