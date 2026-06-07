// ============================================
// STOCKFLOW ERP SYSTEM - KITCHEN USE ONLY
// Stock OUT only (consumption), CSV manages stock levels
// ============================================

// Data Storage
let items = [];
let transactions = [];
let currentView = "dashboard";
let darkMode = false;
let autoRefreshInterval = null;
let searchTerm = "";

// ============================================
// CSV FUNCTIONS - FULL SYNC
// ============================================

async function loadCSVFromFile() {
  try {
    const paths = ['data.csv', './data.csv'];
    let csvText = null;
    
    for (const path of paths) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
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
      let csvItems = [];
      let csvItemNames = new Set();
      
      for (const row of results.data) {
        const name = row.Name || row.name || row.item_name;
        const unit = (row.Unit || row.unit || "PCS").toUpperCase();
        const cost = parseFloat(row.Price || row.price || row.Cost || row.cost || 0);
        const quantity = parseFloat(row.Stock || row.stock || row.Quantity || row.quantity || 0);
        const expiryDate = row.ExpiryDate || row.expiry_date || row.Expiry || "";
        const minStock = parseInt(row.MinStock || row.minStock || 5);
        
        if (!name) continue;
        
        csvItemNames.add(name.toLowerCase());
        
        csvItems.push({
          name: name,
          unit: unit,
          cost: cost,
          quantity: quantity,
          expiryDate: expiryDate,
          minStock: minStock
        });
      }
      
      let updatedCount = 0;
      let newCount = 0;
      let deletedCount = 0;
      
      // Update existing and add new
      for (const csvItem of csvItems) {
        const existingItem = items.find(i => i.name.toLowerCase() === csvItem.name.toLowerCase());
        
        if (existingItem) {
          existingItem.unit = csvItem.unit;
          existingItem.cost = csvItem.cost;
          existingItem.quantity = csvItem.quantity;
          existingItem.expiryDate = csvItem.expiryDate;
          existingItem.minStock = csvItem.minStock;
          updatedCount++;
        } else {
          items.push({
            id: "item_" + Date.now() + "_" + Math.random(),
            name: csvItem.name,
            quantity: csvItem.quantity,
            unit: csvItem.unit,
            cost: csvItem.cost,
            expiryDate: csvItem.expiryDate,
            minStock: csvItem.minStock || 5
          });
          newCount++;
        }
      }
      
      // Delete items not in CSV
      const itemsToKeep = [];
      for (const item of items) {
        if (csvItemNames.has(item.name.toLowerCase())) {
          itemsToKeep.push(item);
        } else {
          deletedCount++;
        }
      }
      items = itemsToKeep;
      
      saveData();
      renderCurrentView();
      
      let message = `CSV Synced: ${updatedCount} updated, ${newCount} added`;
      if (deletedCount > 0) message += `, ${deletedCount} deleted`;
      showToast(message, 'success');
    }
  });
}

async function reloadCSV() {
  showToast('Syncing with data.csv...', 'info');
  const success = await loadCSVFromFile();
  if (!success) {
    showToast('No data.csv file found', 'error');
  }
}

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(() => {
    console.log('Auto-refreshing CSV...');
    loadCSVFromFile();
  }, 10000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// ============================================
// STOCK OUT ONLY (Kitchen Use)
// ============================================

function removeStock(itemId, quantity, reason, note) {
  const item = items.find(i => i.id === itemId);
  if (!item) return false;
  
  if (quantity > item.quantity) {
    showToast(`Insufficient stock! Only ${item.quantity} ${item.unit} available`, 'error');
    return false;
  }
  
  // Remove stock
  item.quantity = item.quantity - quantity;
  
  // Record transaction
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
    reason: reason || 'Kitchen Use'
  };
  
  transactions.unshift(transaction);
  saveData();
  renderCurrentView();
  showToast(`Kitchen used: ${quantity} ${item.unit} of ${item.name}. Remaining: ${item.quantity} ${item.unit}`, 'success');
  return true;
}

