// ============================================
// STOCKFLOW ERP - PERFECT SEARCH (No Focus Loss)
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
// LOAD DATA FROM CSV FILE (FIXED)
// ============================================

async function loadSampleData() {
  const savedItems = localStorage.getItem('stockflow_items');
  if (savedItems && JSON.parse(savedItems).length > 0) {
    items = JSON.parse(savedItems);
    transactions = JSON.parse(localStorage.getItem('stockflow_transactions') || '[]');
    return;
  }
  
  // Try to load from CSV file first
  try {
    const response = await fetch('data.csv');
    if (response.ok) {
      const csvText = await response.text();
      
      // Parse CSV using PapaParse
      const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
      });
      
      const parsedItems = [];
      let idCounter = 1;
      
      result.data.forEach(row => {
        const vendor = row.Vendor || '';
        const name = row.Name || '';
        const unit = row.Unit || 'PCS';
        let rate = parseFloat(row.Rate);
        
        // Skip rows with missing name or invalid rate
        if (!name || isNaN(rate) || rate <= 0) return;
        
        // Skip rows with zero rate
        if (rate === 0) return;
        
        // Clean up name - combine vendor and name if vendor exists
        let cleanName = name.trim();
        if (vendor && vendor.trim() && vendor.trim() !== '') {
          cleanName = `${vendor.trim()} - ${cleanName}`;
        }
        
        parsedItems.push({
          id: (idCounter++).toString(),
          name: cleanName,
          quantity: 0,
          unit: unit,
          cost: rate,
          expiryDate: '',
          minStock: 1
        });
      });
      
      if (parsedItems.length > 0) {
        items = parsedItems;
        
        // Add initial transaction record
        transactions = [{
          id: Date.now().toString(),
          type: "STOCK_IN",
          itemId: "import",
          itemName: "CSV Data Imported",
          quantity: items.length,
          unit: "items",
          cost: 0,
          timestamp: new Date().toISOString(),
          note: `Imported ${items.length} products from data.csv`
        }];
        
        saveData();
        showToast(`✅ Successfully loaded ${items.length} items from CSV`, 'success');
        return;
      }
    }
  } catch (error) {
    console.log('CSV file not found or error loading:', error);
  }
  
  // Fallback sample data if CSV fails to load
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
  
  // Update only what changed - NO full re-render
  if (currentView === 'inventory') {
    updateInventoryGridOnly();
  } else if (currentView === 'dashboard') {
    updateDashboardStats();
    updateRecentTransactionsOnly();
  } else if (currentView === 'stockout') {
    updateKitchenGridOnly();
  }
  
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
  
  // Update only what changed - NO full re-render
  if (currentView === 'inventory') {
    updateInventoryGridOnly();
  } else if (currentView === 'dashboard') {
    updateDashboardStats();
    updateRecentTransactionsOnly();
  } else if (currentView === 'stockout') {
    updateKitchenGridOnly();
  }
  
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
// SEARCH FUNCTIONS - NO PAGE RE-RENDER, NO FOCUS LOSS
// ============================================

function performSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchTerm = searchInput.value;
    // ONLY update the grid - NO re-render of entire page
    if (currentView === 'inventory') {
      updateInventoryGridOnly();
    } else if (currentView === 'stockout') {
      updateKitchenGridOnly();
    }
    updateSearchStats();
  }
}

function clearSearch() {
  searchTerm = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    if (currentView === 'inventory') {
      updateInventoryGridOnly();
    } else if (currentView === 'stockout') {
      updateKitchenGridOnly();
    }
    updateSearchStats();
  }
}

function updateSearchStats() {
  const statsSpan = document.getElementById('searchStats');
  if (statsSpan) {
    const filtered = filterItems();
    statsSpan.textContent = `${filtered.length} of ${items.length} items`;
  }
}

// ============================================
// INVENTORY GRID UPDATE ONLY (No page re-render)
// ============================================

