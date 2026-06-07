// ============================================
// STOCKFLOW ERP SYSTEM - COMPLETE
// Modern Inventory Management
// ============================================

// Data Storage
let users = [
  { id: 1, name: "Admin User", email: "admin@stockflow.com", password: "admin123", role: "admin" },
  { id: 2, name: "Staff User", email: "staff@stockflow.com", password: "staff123", role: "staff" }
];

let items = [
  { id: "1", name: "Premium Rice", quantity: 150, unit: "KG", cost: 2.5, expiryDate: "2025-12-31", minStock: 50 },
  { id: "2", name: "Olive Oil", quantity: 45, unit: "L", cost: 8.99, expiryDate: "2025-06-15", minStock: 20 },
  { id: "3", name: "Coffee Beans", quantity: 12, unit: "KG", cost: 15.5, expiryDate: "2024-12-01", minStock: 15 },
  { id: "4", name: "Tomato Sauce", quantity: 8, unit: "BOX", cost: 12.0, expiryDate: "2024-10-10", minStock: 10 },
  { id: "5", name: "Pasta", quantity: 200, unit: "PCS", cost: 1.2, expiryDate: "2025-09-20", minStock: 50 }
];

let transactions = [
  { id: "t1", type: "IN", itemId: "1", itemName: "Premium Rice", quantity: 50, unit: "KG", cost: 2.5, timestamp: new Date().toISOString(), note: "Initial stock" },
  { id: "t2", type: "OUT", itemId: "3", itemName: "Coffee Beans", quantity: 5, unit: "KG", reason: "Sold", timestamp: new Date(Date.now() - 86400000).toISOString(), note: "Customer order" }
];

let currentUser = null;
let currentView = "dashboard";
let darkMode = false;

// ============================================
// AUTO LOAD CSV FROM GITHUB
// ============================================

async function autoLoadCSV() {
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
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          let importedCount = 0;
          for (const row of results.data) {
            const name = row.Name || row.name || row.item_name;
            const unit = (row.Unit || row.unit || "PCS").toUpperCase();
            const cost = parseFloat(row.Price || row.price || row.Cost || row.cost || 0);
            const quantity = parseFloat(row.Stock || row.stock || row.Quantity || row.quantity || 0);
            const expiryDate = row.ExpiryDate || row.expiry_date || row.Expiry || "";
            const minStock = parseInt(row.MinStock || row.minStock || 5);
            
            if (!name) continue;
            
            const existingItem = items.find(i => i.name.toLowerCase() === name.toLowerCase());
            
            if (existingItem) {
              existingItem.cost = cost || existingItem.cost;
              existingItem.unit = unit || existingItem.unit;
              existingItem.minStock = minStock || existingItem.minStock;
              if (expiryDate) existingItem.expiryDate = expiryDate;
            } else {
              const newId = "item_" + Date.now() + "_" + Math.random();
              items.push({
                id: newId,
                name: name,
                quantity: quantity,
                unit: unit,
                cost: cost,
                expiryDate: expiryDate,
                minStock: minStock || 5
              });
            }
            importedCount++;
          }
          saveData();
          renderCurrentView();
          showToast(`Loaded ${importedCount} items from CSV`, 'success');
        }
      });
    }
  } catch (error) {
    console.error("CSV Error:", error);
  }
}

// ============================================
// AUTHENTICATION
// ============================================

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  
  if (tab === 'login') {
    document.querySelector('.auth-tab:first-child').classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else {
    document.querySelector('.auth-tab:last-child').classList.add('active');
    document.getElementById('signupForm').classList.add('active');
  }
}

function handleLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    updateUserDisplay();
    renderCurrentView();
    showToast(`Welcome back, ${user.name}!`, 'success');
  } else {
    showToast('Invalid credentials', 'error');
  }
}

function handleSignup() {
  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const role = document.getElementById('signupRole').value;
  
  if (!name || !email || !password) {
    showToast('Please fill all fields', 'error');
    return;
  }
  
  if (users.find(u => u.email === email)) {
    showToast('Email already exists', 'error');
    return;
  }
  
  const newUser = {
    id: users.length + 1,
    name,
    email,
    password,
    role
  };
  
  users.push(newUser);
  saveData();
  showToast('Account created! Please login.', 'success');
  switchAuthTab('login');
}

function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  document.getElementById('authModal').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  showToast('Logged out successfully', 'success');
}

function updateUserDisplay() {
  if (currentUser) {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.role === 'admin' ? 'Administrator' : 'Staff Member';
    document.getElementById('userAvatar').innerText = currentUser.name.charAt(0);
  }
}

function isAdmin() {
  return currentUser?.role === 'admin';
}

// ============================================
// INVENTORY FUNCTIONS
// ============================================

function getItemStock(itemId) {
  const item = items.find(i => i.id === itemId);
  return item ? item.quantity : 0;
}

