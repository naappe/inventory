// ============================================
// STOCKFLOW ERP SYSTEM - WITH CSV RELOAD
// Auto-loads CSV on page load + manual reload button
// ============================================

// Data Storage
let items = [
  { id: "1", name: "Premium Rice", quantity: 150, unit: "KG", cost: 2.5, expiryDate: "2025-12-31", minStock: 50 },
  { id: "2", name: "Olive Oil", quantity: 45, unit: "L", cost: 8.99, expiryDate: "2025-06-15", minStock: 20 },
  { id: "3", name: "Coffee Beans", quantity: 12, unit: "KG", cost: 15.5, expiryDate: "2024-12-01", minStock: 15 },
  { id: "4", name: "Tomato Sauce", quantity: 8, unit: "BOX", cost: 12.0, expiryDate: "2024-10-10", minStock: 10 },
  { id: "5", name: "Pasta", quantity: 200, unit: "PCS", cost: 1.2, expiryDate: "2025-09-20", minStock: 50 },
  { id: "6", name: "Chicken Breast", quantity: 35, unit: "KG", cost: 8.5, expiryDate: "2025-05-30", minStock: 20 },
  { id: "7", name: "Cheese", quantity: 18, unit: "KG", cost: 6.75, expiryDate: "2025-04-15", minStock: 10 }
];

let transactions = [
  { id: "t1", type: "IN", itemId: "1", itemName: "Premium Rice", quantity: 50, unit: "KG", cost: 2.5, timestamp: new Date().toISOString(), note: "Initial stock" },
  { id: "t2", type: "OUT", itemId: "3", itemName: "Coffee Beans", quantity: 5, unit: "KG", reason: "Sold", timestamp: new Date(Date.now() - 86400000).toISOString(), note: "Customer order" }
];

let currentView = "dashboard";
let darkMode = false;

// ============================================
// CSV FUNCTIONS - WITH RELOAD
// ============================================

async function loadCSVFromFile() {
  try {
    const paths = ['data.csv', './data.csv'];
    let csvText = null;
    
    for (const path of paths) {
      try {
        const response = await fetch(path, { cache: 'no-store' }); // no-store prevents caching
        if (response.ok) {
          csvText = await response.text();
          console.log(`CSV loaded from: ${path}`);
          break;
        }
      } catch (e) { continue; }
    }
    
    if (csvText && csvText.trim().length > 0) {
      parseCSVData(csvText);
      return true;
    }
    return false;
  } catch (error) {
    console.error("CSV Error:", error);
    return false;
  }
}

function parseCSVData(csvText) {
  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      let newItems = [];
      let updatedCount = 0;
      let newCount = 0;
      
      for (const row of results.data) {
        const name = row.Name || row.name || row.item_name;
        const unit = (row.Unit || row.unit || "PCS").toUpperCase();
        const cost = parseFloat(row.Price || row.price || row.Cost || row.cost || 0);
        const quantity = parseFloat(row.Stock || row.stock || row.Quantity || row.quantity || 0);
        const expiryDate = row.ExpiryDate || row.expiry_date || row.Expiry || "";
        
        if (!name) continue;
        
        const existingItem = items.find(i => i.name.toLowerCase() === name.toLowerCase());
        
        if (existingItem) {
          // Update existing item
          existingItem.cost = cost || existingItem.cost;
          existingItem.unit = unit || existingItem.unit;
          existingItem.quantity = quantity;
          if (expiryDate) existingItem.expiryDate = expiryDate;
          updatedCount++;
          newItems.push(existingItem);
        } else {
          // Add new item
          const newId = "item_" + Date.now() + "_" + Math.random();
          const newItem = {
            id: newId,
            name: name,
            quantity: quantity,
            unit: unit,
            cost: cost,
            expiryDate: expiryDate,
            minStock: 5
          };
          items.push(newItem);
          newItems.push(newItem);
          newCount++;
        }
      }
      
      // Remove items not in CSV (optional - comment out to keep existing items)
      // items = newItems;
      
      saveData();
      renderCurrentView();
      showToast(`CSV Updated: ${updatedCount} items updated, ${newCount} new items added`, 'success');
    }
  });
}

