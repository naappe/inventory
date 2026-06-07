// ============================================
// STOCKFLOW ERP SYSTEM - FIXED PRODUCTION LOGIC
// CSV loads ONLY ONCE when localStorage is empty
// NEVER overwrites kitchen usage data
// ============================================

// Data Storage
let items = [];
let transactions = [];
let currentView = "dashboard";
let darkMode = false;
let autoRefreshInterval = null;
let searchTerm = "";

// MASTER PIN
const MASTER_PIN = "1234";

// ============================================
// CRITICAL FIX: CSV ONLY LOADS IF NO DATA EXISTS
// ============================================

async function loadCSVFromFile() {
  try {
    const paths = ['data.csv', './data.csv'];
    let csvText = null;
    let loadedPath = null;
    
    for (const path of paths) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (response.ok) {
          csvText = await response.text();
          loadedPath = path;
          console.log(`✅ CSV found at: ${path}`);
          break;
        }
      } catch (e) { continue; }
    }
    
    if (csvText && csvText.trim().length > 0) {
      parseCSVData(csvText);
      showToast(`✅ Initial data loaded from CSV`, 'success');
      return true;
    } else {
      console.log("No CSV file found, using sample data");
      loadSampleData();
      return false;
    }
  } catch (error) {
    console.error("CSV Error:", error);
    loadSampleData();
    return false;
  }
}

function parseCSVData(csvText) {
  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      let newItems = [];
      
      for (const row of results.data) {
        const name = row.Name || row.name || row.item_name || row.ItemName;
        const unit = (row.Unit || row.unit || "PCS").toUpperCase();
        const cost = parseFloat(row.Price || row.price || row.Cost || row.cost || 0);
        const expiryDate = row.ExpiryDate || row.expiry_date || row.Expiry || "";
        const minStock = parseInt(row.MinStock || row.minStock || 5);
        
        if (!name) continue;
        
        newItems.push({
          id: "item_" + Date.now() + "_" + Math.random(),
          name: name,
          quantity: 0,  // NEW ITEMS START AT 0 - NO RESET!
          unit: unit,
          cost: cost,
          expiryDate: expiryDate,
          minStock: minStock
        });
      }
      
      // ONLY SET ITEMS IF LOCALSTORAGE IS EMPTY
      const savedItems = localStorage.getItem('stockflow_items');
      if (!savedItems || JSON.parse(savedItems).length === 0) {
        items = newItems;
        saveData();
        console.log(`Initial CSV load: ${items.length} items added with 0 stock`);
      } else {
        // MERGE: Add new items from CSV that don't exist in local storage
        const existingNames = new Set(items.map(i => i.name.toLowerCase()));
        let addedCount = 0;
        
        for (const csvItem of newItems) {
          if (!existingNames.has(csvItem.name.toLowerCase())) {
            items.push(csvItem);
            addedCount++;
          }
        }
        
        if (addedCount > 0) {
          saveData();
          console.log(`CSV merge: added ${addedCount} new items`);
          showToast(`Added ${addedCount} new items from CSV`, 'success');
        }
      }
      
      renderCurrentView();
    }
  });
}

// MANUAL SYNC - ONLY ADDS NEW ITEMS, NEVER RESETS STOCK
async function manualSyncWithCSV() {
  verifyPIN("Sync with CSV", async () => {
    try {
      const paths = ['data.csv', './data.csv'];
      let csvText = null;
      
      for (const path of paths) {
        try {
          const response = await fetch(path, { cache: 'no-store' });
          if (response.ok) {
            csvText = await response.text();
            break;
          }
        } catch (e) { continue; }
      }
      
      if (csvText) {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: function(results) {
            let addedCount = 0;
            let existingNames = new Set(items.map(i => i.name.toLowerCase()));
            
            for (const row of results.data) {
              const name = row.Name || row.name || row.item_name || row.ItemName;
              const unit = (row.Unit || row.unit || "PCS").toUpperCase();
              const cost = parseFloat(row.Price || row.price || row.Cost || row.cost || 0);
              const expiryDate = row.ExpiryDate || row.expiry_date || row.Expiry || "";
              const minStock = parseInt(row.MinStock || row.minStock || 5);
              
              if (!name) continue;
              
              if (!existingNames.has(name.toLowerCase())) {
                items.push({
                  id: "item_" + Date.now() + "_" + Math.random(),
                  name: name,
                  quantity: 0,
                  unit: unit,
                  cost: cost,
                  expiryDate: expiryDate,
                  minStock: minStock
                });
                addedCount++;
                existingNames.add(name.toLowerCase());
              }
            }
            
            if (addedCount > 0) {
              saveData();
              renderCurrentView();
              showToast(`✅ Added ${addedCount} new items from CSV (existing stock preserved)`, 'success');
            } else {
              showToast('No new items found in CSV', 'info');
            }
          }
        });
      } else {
        showToast('No data.csv file found', 'error');
      }
    } catch (error) {
      showToast('Error syncing CSV', 'error');
    }
  });
}

