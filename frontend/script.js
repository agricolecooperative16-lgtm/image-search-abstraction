// Configuration
const API_BASE = '/api';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const recentBtn = document.getElementById('recentBtn');
const clearBtn = document.getElementById('clearBtn');
const resultsContainer = document.getElementById('resultsContainer');
const statusMessage = document.getElementById('statusMessage');
const pagination = document.getElementById('pagination');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

// State
let currentQuery = '';
let currentPage = 1;
let totalPages = 1;

// Search function
async function searchImages(query, page = 1) {
  if (!query.trim()) {
    showStatus('Please enter a search term', 'warning');
    return;
  }

  showLoading();

  try {
    const response = await fetch(`${API_BASE}/query/${encodeURIComponent(query)}?page=${page}`);
    
    if (!response.ok) throw new Error('Search failed');

    const data = await response.json();
    
    if (data.images && data.images.length > 0) {
      displayResults(data.images, query, data.page, data.totalPages);
    } else {
      showEmptyState(`No results found for "${query}"`);
    }
  } catch (error) {
    console.error('Search error:', error);
    showError('Failed to fetch images. Please try again.');
  }
}

// Display results
function displayResults(images, query, page, total) {
  currentPage = page || 1;
  totalPages = total || 1;

  resultsContainer.innerHTML = images.map(img => `
    <div class="image-card" onclick="window.open('${img.parentPage || img.url}', '_blank')">
      <img 
        src="${img.thumbnail || img.url}" 
        alt="${img.description || query}"
        loading="lazy"
        onerror="this.src='https://via.placeholder.com/250x200/1e293b/94a3b8?text=Image+Unavailable'"
      />
      <div class="card-content">
        <h4>${img.description || query}</h4>
        <div class="meta">
          <span><i class="fas fa-expand"></i> ${img.width || '?'}×${img.height || '?'}</span>
          <span><i class="fas fa-file"></i> ${formatSize(img.size || 0)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Update pagination
  updatePagination();
  showStatus(`Showing ${images.length} results for "${query}"`);
}

// Format file size
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Update pagination
function updatePagination() {
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= totalPages;
  } else {
    pagination.style.display = 'none';
  }
}

// Pagination handlers
prevPage.addEventListener('click', () => {
  if (currentPage > 1) {
    searchImages(currentQuery, currentPage - 1);
  }
});

nextPage.addEventListener('click', () => {
  if (currentPage < totalPages) {
    searchImages(currentQuery, currentPage + 1);
  }
});

// Recent searches
async function fetchRecent() {
  showLoading();

  try {
    const response = await fetch(`${API_BASE}/recent`);
    if (!response.ok) throw new Error('Failed to fetch recent searches');

    const data = await response.json();

    if (data.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-history"></i>
          <h3>No recent searches</h3>
          <p>Your recent searches will appear here</p>
        </div>
      `;
      showStatus('No recent searches found');
      return;
    }

    resultsContainer.innerHTML = data.map(item => `
      <div class="recent-search-item" onclick="searchImages('${item.searchQuery}', 1)">
        <span class="query"><i class="fas fa-search" style="color:#9146FF;margin-right:12px;"></i>${item.searchQuery}</span>
        <span class="time"><i class="far fa-clock"></i> ${item.timeSearched}</span>
      </div>
    `).join('');

    pagination.style.display = 'none';
    showStatus(`Showing ${data.length} recent searches`);
  } catch (error) {
    console.error('Recent searches error:', error);
    showError('Failed to fetch recent searches');
  }
}

// UI helpers
function showLoading() {
  resultsContainer.innerHTML = `
    <div class="loading">
      <i class="fas fa-spinner"></i>
      <p style="margin-top: 16px; color: #94a3b8;">Searching for images...</p>
    </div>
  `;
  statusMessage.textContent = '';
}

function showEmptyState(message) {
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-search"></i>
      <h3>${message}</h3>
      <p>Try a different search term</p>
    </div>
  `;
  pagination.style.display = 'none';
}

function showError(message) {
  resultsContainer.innerHTML = `
    <div class="empty-state" style="color: #ef4444;">
      <i class="fas fa-exclamation-circle"></i>
      <h3 style="color: #ef4444;">Error</h3>
      <p>${message}</p>
    </div>
  `;
  pagination.style.display = 'none';
}

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.style.color = type === 'warning' ? '#f59e0b' : '#94a3b8';
}

function clearSearch() {
  searchInput.value = '';
  currentQuery = '';
  currentPage = 1;
  clearBtn.classList.remove('visible');
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-images"></i>
      <h3>Search for images</h3>
      <p>Enter a search term to find images from across the web</p>
    </div>
  `;
  pagination.style.display = 'none';
  statusMessage.textContent = '';
  searchInput.focus();
}

// Event Listeners
searchBtn.addEventListener('click', () => {
  currentQuery = searchInput.value.trim();
  if (currentQuery) {
    searchImages(currentQuery, 1);
  } else {
    searchInput.focus();
  }
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchBtn.click();
  }
});

searchInput.addEventListener('input', () => {
  if (searchInput.value.trim()) {
    clearBtn.classList.add('visible');
  } else {
    clearBtn.classList.remove('visible');
  }
});

clearBtn.addEventListener('click', clearSearch);

recentBtn.addEventListener('click', fetchRecent);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  clearSearch();
});