// Manual reload function - call this when you want to reload CSV
async function reloadCSV() {
  showToast('Reloading CSV data...', 'info');
  const success = await loadCSVFromFile();
  if (!success) {
    showToast('No data.csv file found', 'error');
  }
}

// Auto-load on page load
async function autoLoadCSV() {
  await loadCSVFromFile();
}

// ============================================
// INVENTORY FUNCTIONS - SIMPLE
// ============================================

function updateStock(itemId, quantity, type, cost, reason, note, expiryDate) {
  const item = items.find(i => i.id === itemId);
  if (!item) return false;
  
  if (type === 'OUT' && quantity > item.quantity) {
    showToast(`Insufficient stock! Only ${item.quantity} ${item.unit} available`, 'error');
    return false;
  }
  
  // Simple stock update
  if (type === 'IN') {
    item.quantity = item.quantity + quantity;
    if (cost) item.cost = cost;
    if (expiryDate) item.expiryDate = expiryDate;
  } else {
    item.quantity = item.quantity - quantity;
  }
  
  // Record transaction
  const transaction = {
    id: Date.now().toString(),
    type,
    itemId: item.id,
    itemName: item.name,
    quantity: quantity,
    unit: item.unit,
    cost: type === 'IN' ? cost : item.cost,
    timestamp: new Date().toISOString(),
    note: note || '',
    reason: reason || null
  };
  
  transactions.unshift(transaction);
  saveData();
  renderCurrentView();
  showToast(`${type === 'IN' ? 'Stock IN' : 'Stock OUT'} successful! New quantity: ${item.quantity} ${item.unit}`, 'success');
  return true;
}

function getStockStatus(item) {
  if (item.quantity <= 0) return { class: 'status-expired', text: 'Out of Stock' };
  return { class: 'status-ok', text: 'In Stock' };
}

// ============================================
// UI RENDERING
// ============================================