function updateStock(itemId, quantity, type, cost, reason, note, expiryDate) {
  const item = items.find(i => i.id === itemId);
  if (!item) return false;
  
  if (type === 'OUT' && quantity > item.quantity) {
    showToast(`Insufficient stock! Only ${item.quantity} ${item.unit} available`, 'error');
    return false;
  }
  
  // Update stock
  if (type === 'IN') {
    item.quantity += quantity;
    if (cost) item.cost = cost;
    if (expiryDate) item.expiryDate = expiryDate;
  } else {
    item.quantity -= quantity;
  }
  
  // Record transaction
  const transaction = {
    id: Date.now().toString(),
    type,
    itemId: item.id,
    itemName: item.name,
    quantity,
    unit: item.unit,
    cost: type === 'IN' ? cost : item.cost,
    timestamp: new Date().toISOString(),
    note: note || '',
    reason: reason || null
  };
  
  transactions.unshift(transaction);
  saveData();
  renderCurrentView();
  showToast(`${type === 'IN' ? 'Stock IN' : 'Stock OUT'} successful!`, 'success');
  return true;
}

function getStockStatus(item) {
  if (item.quantity <= 0) return { class: 'status-expired', text: 'Out of Stock' };
  if (item.quantity < item.minStock) return { class: 'status-low', text: 'Low Stock' };
  if (item.expiryDate && new Date(item.expiryDate) < new Date()) return { class: 'status-expired', text: 'Expired' };
  return { class: 'status-ok', text: 'In Stock' };
}

function getExpiringItems() {
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  return items.filter(item => {
    if (!item.expiryDate) return false;
    const expiryDate = new Date(item.expiryDate);
    return expiryDate <= thirtyDaysFromNow && expiryDate >= today && item.quantity > 0;
  });
}

// ============================================
// UI RENDERING
// ============================================

function renderDashboard() {
  const totalItems = items.length;
  const totalStock = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
  const lowStockCount = items.filter(i => i.quantity < i.minStock).length;
  const expiringItems = getExpiringItems();
  
  const recentTransactions = transactions.slice(0, 10);
  
  const html = `
    <div class="stats-grid">
      <div class="stat-card" onclick="switchView('inventory')">
        <div class="stat-header">
          <span>Total Items</span>
          <div class="stat-icon"><i class="fas fa-box"></i></div>
        </div>
        <div class="stat-value">${totalItems}</div>
        <div class="stat-label">Active SKUs</div>
      </div>
      <div class="stat-card" onclick="switchView('inventory')">
        <div class="stat-header">
          <span>Total Stock</span>
          <div class="stat-icon"><i class="fas fa-warehouse"></i></div>
        </div>
        <div class="stat-value">${totalStock}</div>
        <div class="stat-label">Units in Inventory</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>Total Value</span>
          <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
        </div>
        <div class="stat-value">$${totalValue.toLocaleString()}</div>
        <div class="stat-label">Inventory Value</div>
      </div>
      <div class="stat-card" onclick="switchView('inventory')">
        <div class="stat-header">
          <span>Low Stock Alert</span>
          <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
        </div>
        <div class="stat-value" style="color: ${lowStockCount > 0 ? '#f59e0b' : '#10b981'}">${lowStockCount}</div>
        <div class="stat-label">Items below minimum</div>
      </div>
    </div>
    
    ${expiringItems.length > 0 ? `
    <div class="section-header">
      <h2><i class="fas fa-clock"></i> Expiry Alerts</h2>
    </div>
    <div class="cards-grid" style="margin-bottom: 1.5rem;">
      ${expiringItems.map(item => {
        const daysLeft = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        const alertClass = daysLeft <= 7 ? 'danger' : 'warning';
        return `
          <div class="alert-item ${alertClass}">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <div>Expires in ${daysLeft} days (${item.expiryDate})</div>
            </div>
            <div>${item.quantity} ${item.unit}</div>
          </div>
        `;
      }).join('')}
    </div>
    ` : ''}
    
    <div class="section-header">
      <h2><i class="fas fa-boxes"></i> Recent Items</h2>
      <button class="btn btn-primary" onclick="switchView('inventory')">View All</button>
    </div>
    
    <div class="cards-grid">
      ${items.slice(0, 6).map(item => {
        const status = getStockStatus(item);
        return `
          <div class="inventory-card" onclick="openStockOutModal('${item.id}')">
            <div class="card-header">
              <span class="item-name">${escapeHtml(item.name)}</span>
              <span class="item-price">$${item.cost}</span>
            </div>
            <div class="card-details">
              <span>Stock: ${item.quantity} ${item.unit}</span>
              <span>Expiry: ${item.expiryDate || 'N/A'}</span>
            </div>
            <div>
              <span class="stock-status ${status.class}">${status.text}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    
    <div class="section-header">
      <h2><i class="fas fa-history"></i> Recent Activity</h2>
      <button class="btn btn-primary" onclick="switchView('ledger')">View All</button>
    </div>
    
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr><th>Type</th><th>Item</th><th>Quantity</th><th>Date</th><th>Reference</th></tr>
        </thead>
        <tbody>
          ${recentTransactions.map(t => `
            <tr>
              <td><span class="badge ${t.type === 'IN' ? 'badge-in' : 'badge-out'}">${t.type}</span></td>
              <td>${escapeHtml(t.itemName)}</
