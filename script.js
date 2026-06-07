// ============================================
// STOCKFLOW ERP SYSTEM - PROPER CSV LOADING
// Loads data.csv from the same GitHub folder
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
// CSV LOADING FUNCTION - WORKS WITH GITHUB
// ============================================

async function loadCSVFromFile() {
  try {
    // Try multiple possible paths where CSV might be located
    const paths = [
      'data.csv',           // Same folder
      './data.csv',         // Current directory
      '../data.csv',        // Parent directory
      '/data.csv'           // Root directory
    ];
    
    let csvText = null;
    let loadedPath = null;
    
    for (const path of paths) {
      try {
        console.log(`Trying to load CSV from: ${path}`);
        const response = await fetch(path, { 
          cache: 'no-store',  // Prevent caching
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          csvText = await response.text();
          loadedPath = path;
          console.log(`✅ CSV successfully loaded from: ${path}`);
          break;
        } else {
          console.log(`❌ Failed to load from ${path}: ${response.status}`);
        }
      } catch (e) {
        console.log(`❌ Error loading from ${path}:`, e.message);
        continue;
      }
    }
    
    if (csvText && csvText.trim().length > 0) {
      parseCSVData(csvText);
      showToast(`✅ CSV loaded from ${loadedPath}`, 'success');
      return true;
    } else {
      console.log("No CSV file found, using sample data");
      loadSampleData();
      showToast('No data.csv found. Using sample data.', 'info');
      return false;
    }
  } catch (error) {
    console.error("CSV Error:", error);
    loadSampleData();
    showToast('Error loading CSV. Using sample data.', 'error');
    return false;
  }
}

function parseCSVData(csvText) {
  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      console.log(`Parsed ${results.data.length} rows from CSV`);
      
      let newItems = [];
      let csvItemNames = new Set();
      let parsedCount = 0;
      
      for (const row of results.data) {
        // Support multiple column name formats
        const name = row.Name || row.name || row.item_name || row.ItemName;
        const unit = (row.Unit || row.unit || "PCS").toUpperCase();
        const cost = parseFloat(row.Price || row.price || row.Cost || row.cost || 0);
        const quantity = parseFloat(row.Stock || row.stock || row.Quantity || row.quantity || 0);
        const expiryDate = row.ExpiryDate || row.expiry_date || row.Expiry || "";
        const minStock = parseInt(row.MinStock || row.minStock || 5);
        
        if (!name) {
          console.log("Skipping row - no name:", row);
          continue;
        }
        
        csvItemNames.add(name.toLowerCase());
        
        // Check if item already exists (preserve stock if it exists)
        const existingItem = items.find(i => i.name.toLowerCase() === name.toLowerCase());
        
        if (existingItem) {
          // Update existing item but KEEP current stock quantity
          existingItem.unit = unit;
          existingItem.cost = cost;
          existingItem.expiryDate = expiryDate;
          existingItem.minStock = minStock;
          // IMPORTANT: Do NOT change existingItem.quantity
          newItems.push(existingItem);
        } else {
          // Add new item with stock from CSV
          newItems.push({
            id: "item_" + Date.now() + "_" + Math.random() + "_" + parsedCount,
            name: name,
            quantity: quantity,  // Use CSV stock for new items
            unit: unit,
            cost: cost,
            expiryDate: expiryDate,
            minStock: minStock
          });
        }
        parsedCount++;
      }
      
      // Keep items that are in CSV, remove ones not in CSV
      const finalItems = [];
      for (const item of items) {
        if (csvItemNames.has(item.name.toLowerCase())) {
          finalItems.push(item);
        } else {
          console.log(`Item not in CSV, keeping: ${item.name}`);
          // Keep items not in CSV (don't delete them)
          finalItems.push(item);
        }
      }
      
      // Add new items that weren't in existing items
      for (const newItem of newItems) {
        if (!finalItems.find(i => i.name.toLowerCase() === newItem.name.toLowerCase())) {
          finalItems.push(newItem);
        }
      }
      
      items = finalItems;
      
      console.log(`CSV processed: ${items.length} total items`);
      saveData();
      renderCurrentView();
      showToast(`CSV loaded: ${parsedCount} items processed`, 'success');
    },
    error: function(error) {
      console.error("CSV Parse Error:", error);
      showToast('Error parsing CSV file', 'error');
    }
  });
}

// Sample data fallback (if no CSV exists)
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
  
  transactions = [
    { id: "t1", type: "STOCK_IN", itemId: "1", itemName: "Basmati Rice", quantity: 50, unit: "KG", cost: 2.5, timestamp: new Date().toISOString(), note: "Initial stock", reason: "Restock" }
  ];
  
  saveData();
}

// Manual reload function
async function reloadCSV() {
  verifyPIN("Sync with CSV", async () => {
    showToast('Loading data.csv...', 'info');
    const success = await loadCSVFromFile();
    if (!success) {
      showToast('Could not load data.csv. Make sure the file exists in the same folder.', 'error');
    }
  });
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
    if (confirm('⚠️ WARNING: This will delete ALL data.\n\nThis action cannot be undone. Are you sure?')) {
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
// UI RENDERING FUNCTIONS (Keep your existing ones)
// ============================================

// ... (keep all your render functions from previous version)
// renderDashboard, renderInventory, renderStockOut, renderLedger, renderSettings
// attachSearchListener, etc.

// For brevity, I'm showing the key functions
// You need to keep all the render functions from your previous working version

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
  
  document.getElementById('pageTitle').innerText = titles[view]?.title || 'Dashboard';
  document.getElementById('pageSubtitle').innerText = titles[view]?.subtitle || '';
  
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.nav === view) btn.classList.add('active');
  });
  
  renderCurrentView();
}

function renderCurrentView() {
  // You need to implement these based on your existing working code
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'inventory') renderInventory();
  else if (currentView === 'stockout') renderStockOut();
  else if (currentView === 'ledger') renderLedger();
  else if (currentView === 'settings') renderSettings();
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openStockInModal(presetItemId = null) {
  verifyPIN("Add Stock", () => {
    const select = document.getElementById('stockInItem');
    select.innerHTML = '<option value="">-- Select Product --</option>' + 
      items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Current: ${i.quantity} ${i.unit})</option>`).join('');
    
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
  
  if (!itemId) { showToast('Please select an item', 'error'); return; }
  if (!quantity || quantity <= 0) { showToast('Please enter valid quantity', 'error'); return; }
  
  addStock(itemId, quantity, unit, cost, expiryDate, note);
  closeStockInModal();
}

function openStockOutModal(presetItemId = null) {
  const select = document.getElementById('stockOutItem');
  select.innerHTML = '<option value="">-- Select Item --</option>' + 
    items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${escapeHtml(i.name)} (Available: ${i.quantity} ${i.unit})</option>`).join('');
  
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
// INITIALIZATION - LOADS CSV ON START
// ============================================

async function init() {
  loadData();
  loadTheme();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Try to load CSV first
  await loadCSVFromFile();
  
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
window.reloadCSV = reloadCSV;
window.exportInventoryToCSV = exportInventoryToCSV;
window.exportTransactionsToCSV = exportTransactionsToCSV;

init();
