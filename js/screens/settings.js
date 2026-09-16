const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const behaviorLabel = (b) => ({ liability: 'Loan / Credit', expense: 'Expense', receivable: 'Money Lent' }[b] || 'Expense');

export function renderSettings({ user, categories = [], items = [] }) {
  return `
    <section class="page-head"><div><p class="eyebrow">PREFERENCES</p><h1>Settings</h1><p>Categories now control the accounting logic.</p></div></section>
    <section class="settings-grid">
      <article class="panel">
        <div class="panel-head"><div><h2>Categories</h2><p>The behavior decides whether an entry is a liability, expense, or receivable.</p></div><button class="button secondary compact" data-action="add-category">+ Add</button></div>
        <div class="simple-list">${categories.map((c) => `<div class="simple-row"><div><b>${c.name}</b><span>${behaviorLabel(c.behavior_type)}</span></div><span class="status no-plan">${c.behavior_type}</span></div>`).join('')}</div>
      </article>

      <article class="panel">
        <div class="panel-head"><div><h2>Recurring expense items</h2><p>Only ordinary expenses repeat into new months.</p></div><button class="button secondary compact" data-action="add-by-category">+ Add</button></div>
        <div class="simple-list">${items.length ? items.map((item) => `<div class="simple-row"><div><b>${item.name}</b><span>${item.category?.name || 'Other'}${item.due_day ? ` · due day ${item.due_day}` : ''}</span></div><div class="row-end"><strong>${money(item.default_planned_amount)}</strong><button class="text-button" data-action="edit-item" data-id="${item.id}">Edit</button></div></div>`).join('') : '<div class="empty-state">No recurring expense items.</div>'}</div>
      </article>

      <article class="panel account-panel"><div><p class="eyebrow">ACCOUNT</p><h2>${user?.email || ''}</h2><p>Finance data is stored in Supabase and protected by account-level RLS.</p></div><button class="button secondary" data-action="sign-out">Sign out</button></article>
    </section>`;
}
