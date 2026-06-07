.search-section {
  margin-bottom: 1.5rem;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--card-light);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.5rem 1rem;
  transition: all 0.2s;
}

body.dark .search-wrapper {
  background: var(--card-dark);
}

.search-wrapper:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
}

.search-wrapper i {
  color: var(--gray);
  margin-right: 0.75rem;
}

.search-input {
  flex: 1;
  border: none;
  background: none;
  padding: 0.5rem 0;
  font-size: 0.9rem;
  outline: none;
  color: var(--text-light);
}

body.dark .search-input {
  color: var(--text-dark);
}

.clear-search {
  background: none;
  border: none;
  color: var(--gray);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem 0.5rem;
  border-radius: 50%;
  transition: all 0.2s;
}

.clear-search:hover {
  background: rgba(0,0,0,0.05);
  color: var(--danger);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--gray);
}

.text-center {
  text-align: center;
}
