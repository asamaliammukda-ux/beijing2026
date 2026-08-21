/**
 * Personal Trip Planner SPA - Core Application Logic
 * Vanilla JavaScript (ES6+) with Promise.all() Concurrent Data Loading,
 * LocalStorage Persistence & Light/Dark Theme Switcher.
 */

(function () {
  'use strict';

  // State Management
  const state = {
    itinerary: [],
    restaurants: [],
    budget: [],
    checklist: {},
    activeSection: 'itinerary-section',
    restaurantView: 'grid', // 'grid' | 'list'
    activeDayFilter: 'ALL',
    activeBudgetFilter: 'ALL',
    searchQuery: '',
    targetDepartureDate: new Date('2026-12-29T08:00:00+08:00') // Target departure date: Dec 29, 2026
  };

  // DOM Elements Cache
  const elements = {
    cdDays: document.getElementById('cd-days'),
    cdHours: document.getElementById('cd-hours'),
    cdMinutes: document.getElementById('cd-minutes'),
    cdSeconds: document.getElementById('cd-seconds'),
    navTabs: document.querySelectorAll('.nav-tab-btn'),
    sections: document.querySelectorAll('.content-section'),
    searchInput: document.getElementById('searchInput'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    filterBar: document.getElementById('filterBar'),
    itineraryContainer: document.getElementById('itinerary-timeline-wrapper'),
    restaurantsGrid: document.getElementById('restaurants-grid-wrapper'),
    budgetContainer: document.getElementById('budget-container'),
    gridViewBtn: document.getElementById('gridViewBtn'),
    listViewBtn: document.getElementById('listViewBtn'),
    checklistContainer: document.getElementById('checklist-container'),
    checklistProgressBar: document.getElementById('checklistProgressBar'),
    checklistProgressText: document.getElementById('checklistProgressText'),
    highlightsBadgeCount: document.getElementById('highlights-badge-count')
  };

  /* ==========================================================================
     1. INITIALIZATION & DATA FETCHING
     ========================================================================== */

  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
    initTheme();
    startCountdown();
    setupEventListeners();
    fetchAppData();
  }

  /* ==========================================================================
     2. THEME SWITCHER & LOCALSTORAGE PERSISTENCE
     ========================================================================== */

  function initTheme() {
    const savedTheme = localStorage.getItem('user-theme');
    let theme = 'dark'; // Default fallback

    if (savedTheme === 'light' || savedTheme === 'dark') {
      theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }

    setTheme(theme);

    // Listen for system color scheme changes if user hasn't set an explicit preference
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('user-theme')) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('user-theme', newTheme);
  }

  /**
   * Helper function to fetch and parse CSV file asynchronously using PapaParse
   * @param {string} url - The relative or absolute path to the CSV file
   * @returns {Promise<Array<Object>>} Parsed CSV rows as JavaScript objects
   */
  async function fetchAndParseCSV(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV file from ${url}: ${response.statusText}`);
    }
    const csvText = await response.text();
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            console.warn(`PapaParse warnings for ${url}:`, results.errors);
          }
          resolve(results.data);
        },
        error: (err) => reject(err)
      });
    });
  }

  /**
   * Fetch itinerary.csv, restaurants.csv, budget.csv, and checklist.json concurrently using Promise.all()
   */
  async function fetchAppData() {
    try {
      showLoadingState();

      const [itineraryData, restaurantsData, budgetData, checklistRes] = await Promise.all([
        fetchAndParseCSV('data/itinerary.csv'),
        fetchAndParseCSV('data/restaurants.csv'),
        fetchAndParseCSV('data/budget.csv'),
        fetch('data/checklist.json')
      ]);

      if (!checklistRes.ok) {
        throw new Error('Failed to load checklist.json file.');
      }

      state.itinerary = itineraryData;
      state.restaurants = restaurantsData;
      state.budget = budgetData;
      state.checklist = await checklistRes.json();

      // Update Highlights Count Badge
      if (elements.highlightsBadgeCount && state.itinerary.length) {
        elements.highlightsBadgeCount.textContent = `${state.itinerary.length} Activities • ${state.restaurants.length} Dining Spots`;
      }

      // Render App Components
      renderFilterBar();
      renderItinerary();
      renderRestaurants();
      renderBudget();
      renderChecklist();
      updateChecklistProgress();

    } catch (error) {
      console.error('Error fetching trip data:', error);
      showErrorState(error.message);
    }
  }

  /* ==========================================================================
     3. COUNTDOWN TIMER LOGIC
     ========================================================================== */

  function startCountdown() {
    function updateTimer() {
      const now = new Date().getTime();
      const distance = state.targetDepartureDate.getTime() - now;

      if (distance < 0) {
        elements.cdDays.textContent = '00';
        elements.cdHours.textContent = '00';
        elements.cdMinutes.textContent = '00';
        elements.cdSeconds.textContent = '00';
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      elements.cdDays.textContent = padZero(days);
      elements.cdHours.textContent = padZero(hours);
      elements.cdMinutes.textContent = padZero(minutes);
      elements.cdSeconds.textContent = padZero(seconds);
    }

    updateTimer();
    setInterval(updateTimer, 1000);
  }

  function padZero(num) {
    return num < 10 ? `0${num}` : num;
  }

  /* ==========================================================================
     4. EVENT HANDLERS & NAVIGATION TABS
     ========================================================================== */

  function setupEventListeners() {
    // Theme Toggle Button
    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Navigation Tabs
    elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-target');
        switchSection(targetId);
      });
    });

    // View Switcher for Restaurants
    elements.gridViewBtn.addEventListener('click', () => {
      state.restaurantView = 'grid';
      elements.gridViewBtn.classList.add('active');
      elements.listViewBtn.classList.remove('active');
      elements.restaurantsGrid.classList.remove('list-view');
    });

    elements.listViewBtn.addEventListener('click', () => {
      state.restaurantView = 'list';
      elements.listViewBtn.classList.add('active');
      elements.gridViewBtn.classList.remove('active');
      elements.restaurantsGrid.classList.add('list-view');
    });

    // Real-time Search Input
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderItinerary();
      renderRestaurants();
      renderBudget();
    });
  }

  function switchSection(targetId) {
    state.activeSection = targetId;

    elements.navTabs.forEach(tab => {
      if (tab.getAttribute('data-target') === targetId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    elements.sections.forEach(sec => {
      if (sec.id === targetId) {
        sec.style.display = 'block';
      } else {
        sec.style.display = 'none';
      }
    });

    // Toggle filter bar visibility based on section
    if (targetId === 'checklist-section') {
      elements.filterBar.style.display = 'none';
    } else {
      elements.filterBar.style.display = 'flex';
      renderFilterBar();
    }
  }

  /* ==========================================================================
     5. FILTER BAR RENDERER
     ========================================================================== */

  function renderFilterBar() {
    elements.filterBar.innerHTML = '';

    if (state.activeSection === 'itinerary-section') {
      // Get unique Days
      const days = ['ALL', ...new Set(state.itinerary.map(item => item.Date))];
      days.forEach(day => {
        const chip = document.createElement('button');
        chip.className = `filter-chip ${state.activeDayFilter === day ? 'active' : ''}`;
        chip.textContent = day === 'ALL' ? 'All Days' : day.split('-')[0].trim();
        chip.addEventListener('click', () => {
          state.activeDayFilter = day;
          renderFilterBar();
          renderItinerary();
        });
        elements.filterBar.appendChild(chip);
      });
    } else if (state.activeSection === 'restaurants-section') {
      // Get unique types
      const types = ['ALL', ...new Set(state.restaurants.map(item => item.Type.split('•')[0].trim()))];
      types.forEach(type => {
        const chip = document.createElement('button');
        chip.className = `filter-chip ${state.activeDayFilter === type ? 'active' : ''}`;
        chip.textContent = type === 'ALL' ? 'All Dining' : type;
        chip.addEventListener('click', () => {
          state.activeDayFilter = type;
          renderFilterBar();
          renderRestaurants();
        });
        elements.filterBar.appendChild(chip);
      });
    } else if (state.activeSection === 'budget-section') {
      // Get unique budget types
      const types = ['ALL', ...new Set(state.budget.map(item => item.Type).filter(Boolean))];
      types.forEach(type => {
        const chip = document.createElement('button');
        chip.className = `filter-chip ${state.activeBudgetFilter === type ? 'active' : ''}`;
        chip.textContent = type === 'ALL' ? 'All Expenses' : type;
        chip.addEventListener('click', () => {
          state.activeBudgetFilter = type;
          renderFilterBar();
          renderBudget();
        });
        elements.filterBar.appendChild(chip);
      });
    }
  }

  /* ==========================================================================
     6. ITINERARY RENDERER (VERTICAL TIMELINE)
     ========================================================================== */

  function renderItinerary() {
    let filtered = state.itinerary;

    // Filter by Day
    if (state.activeDayFilter !== 'ALL') {
      filtered = filtered.filter(item => item.Date === state.activeDayFilter);
    }

    // Filter by Search Query
    if (state.searchQuery) {
      filtered = filtered.filter(item => 
        (item.Topic && item.Topic.toLowerCase().includes(state.searchQuery)) ||
        (item.Detail && item.Detail.toLowerCase().includes(state.searchQuery)) ||
        (item.Date && item.Date.toLowerCase().includes(state.searchQuery)) ||
        (item.Time && item.Time.toLowerCase().includes(state.searchQuery))
      );
    }

    if (filtered.length === 0) {
      elements.itineraryContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <p>No itinerary activities match your search criteria.</p>
        </div>
      `;
      return;
    }

    // Group items by Date
    const grouped = {};
    filtered.forEach(item => {
      if (!grouped[item.Date]) grouped[item.Date] = [];
      grouped[item.Date].push(item);
    });

    let html = '';

    for (const [date, items] of Object.entries(grouped)) {
      html += `
        <div class="timeline-day-group">
          <div class="timeline-day-header">
            <span class="timeline-day-dot"></span>
            <span class="timeline-day-title">${escapeHTML(date)}</span>
          </div>
          <div class="timeline-items-wrapper">
      `;

      items.forEach(item => {
        const hasImage = Boolean(item.Image && typeof item.Image === 'string' && item.Image.trim() !== '');
        const hasAmap = Boolean(item.Amap && typeof item.Amap === 'string' && item.Amap.trim() !== '');
        const hasTimeSpent = Boolean(item.Time_spent && typeof item.Time_spent === 'string' && item.Time_spent.trim() !== '' && item.Time_spent.trim() !== '-');

        const topicText = (item.Topic && typeof item.Topic === 'string' && item.Topic.trim() !== '')
          ? item.Topic.trim()
          : (item.Detail && typeof item.Detail === 'string' ? item.Detail.trim() : '');

        const detailText = (item.Topic && item.Detail && typeof item.Detail === 'string' && item.Detail.trim() !== '' && item.Detail.trim() !== item.Topic.trim())
          ? item.Detail.trim()
          : '';

        const hasDetail = Boolean(detailText !== '');

        const imageHTML = hasImage ? `
          <div class="timeline-thumb-wrapper">
            <img src="${escapeHTML(item.Image.trim())}" alt="${escapeHTML(topicText || 'Itinerary activity')}" class="timeline-thumb" loading="lazy" onerror="this.onerror=null; if(this.closest('.timeline-card')) { this.closest('.timeline-card').classList.remove('has-image'); this.closest('.timeline-card').classList.add('no-image'); } if(this.parentNode) this.parentNode.remove();">
          </div>
        ` : '';

        const amapHTML = hasAmap ? `
          <a href="${escapeHTML(item.Amap.trim())}" target="_blank" rel="noopener noreferrer" class="amap-pill-btn" title="Open in Amap (高德地图)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Amap
          </a>
        ` : '';

        html += `
          <div class="timeline-card ${hasImage ? 'has-image' : 'no-image'}">
            ${imageHTML}
            <div class="timeline-card-content">
              <div class="timeline-card-meta">
                <span class="time-pill">${escapeHTML(item.Time)}</span>
                ${hasTimeSpent ? `
                <span class="duration-pill">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ${escapeHTML(item.Time_spent)}
                </span>
                ` : ''}
                ${amapHTML}
              </div>
              <h3 class="timeline-topic-title">${escapeHTML(topicText)}</h3>
              ${hasDetail ? `<p class="timeline-detail-desc">${escapeHTML(detailText)}</p>` : ''}
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    elements.itineraryContainer.innerHTML = html;
  }

  /* ==========================================================================
     7. RESTAURANTS RENDERER (CARDS GRID/LIST)
     ========================================================================== */

  function renderRestaurants() {
    let filtered = state.restaurants;

    // Filter by Type
    if (state.activeDayFilter !== 'ALL') {
      filtered = filtered.filter(item => (item.Type || '').toLowerCase().includes(state.activeDayFilter.toLowerCase()));
    }

    // Filter by Search Query
    if (state.searchQuery) {
      filtered = filtered.filter(item => 
        (item.List && item.List.toLowerCase().includes(state.searchQuery)) ||
        (item.Story && item.Story.toLowerCase().includes(state.searchQuery)) ||
        (item.Food && item.Food.toLowerCase().includes(state.searchQuery)) ||
        (item.Menu && item.Menu.toLowerCase().includes(state.searchQuery)) ||
        (item.Recommended_Day && item.Recommended_Day.toLowerCase().includes(state.searchQuery)) ||
        (item.Address && item.Address.toLowerCase().includes(state.searchQuery))
      );
    }

    if (filtered.length === 0) {
      elements.restaurantsGrid.innerHTML = `
        <div style="text-align: center; grid-column: 1/-1; padding: 3rem; color: var(--text-muted);">
          <p>No dining spots match your search criteria.</p>
        </div>
      `;
      return;
    }

    let html = '';

    filtered.forEach(item => {
      const hasImage = Boolean(item.Image && typeof item.Image === 'string' && item.Image.trim() !== '');
      const hasAmap = Boolean(item.Amap && typeof item.Amap === 'string' && item.Amap.trim() !== '');
      const hasPrice = Boolean(item.Price && typeof item.Price === 'string' && item.Price.trim() !== '');
      const hasType = Boolean(item.Type && typeof item.Type === 'string' && item.Type.trim() !== '');

      const storyText = (item.Story && typeof item.Story === 'string' && item.Story.trim() !== '') 
        ? item.Story.trim() 
        : (item.Food && typeof item.Food === 'string' ? item.Food.trim() : '');

      const menuText = (item.Menu && typeof item.Menu === 'string') ? item.Menu.trim() : '';
      const recommendedDayText = (item.Recommended_Day && typeof item.Recommended_Day === 'string') ? item.Recommended_Day.trim() : '';

      const imageHTML = hasImage ? `
        <div class="restaurant-img-wrapper">
          <img src="${escapeHTML(item.Image.trim())}" alt="${escapeHTML(item.List || 'Restaurant spot')}" class="restaurant-img" loading="lazy" onerror="this.onerror=null; if(this.closest('.restaurant-card')) { this.closest('.restaurant-card').classList.remove('has-image'); this.closest('.restaurant-card').classList.add('no-image'); } if(this.parentNode) this.parentNode.remove();">
          ${hasPrice ? `<span class="price-badge">${escapeHTML(item.Price)}</span>` : ''}
          ${hasType ? `<span class="type-badge">${escapeHTML(item.Type)}</span>` : ''}
        </div>
      ` : '';

      const inlineBadgesHTML = (!hasImage && (hasPrice || hasType)) ? `
        <div class="restaurant-badges-inline">
          ${hasPrice ? `<span class="price-badge-inline">${escapeHTML(item.Price)}</span>` : ''}
          ${hasType ? `<span class="type-badge-inline">${escapeHTML(item.Type)}</span>` : ''}
        </div>
      ` : '';

      const amapHTML = hasAmap ? `
        <a href="${escapeHTML(item.Amap.trim())}" target="_blank" rel="noopener noreferrer" class="amap-btn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Location (Amap)
        </a>
      ` : '';

      html += `
        <div class="restaurant-card ${hasImage ? 'has-image' : 'no-image'}">
          ${imageHTML}
          <div class="restaurant-info">
            <div class="restaurant-content-top">
              ${inlineBadgesHTML}
              <h3 class="restaurant-name">${escapeHTML(item.List)}</h3>
              
              ${recommendedDayText !== '' ? `
              <div class="restaurant-day-chip">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span><strong>วันที่แนะนำ:</strong> ${escapeHTML(recommendedDayText)}</span>
              </div>
              ` : ''}

              ${storyText !== '' ? `
              <div class="restaurant-story-block">
                <span class="restaurant-block-label">🏛️ จุดเด่น & ความนิยม:</span>
                <p class="restaurant-story-text">${escapeHTML(storyText)}</p>
              </div>
              ` : ''}

              ${menuText !== '' ? `
              <div class="restaurant-menu-block">
                <span class="restaurant-block-label">⭐ เมนูแนะนำห้ามพลาด:</span>
                <p class="restaurant-menu-text">${escapeHTML(menuText)}</p>
              </div>
              ` : ''}
            </div>

            <div class="restaurant-footer-row">
              ${(item.Address && item.Address.trim() !== '') ? `
              <p class="restaurant-address">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                ${escapeHTML(item.Address)}
              </p>
              ` : ''}
              ${amapHTML}
            </div>
          </div>
        </div>
      `;
    });

    elements.restaurantsGrid.innerHTML = html;
  }

  /* ==========================================================================
     8. BUDGET RENDERER (SUMMARY METRICS, BANNER & RESPONSIVE TABLE)
     ========================================================================== */

  function renderBudget() {
    if (!elements.budgetContainer) return;

    let filtered = state.budget;

    // Filter by Type
    if (state.activeBudgetFilter !== 'ALL') {
      filtered = filtered.filter(item => (item.Type || '').toLowerCase() === state.activeBudgetFilter.toLowerCase());
    }

    // Filter by Search Query
    if (state.searchQuery) {
      filtered = filtered.filter(item => 
        (item.Item && item.Item.toLowerCase().includes(state.searchQuery)) ||
        (item.Type && item.Type.toLowerCase().includes(state.searchQuery)) ||
        (item.Note && item.Note.toLowerCase().includes(state.searchQuery))
      );
    }

    // Calculations
    const totalTHB = filtered.reduce((acc, row) => {
      const val = parseFloat(String(row['Price (THB)'] || '').replace(/[^0-9.-]+/g, '')) || 0;
      return acc + val;
    }, 0);

    const totalCNY = filtered.reduce((acc, row) => {
      const val = parseFloat(String(row['Price (CNY)'] || '').replace(/[^0-9.-]+/g, '')) || 0;
      return acc + val;
    }, 0);

    let html = `
      <!-- Exchange Rate Reference Banner -->
      <div class="exchange-rate-banner">
        <div class="rate-left">
          <div class="rate-icon-badge">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h4 class="rate-title">Exchange Rate Reference</h4>
            <p class="rate-subtitle">Benchmark Currency Ratio: <strong>1 CNY ≈ 4.91 THB</strong> &nbsp;|&nbsp; <strong>1 THB ≈ 0.204 CNY</strong></p>
          </div>
        </div>
        <div class="rate-pills-wrap">
          <span class="rate-pill-flag">🇨🇳 1 CNY = ฿4.91 THB</span>
          <span class="rate-pill-flag">🇹🇭 100 THB = ¥20.37 CNY</span>
        </div>
      </div>

      <!-- Budget Summary Cards -->
      <div class="budget-summary-grid">
        <div class="budget-summary-card card-thb">
          <div class="summary-top">
            <span class="summary-label">Total Estimated (THB)</span>
            <span class="currency-badge thb">THB (฿)</span>
          </div>
          <div class="summary-amount">฿${totalTHB.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div class="summary-note">Thai Baht total estimated expenditure</div>
        </div>

        <div class="budget-summary-card card-cny">
          <div class="summary-top">
            <span class="summary-label">Total Estimated (CNY)</span>
            <span class="currency-badge cny">CNY (¥)</span>
          </div>
          <div class="summary-amount">¥${totalCNY.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div class="summary-note">Chinese Yuan (RMB) equivalent</div>
        </div>

        <div class="budget-summary-card card-count">
          <div class="summary-top">
            <span class="summary-label">Filtered Items</span>
            <span class="currency-badge count">LEDGER</span>
          </div>
          <div class="summary-amount">${filtered.length} <span class="summary-subtext">Expenses</span></div>
          <div class="summary-note">Active budget category records</div>
        </div>
      </div>
    `;

    if (filtered.length === 0) {
      html += `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); margin-top: 1rem;">
          <p>No budget items match your search or filter criteria.</p>
        </div>
      `;
      elements.budgetContainer.innerHTML = html;
      return;
    }

    html += `
      <!-- Desktop & Tablet Budget Table Container -->
      <div class="budget-table-container">
        <table class="budget-table">
          <thead>
            <tr>
              <th style="width: 28%;">Item & Description</th>
              <th style="width: 16%;">Type</th>
              <th style="width: 16%; text-align: right;">Price (THB)</th>
              <th style="width: 16%; text-align: right;">Price (CNY)</th>
              <th style="width: 24%;">Note / Booking Info</th>
            </tr>
          </thead>
          <tbody>
    `;

    filtered.forEach(item => {
      const priceTHB = parseFloat(String(item['Price (THB)'] || '').replace(/[^0-9.-]+/g, '')) || 0;
      const priceCNY = parseFloat(String(item['Price (CNY)'] || '').replace(/[^0-9.-]+/g, '')) || 0;
      const badgeClass = getBudgetTypeBadgeClass(item.Type);

      html += `
        <tr>
          <td class="budget-item-col">
            <span class="budget-item-name">${escapeHTML(item.Item)}</span>
          </td>
          <td>
            <span class="budget-type-badge ${badgeClass}">${escapeHTML(item.Type)}</span>
          </td>
          <td class="budget-price-thb">
            ฿${priceTHB.toLocaleString('th-TH')}
          </td>
          <td class="budget-price-cny">
            ¥${priceCNY.toLocaleString('zh-CN')}
          </td>
          <td class="budget-note-col">
            ${escapeHTML(item.Note || '-')}
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>

      <!-- Mobile Budget Cards View (Visible on Small Screens) -->
      <div class="budget-mobile-cards">
    `;

    filtered.forEach(item => {
      const priceTHB = parseFloat(String(item['Price (THB)'] || '').replace(/[^0-9.-]+/g, '')) || 0;
      const priceCNY = parseFloat(String(item['Price (CNY)'] || '').replace(/[^0-9.-]+/g, '')) || 0;
      const badgeClass = getBudgetTypeBadgeClass(item.Type);

      html += `
        <div class="budget-mobile-card">
          <div class="mobile-card-top">
            <span class="budget-item-name">${escapeHTML(item.Item)}</span>
            <span class="budget-type-badge ${badgeClass}">${escapeHTML(item.Type)}</span>
          </div>
          <div class="mobile-card-prices">
            <div class="price-chip-thb">
              <span class="price-label">THB</span>
              <span class="price-val">฿${priceTHB.toLocaleString('th-TH')}</span>
            </div>
            <div class="price-chip-cny">
              <span class="price-label">CNY</span>
              <span class="price-val">¥${priceCNY.toLocaleString('zh-CN')}</span>
            </div>
          </div>
          ${item.Note ? `<p class="mobile-card-note">${escapeHTML(item.Note)}</p>` : ''}
        </div>
      `;
    });

    html += `
      </div>
    `;

    elements.budgetContainer.innerHTML = html;
  }

  function getBudgetTypeBadgeClass(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('flight')) return 'type-flights';
    if (t.includes('hotel') || t.includes('accom')) return 'type-hotel';
    if (t.includes('attract')) return 'type-attraction';
    if (t.includes('food') || t.includes('din')) return 'type-dining';
    if (t.includes('trans')) return 'type-transport';
    if (t.includes('shop')) return 'type-shopping';
    return 'type-misc';
  }

  /* ==========================================================================
     9. CHECKLIST RENDERER & LOCALSTORAGE PERSISTENCE
     ========================================================================== */

  function renderChecklist() {
    if (!state.checklist.checklist_sections) return;

    let html = '';

    state.checklist.checklist_sections.forEach(category => {
      html += `
        <div class="checklist-category-card">
          <div class="category-header">
            <div class="category-icon-box">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="category-title">${escapeHTML(category.category_name)}</h3>
          </div>
      `;

      category.groups.forEach(group => {
        html += `
          <div class="checklist-group">
            <div class="group-name">${escapeHTML(group.group_name)}</div>
            <div class="checklist-items-list">
        `;

        group.items.forEach(item => {
          const isChecked = getStoredCheckState(item.id);

          html += `
            <div class="checklist-item ${isChecked ? 'checked' : ''}" data-id="${escapeHTML(item.id)}">
              <div class="custom-checkbox-wrapper">
                <input type="checkbox" id="${escapeHTML(item.id)}" class="hidden-checkbox" ${isChecked ? 'checked' : ''}>
                <div class="custom-checkbox-box">
                  <svg class="checkbox-check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div class="checklist-item-body">
                <div class="task-title-row">
                  <span class="task-title">${escapeHTML(item.task)}</span>
                  <span class="badge-tag ${escapeHTML(item.badge_type || 'info')}">${escapeHTML(item.badge_text)}</span>
                </div>
                <div class="task-notes-row">
                  ${(item.time_note && item.time_note.trim() !== '') ? `
                  <div class="note-item">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ${escapeHTML(item.time_note)}
                  </div>
                  ` : ''}
                  ${(item.channel_note && item.channel_note.trim() !== '') ? `
                  <div class="note-item">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    ${escapeHTML(item.channel_note)}
                  </div>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      html += `
        </div>
      `;
    });

    elements.checklistContainer.innerHTML = html;

    // Attach Click Event Handlers to Checklist Items
    document.querySelectorAll('.checklist-item').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = card.getAttribute('data-id');
        const checkbox = card.querySelector('.hidden-checkbox');

        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }

        const isChecked = checkbox.checked;
        saveCheckState(id, isChecked);

        if (isChecked) {
          card.classList.add('checked');
        } else {
          card.classList.remove('checked');
        }

        updateChecklistProgress();
      });
    });
  }

  /**
   * LocalStorage Helpers for Checklist
   */
  function getStoredCheckState(id) {
    try {
      return localStorage.getItem(`trip_checklist_${id}`) === 'true';
    } catch (e) {
      return false;
    }
  }

  function saveCheckState(id, isChecked) {
    try {
      localStorage.setItem(`trip_checklist_${id}`, isChecked ? 'true' : 'false');
    } catch (e) {
      console.warn('LocalStorage unavailable or restricted:', e);
    }
  }

  function updateChecklistProgress() {
    let totalItems = 0;
    let checkedItems = 0;

    if (!state.checklist.checklist_sections) return;

    state.checklist.checklist_sections.forEach(cat => {
      cat.groups.forEach(group => {
        group.items.forEach(item => {
          totalItems++;
          if (getStoredCheckState(item.id)) {
            checkedItems++;
          }
        });
      });
    });

    const percentage = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

    if (elements.checklistProgressBar) {
      elements.checklistProgressBar.style.width = `${percentage}%`;
    }

    if (elements.checklistProgressText) {
      elements.checklistProgressText.textContent = `${checkedItems} / ${totalItems} Completed (${percentage}%)`;
    }
  }

  /* ==========================================================================
     9. UTILITIES
     ========================================================================== */

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showLoadingState() {
    if (elements.itineraryContainer) elements.itineraryContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading itinerary data...</div>`;
    if (elements.restaurantsGrid) elements.restaurantsGrid.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading restaurant data...</div>`;
    if (elements.budgetContainer) elements.budgetContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading budget data...</div>`;
  }

  function showErrorState(msg) {
    if (elements.itineraryContainer) elements.itineraryContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--badge-danger-text);">Error loading data: ${escapeHTML(msg)}</div>`;
    if (elements.budgetContainer) elements.budgetContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--badge-danger-text);">Error loading data: ${escapeHTML(msg)}</div>`;
  }

})();