function getStockStatus(item) {
  if (item.quantity <= 0) return { class: 'status-expired', text: 'Out of Stock', icon: '❌' };
  if (item.quantity < item.minStock) return { class: 'status-low', text: 'Low Stock', icon: '⚠️' };
  return { class: 'status-ok', text: 'In Stock', icon: '✅' };
}

function filterItems() {
  if (!searchTerm) return items;
  return items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function exportInventoryToCSV() {
  if (items.length === 0) {
    showToast('No items to export', 'error');
    return;
  }
  
  const headers = ['Name', 'Quantity', 'Unit', 'Cost', 'Total Value', 'Expiry Date', 'Min Stock'];
  const rows = items.map(item => [
    item.name,
    item.quantity,
    item.unit,
    item.cost,
    (item.quantity * item.cost).toFixed(2),
    item.expiryDate || 'N/A',
    item.minStock
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadCSV(csvContent, `inventory_${new Date().toISOString().split('T')[0]}.csv`);
  showToast('Inventory exported successfully', 'success');
}

function exportTransactionsToCSV() {
  if (transactions.length === 0) {
    showToast('No transactions to export', 'error');
    return;
  }
  
  const headers = ['Date', 'Type', 'Item', 'Quantity', 'Unit', 'Value', 'Reason', 'Reference'];
  const rows = transactions.map(t => [
    new Date(t.timestamp).toLocaleString(),
    t.type || 'KITCHEN_OUT',
    t.itemName,
    t.quantity,
    t.unit,
    (t.quantity * (t.cost || 0)).toFixed(2),
    t.reason || 'Kitchen Use',
    t.note || '-'
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadCSV(csvContent, `kitchen_usage_${new Date().toISOString().split('T')[0]}.csv`);
  showToast('Kitchen usage exported successfully', 'success');
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// UI RENDERING
// ============================================

function renderDashboard() {
  const filteredItems = filterItems();
  const totalItems = filteredItems.length;
  const totalStock = filteredItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = filteredItems.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
  const lowStockCount = filteredItems.filter(i => i.quantity < i.minStock).length;
  const recentTransactions = transactions.slice(0, 10);
  
  const html = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <span>Total Items</span>
          <div class="stat-icon"><i class="fas fa-box"></i></div>
        </div>
        <div class="stat-value">${totalItems}</div>
        <div class="stat-label">Products in Stock</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>Total Stock</span>
          <div class="stat-icon"><i class="fas fa-warehouse"></i></div>
        </div>
        <div class="stat-value">${totalStock}</div>
        <div class="stat-label">Total Units Available</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>Total Value</span>
          <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
        </div>
        <div class="stat-value">$${totalValue.toLocaleString()}</div>
        <div class="stat-label">Inventory Value</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>Low Stock Alerts</span>
          <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
        </div>
        <div class="stat-value" style="color: ${lowStockCount > 0 ? '#f59e0b' : '#10b981'}">${lowStockCount}</div>
        <div class="stat-label">Below minimum stock</div>
      </div>
    </div>
    
    <div class="search-section" style="margin-bottom: 1.5rem;">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Search items by name..." value="${searchTerm}" style="width: 100%; max-width: 400px;">
    </div>
    
    <div class="section-header">
      <h2><i class="fas fa-utensils"></i> Kitchen Stock</h2>
      <button class="btn btn-primary" onclick="switchView('inventory')">View All</button>
    </div>
    
    <div class="cards-grid">
      ${filteredItems.slice(0, 6).map(item => {
        const status = getStockStatus(item);
        return `
          <div class="inventory-card ${status.class === 'status-low' ? 'low-stock-card' : ''}" style="${status.class === 'status-low' ? 'border-left: 3px solid #f59e0b;' : ''} ${status.class === 'status-expired' ? 'border-left: 3px solid #ef4444;' : ''}">
            <div class="card-header">
              <span class="item-name">${escapeHtml(item.name)}</span>
              <span class="item-price">$${item.cost}</span>
            </div>
            <div class="card-details">
              <span>Available: <strong style="font-size: 1.1rem;">${item.quantity}</strong> ${item.unit}</span>
              <span>Expiry: ${item.expiryDate || 'N/A'}</span>
            </div>
            <div style="margin: 0.5rem 0;">
              <span class="stock-status ${status.class}">${status.icon} ${status.text}</span>
              ${item.quantity < item.minStock ? `<span style="margin-left: 0.5rem; font-size: 0.7rem; color: #f59e0b;">(Min: ${item.minStock})</span>` : ''}
            </div>
            <button class="btn btn-warning" style="width: 100%; margin-top: 0.75rem; background: #f59e0b; color: white;" onclick="openStockOutModal('${item.id}')" ${item.quantity <= 0 ? 'disabled' : ''}>
              <i class="fas fa-utensils"></i> Use in Kitchen
            </button>
          </div>
        `;
      }).join('')}
      ${filteredItems.length === 0 ? '<div class="empty-state" style="text-align: center; padding: 3rem;">No items found matching your search</div>' : ''}
    </div>
    
    <div class="section-header">
      <h2><i class="fas fa-history"></i> Recent Kitchen Usage</h2>
      <button class="btn btn-primary" onclick="switchView('ledger')">View All</button>
    </div>
    
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr><th>Date & Time</th><th>Item</th><th>Quantity Used</th><th>Unit</th><th>Reason</th><th>Reference</th></tr>
        </thead>
        <tbody>
          ${recentTransactions.map(t => `
            <tr>
              <td>${new Date(t.timestamp).toLocaleString()}</td
              <td>${escapeHtml(t.itemName)}</td
              <td>${t.quantity}</td
              <td>${t.unit}</td
              <td>${escapeHtml(t.reason || 'Kitchen Use')}</td
              <td>${escapeHtml(t.note || '-')}</td
            </tr>
          `).join('')}
          ${recentTransactions.length === 0 ? '<tr><td colspan="6" class="text-center">No kitchen usage recorded yet</td</tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
  attachSearchListener();
}

function renderInventory() {
  const filteredItems = filterItems();
  const lowStockCount = filteredItems.filter(i => i.quantity < i.minStock).length;
  
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-boxes"></i> Kitchen Inventory</h2>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick="exportInventoryToCSV()" title="Export Inventory">
          <i class="fas fa-download"></i> Export CSV
        </button>
        <button class="btn btn-secondary" onclick="reloadCSV()" title="Sync with CSV file">
          <i class="fas fa-sync-alt"></i> Sync CSV
        </button>
      </div>
    </div>
    
    ${lowStockCount > 0 ? `
    <div class="alert-banner" style="background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem;">
      <i class="fas fa-exclamation-triangle"></i> <strong>${lowStockCount} items</strong> are below minimum stock level. Please update CSV with new stock.
    </div>
    ` : ''}
    
    <div class="search-section" style="margin-bottom: 1.5rem;">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Search items by name..." value="${searchTerm}" style="width: 100%; max-width: 400px;">
    </div>
    
    <div class="cards-grid">
      ${filteredItems.map(item => {
        const status = getStockStatus(item);
        return `
          <div class="inventory-card ${status.class === 'status-low' ? 'low-stock-card' : ''}" style="${status.class === 'status-low' ? 'border-left: 3px solid #f59e0b;' : ''} ${status.class === 'status-expired' ? 'border-left: 3px solid #ef4444;' : ''}">
            <div class="card-header">
              <div>
                <span class="item-name">${escapeHtml(item.name)}</span>
                <div style="font-size: 0.7rem; color: var(--gray); margin-top: 0.2rem;">Unit: ${item.unit} | Min Stock: ${item.minStock}</div>
              </div>
              <div style="text-align: right;">
                <span class="item-price">$${item.cost}</span>
                <div style="font-size: 0.7rem; color: var(--gray);">per unit</div>
              </div>
            </div>
            
            <div style="background: var(--bg-light); padding: 0.75rem; border-radius: 12px; margin: 0.75rem 0;">
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span style="font-size: 0.7rem; color: var(--gray);">Current Stock</span>
                <span style="font-size: 1.5rem; font-weight: 700; ${item.quantity < item.minStock ? 'color: #f59e0b;' : ''}">${item.quantity}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                <span>Expiry: ${item.expiryDate || 'N/A'}</span>
                <span>Total Value: $${(item.quantity * item.cost).toFixed(2)}</span>
              </div>
            </div>
            
            <div style="margin-bottom: 0.5rem;">
              <span class="stock-status ${status.class}">${status.icon} ${status.text}</span>
            </div>
            
            <button class="btn btn-warning" style="width: 100%; background: #f59e0b; color: white;" onclick="openStockOutModal('${item.id}')" ${item.quantity <= 0 ? 'disabled' : ''}>
              <i class="fas fa-utensils"></i> Use in Kitchen
            </button>
          </div>
        `;
      }).join('')}
      ${filteredItems.length === 0 ? '<div class="empty-state" style="text-align: center; padding: 3rem;">No items found matching your search</div>' : ''}
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
  attachSearchListener();
}

function renderStockOut() {
  const filteredItems = filterItems();
  
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-utensils"></i> Kitchen Use - Remove Stock</h2>
      <button class="btn btn-secondary" onclick="reloadCSV()">
        <i class="fas fa-sync-alt"></i> Sync CSV
      </button>
    </div>
    
    <div class="search-section" style="margin-bottom: 1.5rem;">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Search items..." value="${searchTerm}" style="width: 100%; max-width: 400px;">
    </div>
    
    <div class="cards-grid">
      ${filteredItems.map(item => {
        const status = getStockStatus(item);
        return `
          <div class="inventory-card">
            <div class="card-header">
              <span class="item-name">${escapeHtml(item.name)}</span>
              <span class="item-price">Available: ${item.quantity} ${item.unit}</span>
            </div>
            <div class="card-details">
              <span>Cost: $${item.cost}</span>
              <span>Expiry: ${item.expiryDate || 'N/A'}</span>
            </div>
            <div style="margin-bottom: 0.5rem;">
              <span class="stock-status ${status.class}">${status.icon} ${status.text}</span>
            </div>
            <button class="btn btn-warning" style="margin-top: 0.75rem; width: 100%; background: #f59e0b; color: white;" onclick="openStockOutModal('${item.id}')" ${item.quantity <= 0 ? 'disabled' : ''}>
              <i class="fas fa-utensils"></i> Use in Kitchen
            </button>
          </div>
        `;
      }).join('')}
      ${filteredItems.length === 0 ? '<div class="empty-state" style="text-align: center; padding: 3rem;">No items found</div>' : ''}
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
  attachSearchListener();
}

function renderLedger() {
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-history"></i> Kitchen Usage Ledger</h2>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" onclick="exportTransactionsToCSV()" title="Export Kitchen Usage">
          <i class="fas fa-download"></i> Export CSV
        </button>
        <button class="btn btn-secondary" onclick="reloadCSV()">
          <i class="fas fa-sync-alt"></i> Sync CSV
        </button>
        <span style="font-size: 0.7rem; color: var(--gray); padding: 0.5rem;">Total: ${transactions.length} records</span>
      </div>
    </div>
    
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Item Name</th>
            <th>Quantity Used</th>
            <th>Unit</th>
            <th>Value</th>
            <th>Reason</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(t => `
            <tr>
              <td>${new Date(t.timestamp).toLocaleString()}</td
              <td><strong>${escapeHtml(t.itemName)}</strong></td
              <td>${t.quantity}</td
              <td>${t.unit}</td
              <td>$${(t.quantity * (t.cost || 0)).toFixed(2)}</td
              <td>${escapeHtml(t.reason || 'Kitchen Use')}</td
              <td>${escapeHtml(t.note || '-')}</td
            </tr>
          `).join('')}
          ${transactions.length === 0 ? '<tr><td colspan="7" class="text-center">No kitchen usage recorded yet</td</tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

function renderSettings() {
  const autoRefreshStatus = autoRefreshInterval ? 'ON' : 'OFF';
  
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-cog"></i> System Settings</h2>
    </div>
    
    <div class="table-container" style="margin-bottom: 1.5rem;">
      <div style="padding: 1.5rem;">
        <h3>CSV Auto-Refresh</h3>
        <p style="font-size: 0.8rem; color: var(--gray); margin: 0.5rem 0;">
          Automatically checks for CSV changes every 10 seconds.
          Current status: <strong>${autoRefreshStatus}</strong>
        </p>
        <div style="display: flex; gap: 1rem;">
          <button class="btn btn-primary" onclick="startAutoRefresh()">
            <i class="fas fa-play"></i> Enable Auto-Refresh
          </button>
          <button class="btn btn-secondary" onclick="stopAutoRefresh()">
            <i class="fas fa-stop"></i> Disable Auto-Refresh
          </button>
          <button class="btn btn-secondary" onclick="reloadCSV()">
            <i class="fas fa-sync-alt"></i> Sync Now
          </button>
        </div>
      </div>
    </div>
    
    <div class="table-container" style="margin-bottom: 1.5rem;">
      <div style="padding: 1.5rem;">
        <h3>Export Data</h3>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="exportInventoryToCSV()">
            <i class="fas fa-download"></i> Export Inventory
          </button>
          <button class="btn btn-primary" onclick="exportTransactionsToCSV()">
            <i class="fas fa-download"></i> Export Kitchen Usage
          </button>
        </div>
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
        <p style="font-size: 0.8rem; color: var(--gray); margin: 0.5rem 0;">Reset all inventory and kitchen usage records.</p>
        <button class="btn btn-danger" onclick="resetData()">
          <i class="fas fa-trash"></i> Reset All Data
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

function attachSearchListener() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderCurrentView();
    });
  }
}

// ============================================
// MODAL FUNCTIONS (Only Kitchen Use)
// ============================================

function openStockOutModal(presetItemId = null) {
  const select = document.getElementById('stockOutItem');
  select.innerHTML = '<option value="">-- Select Item --</option>' + 
    items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Available: ${i.quantity} ${i.unit})</option>`).join('');
  
  document.getElementById('stockOutQty').value = '';
  document.getElementById('stockOutReason').value = 'Kitchen Use';
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
  
  removeStock(itemId, quantity, reason, note);
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
  if (confirm('⚠️ WARNING: This will delete ALL data and restore from CSV.\n\nThis action cannot be undone. Are you sure?')) {
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
    dashboard: { title: 'Kitchen Dashboard', subtitle: 'Track kitchen inventory and usage' },
    inventory: { title: 'Kitchen Inventory', subtitle: 'Current stock levels from CSV' },
    stockout: { title: 'Kitchen Use', subtitle: 'Record ingredients used in kitchen' },
    ledger: { title: 'Usage Ledger', subtitle: 'Complete history of kitchen usage' },
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
  
  autoLoadCSV();
}

// Make functions global
window.openStockOutModal = openStockOutModal;
window.closeStockOutModal = closeStockOutModal;
window.processStockOut = processStockOut;
window.updateStockOutInfo = updateStockOutInfo;
window.switchView = switchView;
window.toggleTheme = toggleTheme;
window.resetData = resetData;
window.reloadCSV = reloadCSV;
window.exportInventoryToCSV = exportInventoryToCSV;
window.exportTransactionsToCSV = exportTransactionsToCSV;
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;

init();