function renderDashboard() {
  const totalItems = items.length;
  const totalStock = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
  const recentTransactions = transactions.slice(0, 10);
  
  const html = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <span>Total Items</span>
          <div class="stat-icon"><i class="fas fa-box"></i></div>
        </div>
        <div class="stat-value">${totalItems}</div>
        <div class="stat-label">Products in System</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>Total Stock</span>
          <div class="stat-icon"><i class="fas fa-warehouse"></i></div>
        </div>
        <div class="stat-value">${totalStock}</div>
        <div class="stat-label">Total Units</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>Total Value</span>
          <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
        </div>
        <div class="stat-value">$${totalValue.toLocaleString()}</div>
        <div class="stat-label">Inventory Value</div>
      </div>
    </div>
    
    <div class="section-header">
      <h2><i class="fas fa-boxes"></i> Recent Items</h2>
      <button class="btn btn-primary" onclick="switchView('inventory')">View All</button>
    </div>
    
    <div class="cards-grid">
      ${items.slice(0, 6).map(item => `
        <div class="inventory-card">
          <div class="card-header">
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-price">$${item.cost}</span>
          </div>
          <div class="card-details">
            <span>Quantity: ${item.quantity} ${item.unit}</span>
            <span>Expiry: ${item.expiryDate || 'N/A'}</span>
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
            <button class="btn btn-success" style="flex:1; padding: 0.4rem;" onclick="openStockInModal('${item.id}')">+ IN</button>
            <button class="btn btn-danger" style="flex:1; padding: 0.4rem;" onclick="openStockOutModal('${item.id}')">- OUT</button>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="section-header">
      <h2><i class="fas fa-history"></i> Recent Transactions</h2>
      <button class="btn btn-primary" onclick="switchView('ledger')">View All</button>
    </div>
    
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr><th>Date & Time</th><th>Type</th><th>Item</th><th>Quantity</th><th>Unit</th><th>Value</th><th>Reference</th></tr>
        </thead>
        <tbody>
          ${recentTransactions.map(t => `
            <tr>
              <td>${new Date(t.timestamp).toLocaleString()}</td
              <td><span class="badge ${t.type === 'IN' ? 'badge-in' : 'badge-out'}">${t.type}</span></td
              <td>${escapeHtml(t.itemName)}</td
              <td>${t.quantity}</td
              <td>${t.unit}</td
              <td>$${(t.quantity * (t.cost || 0)).toFixed(2)}</td
              <td>${escapeHtml(t.note || t.reason || '-')}</td
            </tr>
          `).join('')}
          ${recentTransactions.length === 0 ? '<tr><td colspan="7" class="text-center">No transactions yet</td</tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

function renderInventory() {
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-boxes"></i> All Inventory Items</h2>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" onclick="reloadCSV()" title="Reload from data.csv">
          <i class="fas fa-sync-alt"></i> Reload CSV
        </button>
        <button class="btn btn-primary" onclick="openStockInModal()">
          <i class="fas fa-plus"></i> Add Stock
        </button>
      </div>
    </div>
    
    <div class="cards-grid">
      ${items.map(item => `
        <div class="inventory-card">
          <div class="card-header">
            <div>
              <span class="item-name">${escapeHtml(item.name)}</span>
              <div style="font-size: 0.7rem; color: var(--gray); margin-top: 0.2rem;">Unit: ${item.unit}</div>
            </div>
            <div style="text-align: right;">
              <span class="item-price">$${item.cost}</span>
              <div style="font-size: 0.7rem; color: var(--gray);">per unit</div>
            </div>
          </div>
          
          <div style="background: var(--bg-light); padding: 0.75rem; border-radius: 12px; margin: 0.75rem 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-size: 0.7rem; color: var(--gray);">Current Quantity</span>
              <span style="font-size: 1.5rem; font-weight: 700;">${item.quantity}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
              <span>Expiry: ${item.expiryDate || 'N/A'}</span>
              <span>Total Value: $${(item.quantity * item.cost).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="card-actions" style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
            <button class="btn btn-success" style="flex:1;" onclick="openStockInModal('${item.id}')">
              <i class="fas fa-arrow-down"></i> Stock IN
            </button>
            <button class="btn btn-danger" style="flex:1;" onclick="openStockOutModal('${item.id}')">
              <i class="fas fa-arrow-up"></i> Stock OUT
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

function renderStockIn() {
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-arrow-down"></i> Stock IN - Receive Products</h2>
      <button class="btn btn-secondary" onclick="reloadCSV()">
        <i class="fas fa-sync-alt"></i> Refresh Items
      </button>
    </div>
    <div class="cards-grid">
      ${items.map(item => `
        <div class="inventory-card">
          <div class="card-header">
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-price">Current: ${item.quantity} ${item.unit}</span>
          </div>
          <div class="card-details">
            <span>Cost: $${item.cost}</span>
            <span>Expiry: ${item.expiryDate || 'N/A'}</span>
          </div>
          <button class="btn btn-primary" style="margin-top: 0.75rem; width: 100%;" onclick="openStockInModal('${item.id}')">
            <i class="fas fa-arrow-down"></i> Add Stock to ${escapeHtml(item.name)}
          </button>
        </div>
      `).join('')}
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

function renderStockOut() {
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-arrow-up"></i> Stock OUT - Remove Products</h2>
      <button class="btn btn-secondary" onclick="reloadCSV()">
        <i class="fas fa-sync-alt"></i> Refresh Items
      </button>
    </div>
    <div class="cards-grid">
      ${items.map(item => `
        <div class="inventory-card">
          <div class="card-header">
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-price">Stock: ${item.quantity} ${item.unit}</span>
          </div>
          <div class="card-details">
            <span>Cost: $${item.cost}</span>
            <span>Expiry: ${item.expiryDate || 'N/A'}</span>
          </div>
          <button class="btn btn-danger" style="margin-top: 0.75rem; width: 100%;" onclick="openStockOutModal('${item.id}')" ${item.quantity <= 0 ? 'disabled' : ''}>
            <i class="fas fa-arrow-up"></i> Remove Stock from ${escapeHtml(item.name)}
          </button>
        </div>
      `).join('')}
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

function renderLedger() {
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-history"></i> Transaction Ledger</h2>
      <div style="display: flex; gap: 0.5rem;">
        <span style="font-size: 0.7rem; color: var(--gray);">Total: ${transactions.length} transactions</span>
        <button class="btn btn-secondary" onclick="reloadCSV()">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
    </div>
    
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Type</th>
            <th>Item Name</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Value</th>
            <th>Reference / Note</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(t => `
            <tr>
              <td>${new Date(t.timestamp).toLocaleString()}</td
              <td><span class="badge ${t.type === 'IN' ? 'badge-in' : 'badge-out'}">${t.type}</span></td
              <td><strong>${escapeHtml(t.itemName)}</strong></td
              <td>${t.quantity}</td
              <td>${t.unit}</td
              <td>$${(t.quantity * (t.cost || 0)).toFixed(2)}</td
              <td>${escapeHtml(t.note || t.reason || '-')}</td
            </tr>
          `).join('')}
          ${transactions.length === 0 ? '<tr><td colspan="7" class="text-center">No transactions recorded yet</td</tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

function renderSettings() {
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-cog"></i> System Settings</h2>
    </div>
    
    <div class="table-container" style="margin-bottom: 1.5rem;">
      <div style="padding: 1.5rem;">
        <h3>CSV Data Management</h3>
        <p style="font-size: 0.8rem; color: var(--gray); margin: 0.5rem 0;">
          Reload data from data.csv file in the same folder. Updates existing items and adds new ones.
        </p>
        <button class="btn btn-primary" onclick="reloadCSV()">
          <i class="fas fa-sync-alt"></i> Reload CSV Now
        </button>
      </div>
    </div>
    
    <div class="table-container" style="margin-bottom: 1.5rem;">
      <div style="padding: 1.5rem;">
        <h3>Theme Preferences</h3>
        <div class="form-group" style="margin-top: 1rem;">
          <label>Display Mode</label>
          <div style="display: flex; gap: 1rem;">
            <button class="btn ${!darkMode ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTheme(false)">
              <i class="fas fa-sun"></i> Light Mode
            </button>
            <button class="btn ${darkMode ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTheme(true)">
              <i class="fas fa-moon"></i> Dark Mode
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="table-container">
      <div style="padding: 1.5rem;">
        <h3>Data Management</h3>
        <p style="font-size: 0.8rem; color: var(--gray); margin: 0.5rem 0;">Reset all inventory items and transaction history to default values.</p>
        <button class="btn btn-danger" onclick="resetData()">
          <i class="fas fa-trash"></i> Reset All Data
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openStockInModal(presetItemId = null) {
  const select = document.getElementById('stockInItem');
  select.innerHTML = '<option value="">-- Select Product --</option>' + 
    items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Current: ${i.quantity} ${i.unit})</option>`).join('');
  
  document.getElementById('stockInQty').value = '';
  document.getElementById('stockInUnit').value = '';
  document.getElementById('stockInCost').value = '';
  document.getElementById('stockInExpiry').value = '';
  document.getElementById('stockInNote').value = '';
  
  document.getElementById('stockInModal').classList.remove('hidden');
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
  
  if (!itemId) { showToast('Please select an item', 'error'); return; }
  if (!quantity || quantity <= 0) { showToast('Please enter valid quantity', 'error'); return; }
  
  updateStock(itemId, quantity, 'IN', cost, null, note, expiryDate);
  closeStockInModal();
}

function openStockOutModal(presetItemId = null) {
  const select = document.getElementById('stockOutItem');
  select.innerHTML = '<option value="">-- Select Product --</option>' + 
    items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Available: ${i.quantity} ${i.unit})</option>`).join('');
  
  document.getElementById('stockOutQty').value = '';
  document.getElementById('stockOutReason').value = 'Sold';
  document.getElementById('stockOutNote').value = '';
  updateStockOutInfo();
  
  document.getElementById('stockOutModal').classList.remove('hidden');
}

function closeStockOutModal() {
  document.getElementById('stockOutModal').classList.add('hidden');
}

function updateStockOutInfo() {
  const itemId = document.getElementById('stockOutItem').value;
  if (itemId) {
    const item = items.find(i => i.id === itemId);
    if (item) {
      document.getElementById('currentStockInfo').innerHTML = `Current Stock: ${item.quantity} ${item.unit} available`;
      document.getElementById('currentStockInfo').style.display = 'block';
    }
  } else {
    document.getElementById('currentStockInfo').style.display = 'none';
  }
}

function processStockOut() {
  const itemId = document.getElementById('stockOutItem').value;
  const quantity = parseFloat(document.getElementById('stockOutQty').value);
  const reason = document.getElementById('stockOutReason').value;
  const note = document.getElementById('stockOutNote').value;
  
  if (!itemId) { showToast('Please select an item', 'error'); return; }
  if (!quantity || quantity <= 0) { showToast('Please enter valid quantity', 'error'); return; }
  
  updateStock(itemId, quantity, 'OUT', null, reason, note);
  closeStockOutModal();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

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

function resetData() {
  if (confirm('⚠️ WARNING: This will delete ALL data and restore default inventory.\n\nThis action cannot be undone. Are you sure?')) {
    localStorage.clear();
    location.reload();
  }
}

function toggleTheme(isDark) {
  darkMode = isDark;
  if (darkMode) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
  localStorage.setItem('darkMode', darkMode);
}

function loadTheme() {
  const savedTheme = localStorage.getItem('darkMode');
  if (savedTheme === 'true') {
    darkMode = true;
    document.body.classList.add('dark');
  }
}

function showToast(message, type) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  let bgColor = '#10b981';
  if (type === 'error') bgColor = '#ef4444';
  if (type === 'info') bgColor = '#3b82f6';
  
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    font-size: 0.85rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function updateDateTime() {
  const now = new Date();
  const dateTimeEl = document.getElementById('currentDateTime');
  if (dateTimeEl) {
    dateTimeEl.innerHTML = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
  }
}

function switchView(view) {
  currentView = view;
  const titles = {
    dashboard: { title: 'Dashboard', subtitle: 'Real-time inventory tracking and management' },
    inventory: { title: 'Inventory', subtitle: 'Complete product catalog with stock levels' },
    stockin: { title: 'Stock IN', subtitle: 'Receive products and add to inventory' },
    stockout: { title: 'Stock OUT', subtitle: 'Remove products from inventory' },
    ledger: { title: 'Transaction Ledger', subtitle: 'Complete history of all stock movements' },
    settings: { title: 'Settings', subtitle: 'System preferences and data management' }
  };
  
  document.getElementById('pageTitle').innerText = titles[view]?.title || 'Dashboard';
  document.getElementById('pageSubtitle').innerText = titles[view]?.subtitle || '';
  
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.nav === view) btn.classList.add('active');
  });
  
  renderCurrentView();
}

function renderCurrentView() {
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'inventory') renderInventory();
  else if (currentView === 'stockin') renderStockIn();
  else if (currentView === 'stockout') renderStockOut();
  else if (currentView === 'ledger') renderLedger();
  else if (currentView === 'settings') renderSettings();
}

// ============================================
// INITIALIZATION
// ============================================

function init() {
  loadData();
  loadTheme();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  renderCurrentView();
  
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.nav));
  });
  
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', () => toggleTheme(!darkMode));
  
  // Auto-load CSV on page load
  autoLoadCSV();
}

// Make functions global for HTML onclick
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
window.reloadCSV = reloadCSV;

init();
