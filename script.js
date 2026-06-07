// ============================================
// STOCKFLOW ERP - COMPLETE WORKING SYSTEM
// ============================================

// Data Storage
let items = [];
let transactions = [];
let currentView = "dashboard";
let darkMode = false;
let searchTerm = "";

// MASTER PIN
const MASTER_PIN = "1234";

// ============================================
// SAMPLE DATA
// ============================================

function loadSampleData() {
  const savedItems = localStorage.getItem('stockflow_items');
  if (savedItems && JSON.parse(savedItems).length > 0) {
    items = JSON.parse(savedItems);
    transactions = JSON.parse(localStorage.getItem('stockflow_transactions') || '[]');
    return;
  }
  
  items = [
    { id: "1", name: "Basmati Rice", quantity: 50, unit: "KG", cost: 2.5, expiryDate: "2025-12-31", minStock: 10 },
    { id: "2", name: "Olive Oil", quantity: 25, unit: "L", cost: 8.99, expiryDate: "2025-06-15", minStock: 5 },
    { id: "3", name: "Coffee Beans", quantity: 12, unit: "KG", cost: 15.5, expiryDate: "2024-12-01", minStock: 3 },
    { id: "4", name: "Tomato Sauce", quantity: 8, unit: "BOX", cost: 12.0, expiryDate: "2024-10-10", minStock: 8 },
    { id: "5", name: "Pasta", quantity: 45, unit: "PCS", cost: 1.2, expiryDate: "2025-09-20", minStock: 15 },
    { id: "6", name: "Chicken Breast", quantity: 35, unit: "KG", cost: 8.5, expiryDate: "2025-05-30", minStock: 10 },
    { id: "7", name: "Cheddar Cheese", quantity: 18, unit: "KG", cost: 6.75, expiryDate: "2025-04-15", minStock: 5 }
  ];
  
  transactions = [
    { id: "t1", type: "STOCK_IN", itemId: "1", itemName: "Basmati Rice", quantity: 50, unit: "KG", cost: 2.5, timestamp: new Date().toISOString(), note: "Initial stock" }
  ];
  
  saveData();
}

// ============================================
// CSV LOADING
// ============================================

async function loadCSVFromFile() {
  try {
    const response = await fetch('data.csv', { cache: 'no-store' });
    if (response.ok) {
      const csvText = await response.text();
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          for (const row of results.data) {
            const name = row.Name || row.name || row.item_name;
            if (!name) continue;
            
            const existingItem = items.find(i => i.name.toLowerCase() === name.toLowerCase());
            if (!existingItem) {
              items.push({
                id: "item_" + Date.now() + "_" + Math.random(),
                name: name,
                quantity: 0,
                unit: (row.Unit || row.unit || "PCS").toUpperCase(),
                cost: parseFloat(row.Price || row.price || row.Cost || row.cost || 0),
                expiryDate: row.ExpiryDate || row.expiry_date || "",
                minStock: parseInt(row.MinStock || row.minStock || 5)
              });
            }
          }
          saveData();
          renderCurrentView();
          showToast('CSV loaded successfully', 'success');
        }
      });
      return true;
    }
  } catch (error) {
    console.log("No CSV found");
  }
  return false;
}

// ============================================
// STOCK MANAGEMENT
// ============================================

function addStock(itemId, quantity, unit, cost, expiryDate, note) {
  const item = items.find(i => i.id === itemId);
  if (!item) return false;
  
  item.quantity = item.quantity + quantity;
  if (cost && cost > 0) item.cost = cost;
  if (expiryDate) item.expiryDate = expiryDate;
  
  const transaction = {
    id: Date.now().toString(),
    type: "STOCK_IN",
    itemId: item.id,
    itemName: item.name,
    quantity: quantity,
    unit: unit,
    cost: cost || item.cost,
    timestamp: new Date().toISOString(),
    note: note || ''
  };
  
  transactions.unshift(transaction);
  saveData();
  renderCurrentView();
  showToast(`✅ Added +${quantity} ${unit} of ${item.name}`, 'success');
  return true;
}