// Sample data fallback (only if absolutely no data exists)
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
    { id: "5", name: "Pasta", quantity: 45, unit: "PCS", cost: 1.2, expiryDate: "2025-09-20", minStock: 15 }
  ];
  
  transactions = [];
  saveData();
}

// ============================================
// PIN PROTECTION
// ============================================

function verifyPIN(actionName, callback) {
  const pin = prompt(`🔒 ${actionName} requires PIN verification:\n\nEnter Master PIN:`);
  if (pin === MASTER_PIN) {
    callback();
  } else if (pin !== null) {
    showToast("❌ Incorrect PIN! Access denied.", 'error');
  }
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
    note: note || '',
    reason: 'Stock Restock'
  };
  
  transactions.unshift(transaction);
  saveData();
  renderCurrentView();
  showToast(`✅ Stock added: +${quantity} ${unit} of ${item.name}. New total: ${item.quantity} ${item.unit}`, 'success');
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
    reason: reason || 'Kitchen Use'
  };
  
  transactions.unshift(transaction);
  saveData();
  renderCurrentView();
  showToast(`🍳 Kitchen used: ${quantity} ${item.unit} of ${item.name}. Remaining: ${item.quantity} ${item.unit}`, 'success');
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
  verifyPIN("Export Inventory Data", () => {
    if (items.length === 0) {
      showToast('No items to export', 'error');
      return;
    }
    
    const headers = ['Name', 'Current Stock', 'Unit', 'Cost', 'Total Value', 'Expiry Date', 'Min Stock'];
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
  });
}

