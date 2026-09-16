const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderSetup({ month, categories = [], items = [], debts = [] }) {
  return `
    <section class="setup-shell">
      <div class="setup-intro">
        <p class="eyebrow">FRESH START · SEPTEMBER 2026</p>
        <h1>Set up your money plan</h1>
        <p>Old months and old paid history are not being imported. Enter the amounts you want to start with now.</p>
      </div>

      <div class="setup-grid">
        <article class="panel setup-step">
          <span class="step-number">1</span>
          <div><h2>Monthly income</h2><p>Set the money available for September.</p></div>
          <button class="button primary" data-action="set-income">${month?.income ? money(month.income) : 'Set income'}</button>
        </article>

        <article class="panel setup-step">
          <span class="step-number">2</span>
          <div><h2>Categories</h2><p>${categories.length} categories ready. Add more later from Settings.</p><div class="chip-row">${categories.map((c) => `<span class="chip">${c.name}</span>`).join('')}</div></div>
        </article>

        <article class="panel setup-step setup-wide">
          <span class="step-number">3</span>
          <div class="setup-content-grow"><h2>Monthly payment items</h2><p>Add the things you normally plan to pay each month.</p>
            <div class="setup-list">${items.length ? items.map((i) => `<div><b>${i.name}</b><span>${i.category?.name || 'Other'} · ${money(i.default_planned_amount)}</span></div>`).join('') : '<p class="muted">No payment items yet.</p>'}</div>
          </div>
          <button class="button secondary" data-action="add-item">+ Add payment item</button>
        </article>

        <article class="panel setup-step setup-wide">
          <span class="step-number">4</span>
          <div class="setup-content-grow"><h2>Loans & credit</h2><p>Enter only the real current balances. Each debt will appear once.</p>
            <div class="setup-list">${debts.length ? debts.map((d) => `<div><b>${d.name}</b><span>${d.debt_type === 'loan' ? 'Loan' : 'Credit'} · ${money(d.current_balance)} left</span></div>`).join('') : '<p class="muted">No debts added. You can skip this if you have none.</p>'}</div>
          </div>
          <button class="button secondary" data-action="add-debt">+ Add debt</button>
        </article>
      </div>

      <div class="setup-finish panel">
        <div><h2>Ready to start September?</h2><p>Your first payment will begin from MVR 0 paid.</p></div>
        <button class="button primary large" data-action="finish-setup" ${items.length || debts.length ? '' : 'disabled'}>Open my dashboard</button>
      </div>
    </section>`;
}