function removeStock(itemId, quantity, reason, note) {
  const item = items.find(i => i.id === itemId);
  if (!item) return false;
  
  if (quantity > item.quantity) {
    showToast(`Insufficient stock! Only ${item.quantity} ${item.unit} available`, 'error');
    return false;
  }
  
  item.quantity = item.quantity - quantity;
  
  const transaction = {
    id: Date.now().toString(),
    type: "KITCHEN_OUT",
    itemId: item.id,
    itemName: item.name,
    quantity: quantity,
    unit: item.unit,
    cost: item.cost,
    timestamp: new Date().toISOString(),
    note: note || '',
    reason: reason
  };
  
  transactions.unshift(transaction);
  saveData();
  renderCurrentView();
  showToast(`🍳 Used ${quantity} ${item.unit} of ${item.name}`, 'success');
  return true;
}

function getStockStatus(item) {
  if (item.quantity <= 0) return { class: 'status-expired', text: 'Out of Stock', icon: '❌' };
  if (item.quantity < item.minStock) return { class: 'status-low', text: 'Low Stock', icon: '⚠️' };
  return { class: 'status-ok', text: 'In Stock', icon: '✅' };
}

function verifyPIN(actionName, callback) {
  const pin = prompt(`🔒 ${actionName} requires PIN:\n\nEnter Master PIN:`);
  if (pin === MASTER_PIN) {
    callback();
  } else if (pin !== null) {
    showToast("❌ Incorrect PIN!", 'error');
  }
}

function filterItems() {
  if (!searchTerm) return items;
  return items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
}

function saveData() {
  localStorage.setItem('stockflow_items', JSON.stringify(items));
  localStorage.setItem('stockflow_transactions', JSON.stringify(transactions));
}

function loadData() {
  const savedItems = localStorage.getItem('stockflow_items');
  const savedTransactions = localStorage.getItem('stockflow_transactions');
  if (savedItems) items = JSON.parse(savedItems);
  if (savedTransactions) transactions = JSON.parse(savedTransactions);
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

function performSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchTerm = searchInput.value;
    renderCurrentView();
  }
}