function exportTransactionsToCSV() {
  verifyPIN("Export Transaction Data", () => {
    if (transactions.length === 0) {
      showToast('No transactions to export', 'error');
      return;
    }
    
    const headers = ['Date', 'Type', 'Item', 'Quantity', 'Unit', 'Value', 'Reason', 'Reference'];
    const rows = transactions.map(t => [
      new Date(t.timestamp).toLocaleString(),
      t.type === 'STOCK_IN' ? 'STOCK IN' : 'KITCHEN OUT',
      t.itemName,
      t.quantity,
      t.unit,
      (t.quantity * (t.cost || 0)).toFixed(2),
      t.reason || (t.type === 'STOCK_IN' ? 'Restock' : 'Kitchen Use'),
      t.note || '-'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(csvContent, `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Transactions exported successfully', 'success');
  });
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
// RESET FUNCTION
// ============================================

function resetData() {
  verifyPIN("Reset All Data", () => {
    if (confirm('⚠️ WARNING: This will delete ALL data including kitchen usage history.\n\nThis action cannot be undone. Are you sure?')) {
      localStorage.clear();
      location.reload();
    }
  });
}

// ============================================
// SAVE/LOAD FUNCTIONS
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

// ============================================
// THEME FUNCTIONS
// ============================================

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

// ============================================
// RENDER FUNCTIONS (Keep your existing working ones)
// ============================================

// ... (keep all your renderDashboard, renderInventory, renderStockOut, renderLedger, renderSettings functions here)
// For brevity, I'm showing the key structure - you need to paste your working render functions

function renderDashboard() {
  // Your existing dashboard rendering code
  const filteredItems = filterItems();
  const totalItems = filteredItems.length;
  const totalStock = filteredItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = filteredItems.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
  const lowStockCount = filteredItems.filter(i => i.quantity < i.minStock).length;
  const recentTransactions = transactions.slice(0, 10);
  
  // ... rest of your dashboard HTML
  document.getElementById('viewContainer').innerHTML = html;
  attachSearchListener();
}

function renderInventory() {
  // Your existing inventory rendering code
}

function renderStockOut() {
  // Your existing stock out rendering code
}

function renderLedger() {
  // Your existing ledger rendering code
}

function renderSettings() {
  const autoRefreshStatus = 'OFF';
  const html = `
    <div class="section-header">
      <h2><i class="fas fa-cog"></i> System Settings</h2>
    </div>
    
    <div class="table-container" style="margin-bottom: 1.5rem;">
      <div style="padding: 1.5rem;">
        <h3>📦 Data Source</h3>
        <p style="font-size: 0.8rem; color: var(--gray); margin: 0.5rem 0;">
          <strong>✅ CSV only loads ONCE (when localStorage is empty)</strong><br>
          • Kitchen usage data is NEVER overwritten<br>
          • Stock levels are preserved across page refreshes<br>
          • New items can be added via "Sync with CSV" button
        </p>
      </div>
    </div>
    
    <div class="table-container" style="margin-bottom: 1.5rem;">
      <div style="padding: 1.5rem;">
        <h3>🔒 PIN Protection</h3>
        <p style="font-size: 0.8rem; color: var(--gray); margin: 0.5rem 0;">
          Master PIN: <strong>${MASTER_PIN}</strong><br>
          Protected operations: Add Stock, Export Data, Sync CSV, Reset Data
        </p>
      </div>
    </div>
    
    <div class="table-container" style="margin-bottom: 1.5rem;">
      <div style="padding: 1.5rem;">
        <h3>CSV Management</h3>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="manualSyncWithCSV()">
            <i class="fas fa-plus"></i> Add New Items from CSV
          </button>
          <button class="btn btn-primary" onclick="exportInventoryToCSV()">
            <i class="fas fa-download"></i> Export Inventory
          </button>
          <button class="btn btn-primary" onclick="exportTransactionsToCSV()">
            <i class="fas fa-download"></i> Export Transactions
          </button>
        </div>
        <p style="font-size: 0.7rem; color: var(--gray); margin-top: 0.5rem;">
          Note: "Add New Items" only adds items not already in inventory. Never modifies existing stock.
        </p>
      </div>
    </div>
    
    <div class="table-container" style="margin-bottom: 1.5rem;">
      <div style="padding: 1.5rem;">
        <h3>Theme Preferences</h3>
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
    
    <div class="table-container">
      <div style="padding: 1.5rem;">
        <h3>Danger Zone</h3>
        <button class="btn btn-danger" onclick="resetData()">
          <i class="fas fa-trash"></i> Reset All Data
        </button>
        <p style="font-size: 0.7rem; color: var(--gray); margin-top: 0.5rem;">
          This will delete ALL inventory and kitchen usage history.
        </p>
      </div>
    </div>
  `;
  
  document.getElementById('viewContainer').innerHTML = html;
}

function attachSearchListener() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    // Remove existing listener to avoid duplicates
    const newSearch = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearch, searchInput);
    newSearch.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderCurrentView();
    });
  }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openStockInModal(presetItemId = null) {
  verifyPIN("Add Stock", () => {
    const select = document.getElementById('stockInItem');
    if (select) {
      select.innerHTML = '<option value="">-- Select Product --</option>' + 
        items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Current: ${i.quantity} ${i.unit})</option>`).join('');
    }
    
    const qtyInput = document.getElementById('stockInQty');
    if (qtyInput) qtyInput.value = '';
    
    const unitSelect = document.getElementById('stockInUnit');
    if (unitSelect) unitSelect.value = '';
    
    const costInput = document.getElementById('stockInCost');
    if (costInput) costInput.value = '';
    
    const expiryInput = document.getElementById('stockInExpiry');
    if (expiryInput) expiryInput.value = '';
    
    const noteInput = document.getElementById('stockInNote');
    if (noteInput) noteInput.value = '';
    
    const modal = document.getElementById('stockInModal');
    if (modal) modal.classList.remove('hidden');
  });
}

function closeStockInModal() {
  const modal = document.getElementById('stockInModal');
  if (modal) modal.classList.add('hidden');
}

function processStockIn() {
  const itemId = document.getElementById('stockInItem')?.value;
  const quantity = parseFloat(document.getElementById('stockInQty')?.value);
  const unit = document.getElementById('stockInUnit')?.value;
  const cost = parseFloat(document.getElementById('stockInCost')?.value);
  const expiryDate = document.getElementById('stockInExpiry')?.value;
  const note = document.getElementById('stockInNote')?.value;
  
  if (!itemId) { showToast('Please select an item', 'error'); return; }
  if (!quantity || quantity <= 0) { showToast('Please enter valid quantity', 'error'); return; }
  
  addStock(itemId, quantity, unit, cost, expiryDate, note);
  closeStockInModal();
}

function openStockOutModal(presetItemId = null) {
  const select = document.getElementById('stockOutItem');
  if (select) {
    select.innerHTML = '<option value="">-- Select Item --</option>' + 
      items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Available: ${i.quantity} ${i.unit})</option>`).join('');
  }
  
  const qtyInput = document.getElementById('stockOutQty');
  if (qtyInput) qtyInput.value = '';
  
  const reasonSelect = document.getElementById('stockOutReason');
  if (reasonSelect) reasonSelect.value = 'Kitchen Preparation';
  
  const noteInput = document.getElementById('stockOutNote');
  if (noteInput) noteInput.value = '';
  
  updateStockOutInfo();
  
  const modal = document.getElementById('stockOutModal');
  if (modal) modal.classList.remove('hidden');
}

function closeStockOutModal() {
  const modal = document.getElementById('stockOutModal');
  if (modal) modal.classList.add('hidden');
}

function updateStockOutInfo() {
  const itemId = document.getElementById('stockOutItem')?.value;
  const infoDiv = document.getElementById('currentStockInfo');
  
  if (itemId && infoDiv) {
    const item = items.find(i => i.id === itemId);
    if (item) {
      infoDiv.innerHTML = `Current Stock: ${item.quantity} ${item.unit} available`;
      infoDiv.style.display = 'block';
    }
  } else if (infoDiv) {
    infoDiv.style.display = 'none';
  }
}

function processStockOut() {
  const itemId = document.getElementById('stockOutItem')?.value;
  const quantity = parseFloat(document.getElementById('stockOutQty')?.value);
  const reason = document.getElementById('stockOutReason')?.value;
  const note = document.getElementById('stockOutNote')?.value;
  
  if (!itemId) { showToast('Please select an item', 'error'); return; }
  if (!quantity || quantity <= 0) { showToast('Please enter valid quantity', 'error'); return; }
  
  removeStock(itemId, quantity, reason, note);
  closeStockOutModal();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

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
    dashboard: { title: 'Dashboard', subtitle: 'Real-time kitchen inventory tracking' },
    inventory: { title: 'Inventory', subtitle: 'Complete product catalog with stock levels' },
    stockout: { title: 'Kitchen Use', subtitle: 'Record ingredients used in kitchen (No PIN)' },
    ledger: { title: 'Transaction Ledger', subtitle: 'Complete history of all stock movements' },
    settings: { title: 'Settings', subtitle: 'System preferences (PIN protected)' }
  };
  
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  
  if (pageTitle) pageTitle.innerText = titles[view]?.title || 'Dashboard';
  if (pageSubtitle) pageSubtitle.innerText = titles[view]?.subtitle || '';
  
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
// INITIALIZATION - CRITICAL FIX HERE
// ============================================

async function init() {
  loadData();
  loadTheme();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // CRITICAL FIX: Only load CSV if NO data exists in localStorage
  if (items.length === 0) {
    console.log("First time loading - importing from CSV");
    await loadCSVFromFile();
  } else {
    console.log(`Using existing data: ${items.length} items, ${transactions.length} transactions`);
    // Just render what we have
    renderCurrentView();
  }
  
  renderCurrentView();
  
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.nav));
  });
  
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', () => toggleTheme(!darkMode));
}

// Make functions global
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
window.manualSyncWithCSV = manualSyncWithCSV;
window.exportInventoryToCSV = exportInventoryToCSV;
window.exportTransactionsToCSV = exportTransactionsToCSV;

init();