function updateInventoryGridOnly() {
  const grid = document.getElementById('inventoryGrid');
  if (!grid) return;
  
  const filtered = filterItems();
  
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No items found</div>';
    return;
  }
  
  grid.innerHTML = filtered.map(item => {
    const status = getStockStatus(item);
    return `
      <div class="inventory-card">
        <div class="card-header">
          <div>
            <span class="item-name">${escapeHtml(item.name)}</span>
            <div style="font-size:0.7rem;color:var(--gray);">${item.unit} | Min: ${item.minStock}</div>
          </div>
          <div>
            <span class="item-price">$${item.cost.toFixed(2)}</span>
            <div style="font-size:0.7rem;">per unit</div>
          </div>
        </div>
        <div style="background:var(--bg-light);padding:0.75rem;border-radius:12px;margin:0.75rem 0;">
          <div style="display:flex;justify-content:space-between;">
            <span>Current Stock</span>
            <span style="font-size:1.5rem;font-weight:700;">${item.quantity}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:0.5rem;">
            <span>Expiry: ${item.expiryDate || 'N/A'}</span>
            <span>Value: $${(item.quantity * item.cost).toFixed(2)}</span>
          </div>
        </div>
        <div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div>
        <div class="card-actions" style="display:flex;gap:0.5rem;margin-top:0.75rem;">
          <button class="btn btn-success" style="flex:1;" onclick="openStockInModal('${item.id}')">+ Add Stock</button>
          ${item.quantity > 0 ? `<button class="btn btn-warning" style="flex:1;" onclick="openStockOutModal('${item.id}')">🍳 Kitchen Use</button>` : `<button class="btn btn-secondary" style="flex:1;" disabled>Out of Stock</button>`}
        </div>
      </div>
    `;
  }).join('');
}

function updateKitchenGridOnly() {
  const grid = document.getElementById('kitchenGrid');
  if (!grid) return;
  
  const filtered = filterItems();
  
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No items found</div>';
    return;
  }
  
  grid.innerHTML = filtered.map(item => {
    const status = getStockStatus(item);
    return `
      <div class="inventory-card">
        <div class="card-header">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-price">Stock: ${item.quantity} ${item.unit}</span>
        </div>
        <div class="card-details">
          <span>Cost: $${item.cost.toFixed(2)}</span>
          <span>Expiry: ${item.expiryDate || 'N/A'}</span>
        </div>
        <div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div>
        ${item.quantity > 0 ? `<button class="btn btn-warning" style="margin-top:0.75rem;width:100%;" onclick="openStockOutModal('${item.id}')">🍳 Use in Kitchen</button>` : `<button class="btn btn-secondary" style="margin-top:0.75rem;width:100%;" disabled>❌ Out of Stock</button>`}
      </div>
    `;
  }).join('');
}

// ============================================
// DASHBOARD UPDATE FUNCTIONS (No page re-render)
// ============================================

function updateDashboardStats() {
  const statsGrid = document.getElementById('dashboardStatsGrid');
  if (!statsGrid) return;
  
  const totalItems = items.length;
  const totalStock = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
  const lowStockCount = items.filter(i => i.quantity < i.minStock).length;
  
  statsGrid.innerHTML = `
    <div class="stat-card" onclick="switchView('inventory')">
      <div class="stat-header"><span>Total Items</span><div class="stat-icon"><i class="fas fa-box"></i></div></div>
      <div class="stat-value">${totalItems}</div>
      <div class="stat-label">Products</div>
    </div>
    <div class="stat-card" onclick="switchView('inventory')">
      <div class="stat-header"><span>Total Stock</span><div class="stat-icon"><i class="fas fa-warehouse"></i></div></div>
      <div class="stat-value">${totalStock}</div>
      <div class="stat-label">Units</div>
    </div>
    <div class="stat-card">
      <div class="stat-header"><span>Total Value</span><div class="stat-icon"><i class="fas fa-dollar-sign"></i></div></div>
      <div class="stat-value">$${totalValue.toLocaleString()}</div>
      <div class="stat-label">Inventory Value</div>
    </div>
    <div class="stat-card" onclick="switchView('inventory')">
      <div class="stat-header"><span>Low Stock</span><div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div></div>
      <div class="stat-value" style="color:${lowStockCount>0?'#f59e0b':'#10b981'}">${lowStockCount}</div>
      <div class="stat-label">Alerts</div>
    </div>
  `;
}

