// Modern search with button
function attachModernSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const clearBtn = document.getElementById('clearSearchBtn');
  
  if (searchInput) {
    // Remove existing listeners
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    // Search on Enter key
    newSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch(newSearchInput.value);
      }
    });
    
    // Real-time search as you type (optional - for instant results)
    newSearchInput.addEventListener('input', (e) => {
      performSearch(e.target.value);
    });
  }
  
  if (searchButton) {
    const newSearchButton = searchButton.cloneNode(true);
    searchButton.parentNode.replaceChild(newSearchButton, searchButton);
    newSearchButton.addEventListener('click', () => {
      const input = document.getElementById('searchInput');
      if (input) performSearch(input.value);
    });
  }
}

function performSearch(query) {
  searchTerm = query;
  
  // Update clear button visibility
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) {
    if (searchTerm.length > 0) {
      clearBtn.classList.add('visible');
    } else {
      clearBtn.classList.remove('visible');
    }
  }
  
  // Update search stats
  const filtered = filterItems();
  const statsSpan = document.getElementById('searchStats');
  if (statsSpan) {
    statsSpan.innerHTML = `${filtered.length} of ${items.length} items`;
  }
  
  // Re-render current view
  renderCurrentView();
}

function clearSearch() {
  searchTerm = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    performSearch('');
  }
}