function clearSearch() {
  searchTerm = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  renderCurrentView();
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderDashboard() {
  const filtered = filterItems();
  const totalStock = filtered.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = filtered.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
  const lowStockCount = filtered.filter(i => i.quantity < i.minStock).length;
  
  const html = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-header"><span>Total Items</span><div class="stat-icon"><i class="fas fa-box"></i></div></div><div class="stat-value">${filtered.length}</div><div class="stat-label">Products</div></div>
      <div class="stat-card"><div class="stat-header"><span>Total Stock</span><div class="stat-icon"><i class="fas fa-warehouse"></i></div></div><div class="stat-value">${totalStock}</div><div class="stat-label">Units</div></div>
      <div class="stat-card"><div class="stat-header"><span>Total Value</span><div class="stat-icon"><i class="fas fa-dollar-sign"></i></div></div><div class="stat-value">$${totalValue.toLocaleString()}</div><div class="stat-label">Inventory Value</div></div>
      <div class="stat-card"><div class="stat-header"><span>Low Stock</span><div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div></div><div class="stat-value" style="color:${lowStockCount>0?'#f59e0b':'#10b981'}">${lowStockCount}</div><div class="stat-label">Alerts</div></div>
    </div>
    
    <div class="search-section"><div class="search-wrapper"><i class="fas fa-search"></i><input type="text" id="searchInput" class="search-input" placeholder="Search items..." value="${searchTerm}" onkeyup="performSearch()">${searchTerm ? '<button class="clear-search" onclick="clearSearch()">✕</button>' : ''}</div></div>
    
    <div class="section-header"><h2>📦 Recent Items</h2><button class="btn btn-primary" onclick="switchView('inventory')">View All</button></div>
    <div class="cards-grid">
      ${filtered.slice(0,6).map(item => {
        const status = getStockStatus(item);
        return `<div class="inventory-card"><div class="card-header"><span class="item-name">${escapeHtml(item.name)}</span><span class="item-price">$${item.cost}</span></div><div class="card-details"><span>Stock: <strong>${item.quantity}</strong> ${item.unit}</span><span>Expiry: ${item.expiryDate || 'N/A'}</span></div><div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div><div class="card-actions" style="display:flex;gap:0.5rem;margin-top:0.75rem;"><button class="btn btn-success" style="flex:1;" onclick="openStockInModal('${item.id}')">+ Add Stock</button>${item.quantity > 0 ? `<button class="btn btn-warning" style="flex:1;" onclick="openStockOutModal('${item.id}')">🍳 Kitchen Use</button>` : `<button class="btn btn-secondary" style="flex:1;" disabled>Out of Stock</button>`}</div></div>`;
      }).join('')}
      ${filtered.length === 0 ? '<div class="empty-state">No items found</div>' : ''}
    </div>
    
    <div class="section-header"><h2>📋 Recent Activity</h2><button class="btn btn-primary" onclick="switchView('ledger')">View All</button></div>
    <div class="table-container"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Qty</th><th>Unit</th><th>Reference</th></tr></thead><tbody>
      ${transactions.slice(0,10).map(t => `<tr><td>${new Date(t.timestamp).toLocaleString()}</td><td><span class="badge ${t.type === 'STOCK_IN' ? 'badge-in' : 'badge-out'}">${t.type === 'STOCK_IN' ? 'IN' : 'OUT'}</span></td><td>${escapeHtml(t.itemName)}</td><td>${t.quantity}</td><td>${t.unit}</td><td>${escapeHtml(t.note || '-')}</td></tr>`).join('')}
      ${transactions.length === 0 ? '<tr><td colspan="6" class="text-center">No transactions</td></tr>' : ''}
    </tbody></table></div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
}

function renderInventory() {
  const filtered = filterItems();
  const html = `
    <div class="section-header"><h2>📦 All Inventory</h2><div><button class="btn btn-success" onclick="openStockInModal()">+ Add Stock (PIN)</button><button class="btn btn-secondary" onclick="exportInventoryToCSV()">📥 Export</button></div></div>
    <div class="search-section"><div class="search-wrapper"><i class="fas fa-search"></i><input type="text" id="searchInput" class="search-input" placeholder="Search items..." value="${searchTerm}" onkeyup="performSearch()">${searchTerm ? '<button class="clear-search" onclick="clearSearch()">✕</button>' : ''}</div></div>
    <div class="cards-grid">
      ${filtered.map(item => {
        const status = getStockStatus(item);
        return `<div class="inventory-card"><div class="card-header"><div><span class="item-name">${escapeHtml(item.name)}</span><div style="font-size:0.7rem;color:var(--gray);">${item.unit} | Min: ${item.minStock}</div></div><div><span class="item-price">$${item.cost}</span><div style="font-size:0.7rem;">per unit</div></div></div><div style="background:var(--bg-light);padding:0.75rem;border-radius:12px;margin:0.75rem 0;"><div style="display:flex;justify-content:space-between;"><span>Current Stock</span><span style="font-size:1.5rem;font-weight:700;">${item.quantity}</span></div><div style="display:flex;justify-content:space-between;margin-top:0.5rem;"><span>Expiry: ${item.expiryDate || 'N/A'}</span><span>Value: $${(item.quantity * item.cost).toFixed(2)}</span></div></div><div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div><div class="card-actions" style="display:flex;gap:0.5rem;margin-top:0.75rem;"><button class="btn btn-success" style="flex:1;" onclick="openStockInModal('${item.id}')">+ Add Stock</button>${item.quantity > 0 ? `<button class="btn btn-warning" style="flex:1;" onclick="openStockOutModal('${item.id}')">🍳 Kitchen Use</button>` : `<button class="btn btn-secondary" style="flex:1;" disabled>Out of Stock</button>`}</div></div>`;
      }).join('')}
      ${filtered.length === 0 ? '<div class="empty-state">No items found</div>' : ''}
    </div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
}

function renderStockOut() {
  const filtered = filterItems();
  const html = `
    <div class="section-header"><h2>🍳 Kitchen Use</h2><p style="font-size:0.8rem;color:var(--gray);">No PIN required</p></div>
    <div class="search-section"><div class="search-wrapper"><i class="fas fa-search"></i><input type="text" id="searchInput" class="search-input" placeholder="Search items..." value="${searchTerm}" onkeyup="performSearch()">${searchTerm ? '<button class="clear-search" onclick="clearSearch()">✕</button>' : ''}</div></div>
    <div class="cards-grid">
      ${filtered.map(item => {
        const status = getStockStatus(item);
        return `<div class="inventory-card"><div class="card-header"><span class="item-name">${escapeHtml(item.name)}</span><span class="item-price">Stock: ${item.quantity} ${item.unit}</span></div><div class="card-details"><span>Cost: $${item.cost}</span><span>Expiry: ${item.expiryDate || 'N/A'}</span></div><div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div>${item.quantity > 0 ? `<button class="btn btn-warning" style="margin-top:0.75rem;width:100%;" onclick="openStockOutModal('${item.id}')">🍳 Use in Kitchen</button>` : `<button class="btn btn-secondary" style="margin-top:0.75rem;width:100%;" disabled>❌ Out of Stock</button>`}</div>`;
      }).join('')}
      ${filtered.length === 0 ? '<div class="empty-state">No items found</div>' : ''}
    </div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
}

function renderLedger() {
  const html = `
    <div class="section-header"><h2>📋 Transaction Ledger</h2><button class="btn btn-secondary" onclick="exportTransactionsToCSV()">📥 Export CSV (PIN)</button></div>
    <div class="table-container"><table class="data-table"><thead><tr><th>Date & Time</th><th>Type</th><th>Item</th><th>Quantity</th><th>Unit</th><th>Value</th><th>Reference</th></tr></thead><tbody>
      ${transactions.map(t => `<tr><td>${new Date(t.timestamp).toLocaleString()}</td><td><span class="badge ${t.type === 'STOCK_IN' ? 'badge-in' : 'badge-out'}">${t.type === 'STOCK_IN' ? '📥 IN' : '🍳 OUT'}</span></td><td><strong>${escapeHtml(t.itemName)}</strong></td><td>${t.quantity}</td><td>${t.unit}</td><td>$${(t.quantity * (t.cost || 0)).toFixed(2)}</td><td>${escapeHtml(t.note || '-')}</td></tr>`).join('')}
      ${transactions.length === 0 ? '<tr><td colspan="7" class="text-center">No transactions</td></tr>' : ''}
    </tbody></table></div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
}

function renderSettings() {
  const html = `
    <div class="section-header"><h2>⚙️ Settings</h2></div>
    <div class="table-container" style="margin-bottom:1rem;"><div style="padding:1.5rem;"><h3>🔒 PIN Protection</h3><p>Master PIN: <strong>${MASTER_PIN}</strong><br>Protected: Add Stock, Export Data</p></div></div>
    <div class="table-container" style="margin-bottom:1rem;"><div style="padding:1.5rem;"><h3>🎨 Theme</h3><div style="display:flex;gap:1rem;"><button class="btn ${!darkMode ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTheme(false)">☀️ Light</button><button class="btn ${darkMode ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTheme(true)">🌙 Dark</button></div></div></div>
    <div class="table-container"><div style="padding:1.5rem;"><h3>🗑️ Danger Zone</h3><button class="btn btn-danger" onclick="resetData()">Reset All Data</button><p style="font-size:0.7rem;margin-top:0.5rem;">Deletes all inventory and transactions</p></div></div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openStockInModal(presetItemId = null) {
  verifyPIN("Add Stock", () => {
    const select = document.getElementById('stockInItem');
    select.innerHTML = '<option value="">-- Select Item --</option>' + items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Current: ${i.quantity} ${i.unit})</option>`).join('');
    document.getElementById('stockInQty').value = '';
    document.getElementById('stockInUnit').value = '';
    document.getElementById('stockInCost').value = '';
    document.getElementById('stockInExpiry').value = '';
    document.getElementById('stockInNote').value = '';
    document.getElementById('stockInModal').classList.remove('hidden');
  });
}

function closeStockInModal() {
  document.getElementById('stockInModal').classList.add('hidden');
}

function processStockIn() {
  const itemId = document.getElementById('stockInItem').value;
  const quantity = parseFloat(document.getElementById('stockInQty').value);
  const unit = document.getElementById('stockInUnit').value;
  const cost = parseFloat(document.getElementById('stockInCost').value);
  const expiryDate = document.getElementById('stockInExpiry').value;
  const note = document.getElementById('stockInNote').value;
  
  if (!itemId || !quantity || quantity <= 0) { showToast('Please select item and valid quantity', 'error'); return; }
  addStock(itemId, quantity, unit, cost, expiryDate, note);
  closeStockInModal();
}

function openStockOutModal(presetItemId = null) {
  const select = document.getElementById('stockOutItem');
  select.innerHTML = '<option value="">-- Select Item --</option>' + items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Available: ${i.quantity} ${i.unit})</option>`).join('');
  document.getElementById('stockOutQty').value = '';
  document.getElementById('stockOutReason').value = 'Kitchen Preparation';
  document.getElementById('stockOutNote').value = '';
  updateStockOutInfo();
  document.getElementById('stockOutModal').classList.remove('hidden');
}

function closeStockOutModal() {
  document.getElementById('stockOutModal').classList.add('hidden');
}

function updateStockOutInfo() {
  const itemId = document.getElementById('stockOutItem').value;
  const infoDiv = document.getElementById('currentStockInfo');
  if (itemId && infoDiv) {
    const item = items.find(i => i.id === itemId);
    if (item) infoDiv.innerHTML = `Current Stock: ${item.quantity} ${item.unit} available`;
  }
}

function processStockOut() {
  const itemId = document.getElementById('stockOutItem').value;
  const quantity = parseFloat(document.getElementById('stockOutQty').value);
  const reason = document.getElementById('stockOutReason').value;
  const note = document.getElementById('stockOutNote').value;
  
  if (!itemId || !quantity || quantity <= 0) { showToast('Please select item and valid quantity', 'error'); return; }
  removeStock(itemId, quantity, reason, note);
  closeStockOutModal();
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function exportInventoryToCSV() {
  verifyPIN("Export Inventory", () => {
    let csv = "Name,Stock,Unit,Cost,Total Value,Expiry Date,Min Stock\n";
    items.forEach(i => csv += `"${i.name}",${i.quantity},${i.unit},${i.cost},${(i.quantity*i.cost).toFixed(2)},${i.expiryDate || 'N/A'},${i.minStock}\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Inventory exported', 'success');
  });
}

function exportTransactionsToCSV() {
  verifyPIN("Export Transactions", () => {
    let csv = "Date,Type,Item,Quantity,Unit,Value,Reference\n";
    transactions.forEach(t => csv += `"${new Date(t.timestamp).toLocaleString()}",${t.type === 'STOCK_IN' ? 'IN' : 'OUT'},"${t.itemName}",${t.quantity},${t.unit},${(t.quantity*(t.cost||0)).toFixed(2)},"${t.note || ''}"\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Transactions exported', 'success');
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function resetData() {
  if (confirm('⚠️ Delete ALL data? This cannot be undone!')) {
    localStorage.clear();
    location.reload();
  }
}

function toggleTheme(isDark) {
  darkMode = isDark;
  document.body.classList.toggle('dark', darkMode);
  localStorage.setItem('darkMode', darkMode);
}

function loadTheme() {
  darkMode = localStorage.getItem('darkMode') === 'true';
  document.body.classList.toggle('dark', darkMode);
}

function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.background = type === 'success' ? '#10b981' : '#ef4444';
  toast.style.color = 'white';
  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function updateDateTime() {
  const now = new Date();
  const el = document.getElementById('currentDateTime');
  if (el) el.innerHTML = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
}

function switchView(view) {
  currentView = view;
  const titles = { dashboard: 'Dashboard', inventory: 'Inventory', stockout: 'Kitchen Use', ledger: 'Ledger', settings: 'Settings' };
  document.getElementById('pageTitle').innerText = titles[view] || 'Dashboard';
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.nav === view) btn.classList.add('active');
  });
  renderCurrentView();
}

function renderCurrentView() {
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'inventory') renderInventory();
  else if (currentView === 'stockout') renderStockOut();
  else if (currentView === 'ledger') renderLedger();
  else if (currentView === 'settings') renderSettings();
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  loadData();
  loadTheme();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  if (items.length === 0) {
    loadSampleData();
    await loadCSVFromFile();
  }
  
  renderCurrentView();
  
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.nav));
  });
  
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', () => toggleTheme(!darkMode));
}

// Global exports
window.openStockInModal = openStockInModal;
window.closeStockInModal = closeStockInModal;
window.processStockIn = processStockIn;
window.openStockOutModal = openStockOutModal;
window.closeStockOutModal = closeStockOutModal;
window.processStockOut = processStockOut;
window.updateStockOutInfo = updateStockOutInfo;
window.switchView = switchView;
window.toggleTheme = toggleTheme;
window.resetData = resetData;
window.exportInventoryToCSV = exportInventoryToCSV;
window.exportTransactionsToCSV = exportTransactionsToCSV;
window.performSearch = performSearch;
window.clearSearch = clearSearch;

init();