function updateRecentTransactionsOnly() {
  const tbody = document.getElementById('recentTransactionsBody');
  if (!tbody) return;
  
  tbody.innerHTML = transactions.slice(0,10).map(t => `
    <tr>
      <td>${new Date(t.timestamp).toLocaleString()}</td>
      <td><span class="badge ${t.type === 'STOCK_IN' ? 'badge-in' : 'badge-out'}">${t.type === 'STOCK_IN' ? 'IN' : 'OUT'}</span></td>
      <td>${escapeHtml(t.itemName)}</td>
      <td>${t.quantity}</td>
      <td>${t.unit}</td>
      <td>${escapeHtml(t.note || '-')}</td>
    </tr>
  `).join('');
}

function updateDashboardRecentGrid() {
  const grid = document.getElementById('dashboardRecentGrid');
  if (!grid) return;
  
  grid.innerHTML = items.slice(0,6).map(item => {
    const status = getStockStatus(item);
    return `
      <div class="inventory-card">
        <div class="card-header">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-price">$${item.cost.toFixed(2)}</span>
        </div>
        <div class="card-details">
          <span>Stock: <strong>${item.quantity}</strong> ${item.unit}</span>
          <span>Expiry: ${item.expiryDate || 'N/A'}</span>
        </div>
        <div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div>
        <div class="card-actions" style="display:flex;gap:0.5rem;margin-top:0.75rem;">
          <button class="btn btn-success" style="flex:1;" onclick="openStockInModal('${item.id}')">+ Add Stock</button>
          ${item.quantity > 0 ? `<button class="btn btn-warning" style="flex:1;" onclick="openStockOutModal('${item.id}')">🍳 Kitchen Use</button>` : `<button class="btn btn-secondary" style="flex:1;" disabled>Out of Stock</button>`}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// RENDER FUNCTIONS (Called only when switching views)
// ============================================

function renderDashboard() {
  const totalItems = items.length;
  const totalStock = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
  const lowStockCount = items.filter(i => i.quantity < i.minStock).length;
  
  const html = `
    <div class="stats-grid" id="dashboardStatsGrid">
      <div class="stat-card" onclick="switchView('inventory')">
        <div class="stat-header"><span>Total Items</span><div class="stat-icon"><i class="fas fa-box"></i></div></div>
        <div class="stat-value">${totalItems}</div>
        <div class="stat-label">Products</div>
      </div>
      <div class="stat-card" onclick="switchView('inventory')">
        <div class="stat-header"><span>Total Stock</span><div class="stat-icon"><i class="fas fa-warehouse"></i></div></div>
        <div class="stat-value">${totalStock}</div>
        <div class="stat-label">Units</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span>Total Value</span><div class="stat-icon"><i class="fas fa-dollar-sign"></i></div></div>
        <div class="stat-value">$${totalValue.toLocaleString()}</div>
        <div class="stat-label">Inventory Value</div>
      </div>
      <div class="stat-card" onclick="switchView('inventory')">
        <div class="stat-header"><span>Low Stock</span><div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div></div>
        <div class="stat-value" style="color:${lowStockCount>0?'#f59e0b':'#10b981'}">${lowStockCount}</div>
        <div class="stat-label">Alerts</div>
      </div>
    </div>
    
    <div class="section-header">
      <h2>📦 Recent Items</h2>
      <button class="btn btn-primary" onclick="switchView('inventory')">View All</button>
    </div>
    <div class="cards-grid" id="dashboardRecentGrid">
      ${items.slice(0,6).map(item => {
        const status = getStockStatus(item);
        return `
          <div class="inventory-card">
            <div class="card-header">
              <span class="item-name">${escapeHtml(item.name)}</span>
              <span class="item-price">$${item.cost.toFixed(2)}</span>
            </div>
            <div class="card-details">
              <span>Stock: <strong>${item.quantity}</strong> ${item.unit}</span>
              <span>Expiry: ${item.expiryDate || 'N/A'}</span>
            </div>
            <div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div>
            <div class="card-actions" style="display:flex;gap:0.5rem;margin-top:0.75rem;">
              <button class="btn btn-success" style="flex:1;" onclick="openStockInModal('${item.id}')">+ Add Stock</button>
              ${item.quantity > 0 ? `<button class="btn btn-warning" style="flex:1;" onclick="openStockOutModal('${item.id}')">🍳 Kitchen Use</button>` : `<button class="btn btn-secondary" style="flex:1;" disabled>Out of Stock</button>`}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    
    <div class="section-header">
      <h2>📋 Recent Activity</h2>
      <button class="btn btn-primary" onclick="switchView('ledger')">View All</button>
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Qty</th><th>Unit</th><th>Reference</th></thead>
        <tbody id="recentTransactionsBody">
          ${transactions.slice(0,10).map(t => `
            <tr>
              <td>${new Date(t.timestamp).toLocaleString()}</td>
              <td><span class="badge ${t.type === 'STOCK_IN' ? 'badge-in' : 'badge-out'}">${t.type === 'STOCK_IN' ? 'IN' : 'OUT'}</span></td>
              <td>${escapeHtml(t.itemName)}</td>
              <td>${t.quantity}</td>
              <td>${t.unit}</td>
              <td>${escapeHtml(t.note || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
}

function renderInventory() {
  const filtered = filterItems();
  
  const html = `
    <div class="section-header">
      <h2>📦 All Inventory</h2>
      <div>
        <button class="btn btn-success" onclick="openStockInModal()">+ Add Stock (PIN)</button>
        <button class="btn btn-secondary" onclick="exportInventoryToCSV()">📥 Export</button>
      </div>
    </div>
    
    <!-- SEARCH BAR - Static, never recreated -->
    <div class="search-section">
      <div class="search-wrapper">
        <i class="fas fa-search"></i>
        <input type="text" id="searchInput" class="search-input" placeholder="Search items..." value="${searchTerm}" autocomplete="off">
        ${searchTerm ? '<button class="clear-search" onclick="clearSearch()">✕</button>' : ''}
      </div>
      <div class="search-stats" id="searchStats">${filtered.length} of ${items.length} items</div>
    </div>
    
    <div class="cards-grid" id="inventoryGrid">
      ${filtered.map(item => {
        const status = getStockStatus(item);
        return `
          <div class="inventory-card">
            <div class="card-header">
              <div>
                <span class="item-name">${escapeHtml(item.name)}</span>
                <div style="font-size:0.7rem;color:var(--gray);">${item.unit} | Min: ${item.minStock}</div>
              </div>
              <div>
                <span class="item-price">$${item.cost.toFixed(2)}</span>
                <div style="font-size:0.7rem;">per unit</div>
              </div>
            </div>
            <div style="background:var(--bg-light);padding:0.75rem;border-radius:12px;margin:0.75rem 0;">
              <div style="display:flex;justify-content:space-between;">
                <span>Current Stock</span>
                <span style="font-size:1.5rem;font-weight:700;">${item.quantity}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:0.5rem;">
                <span>Expiry: ${item.expiryDate || 'N/A'}</span>
                <span>Value: $${(item.quantity * item.cost).toFixed(2)}</span>
              </div>
            </div>
            <div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div>
            <div class="card-actions" style="display:flex;gap:0.5rem;margin-top:0.75rem;">
              <button class="btn btn-success" style="flex:1;" onclick="openStockInModal('${item.id}')">+ Add Stock</button>
              ${item.quantity > 0 ? `<button class="btn btn-warning" style="flex:1;" onclick="openStockOutModal('${item.id}')">🍳 Kitchen Use</button>` : `<button class="btn btn-secondary" style="flex:1;" disabled>Out of Stock</button>`}
            </div>
          </div>
        `;
      }).join('')}
      ${filtered.length === 0 ? '<div class="empty-state">No items found</div>' : ''}
    </div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
  
  // Attach search listener AFTER DOM is created
  attachInventorySearchListener();
}

function attachInventorySearchListener() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    // Remove any existing listener by cloning
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    
    newInput.addEventListener('input', function(e) {
      searchTerm = e.target.value;
      // ONLY update the grid - NO page re-render
      updateInventoryGridOnly();
      updateSearchStats();
    });
  }
}

function renderStockOut() {
  const filtered = filterItems();
  
  const html = `
    <div class="section-header">
      <h2>🍳 Kitchen Use</h2>
      <p style="font-size:0.8rem;color:var(--gray);">No PIN required</p>
    </div>
    
    <div class="search-section">
      <div class="search-wrapper">
        <i class="fas fa-search"></i>
        <input type="text" id="searchInput" class="search-input" placeholder="Search items..." value="${searchTerm}" autocomplete="off">
        ${searchTerm ? '<button class="clear-search" onclick="clearSearch()">✕</button>' : ''}
      </div>
      <div class="search-stats" id="searchStats">${filtered.length} of ${items.length} items</div>
    </div>
    
    <div class="cards-grid" id="kitchenGrid">
      ${filtered.map(item => {
        const status = getStockStatus(item);
        return `
          <div class="inventory-card">
            <div class="card-header">
              <span class="item-name">${escapeHtml(item.name)}</span>
              <span class="item-price">Stock: ${item.quantity} ${item.unit}</span>
            </div>
            <div class="card-details">
              <span>Cost: $${item.cost.toFixed(2)}</span>
              <span>Expiry: ${item.expiryDate || 'N/A'}</span>
            </div>
            <div><span class="stock-status ${status.class}">${status.icon} ${status.text}</span></div>
            ${item.quantity > 0 ? `<button class="btn btn-warning" style="margin-top:0.75rem;width:100%;" onclick="openStockOutModal('${item.id}')">🍳 Use in Kitchen</button>` : `<button class="btn btn-secondary" style="margin-top:0.75rem;width:100%;" disabled>❌ Out of Stock</button>`}
          </div>
        `;
      }).join('')}
      ${filtered.length === 0 ? '<div class="empty-state">No items found</div>' : ''}
    </div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
  
  attachKitchenSearchListener();
}

function attachKitchenSearchListener() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    
    newInput.addEventListener('input', function(e) {
      searchTerm = e.target.value;
      updateKitchenGridOnly();
      updateSearchStats();
    });
  }
}

function renderLedger() {
  const html = `
    <div class="section-header">
      <h2>📋 Transaction Ledger</h2>
      <button class="btn btn-secondary" onclick="exportTransactionsToCSV()">📥 Export CSV (PIN)</button>
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr><th>Date & Time</th><th>Type</th><th>Item</th><th>Quantity</th><th>Unit</th><th>Value</th><th>Reference</th></tr>
        </thead>
        <tbody id="ledgerBody">
          ${transactions.map(t => `
            <tr>
              <td>${new Date(t.timestamp).toLocaleString()}</td>
              <td><span class="badge ${t.type === 'STOCK_IN' ? 'badge-in' : 'badge-out'}">${t.type === 'STOCK_IN' ? '📥 IN' : '🍳 OUT'}</span></td>
              <td><strong>${escapeHtml(t.itemName)}</strong></td>
              <td>${t.quantity}</td>
              <td>${t.unit}</td>
              <td>$${(t.quantity * (t.cost || 0)).toFixed(2)}</td>
              <td>${escapeHtml(t.note || '-')}</td>
            </tr>
          `).join('')}
          ${transactions.length === 0 ? ' hilab<td colspan="7" class="text-center">No transactions</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById('viewContainer').innerHTML = html;
}

function renderSettings() {
  const html = `
    <div class="section-header"><h2>⚙️ Settings</h2></div>
    <div class="table-container" style="margin-bottom:1rem;">
      <div style="padding:1.5rem;">
        <h3>🔒 PIN Protection</h3>
        <p>Master PIN: <strong>${MASTER_PIN}</strong><br>Protected: Add Stock, Export Data</p>
      </div>
    </div>
    <div class="table-container" style="margin-bottom:1rem;">
      <div style="padding:1.5rem;">
        <h3>🎨 Theme</h3>
        <div style="display:flex;gap:1rem;">
          <button class="btn ${!darkMode ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTheme(false)">☀️ Light</button>
          <button class="btn ${darkMode ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTheme(true)">🌙 Dark</button>
        </div>
      </div>
    </div>
    <div class="table-container">
      <div style="padding:1.5rem;">
        <h3>🗑️ Danger Zone</h3>
        <button class="btn btn-danger" onclick="resetData()">Reset All Data</button>
        <p style="font-size:0.7rem;margin-top:0.5rem;">Deletes all inventory and transactions</p>
      </div>
    </div>
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
  const note
