const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderSettings({ user, categories = [], items = [] }) {
  return `
    <section class="page-head"><div><p class="eyebrow">PREFERENCES</p><h1>Settings</h1><p>Manage the reusable structure of your monthly plan.</p></div></section>
    <section class="settings-grid">
      <article class="panel">
        <div class="panel-head"><div><h2>Categories</h2><p>Used to organise payment items.</p></div><button class="button secondary compact" data-action="add-category">+ Add</button></div>
        <div class="chip-row settings-chips">${categories.map((c) => `<span class="chip">${c.name}</span>`).join('')}</div>
      </article>

      <article class="panel">
        <div class="panel-head"><div><h2>Recurring payment items</h2><p>These are copied into each new month.</p></div><button class="button secondary compact" data-action="add-item">+ Add</button></div>
        <div class="simple-list">${items.length ? items.map((item) => `<div class="simple-row"><div><b>${item.name}</b><span>${item.category?.name || 'Other'}${item.due_day ? ` · due day ${item.due_day}` : ''}</span></div><div class="row-end"><strong>${money(item.default_planned_amount)}</strong><button class="text-button" data-action="edit-item" data-id="${item.id}">Edit</button></div></div>`).join('') : '<div class="empty-state">No recurring items.</div>'}</div>
      </article>

      <article class="panel account-panel">
        <div><p class="eyebrow">ACCOUNT</p><h2>${user?.email || ''}</h2><p>Money Plan access is restricted to this Supabase account. Finance data is stored in Supabase, not browser localStorage.</p></div>
        <button class="button secondary" data-action="sign-out">Sign out</button>
      </article>
    </section>`;
}
