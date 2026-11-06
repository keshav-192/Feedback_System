<?php
if (basename($_SERVER['PHP_SELF']) === basename(__FILE__)) {
    header("HTTP/1.1 403 Forbidden");
    exit("Direct access not permitted.");
}
?>
      <!-- Select Form View -->
      <div id="analytics-select-form-view">
        <div class="search-container" style="margin-bottom: 24px; max-width: 600px; margin-left: auto; margin-right: auto;">
          <div class="admin-search-wrapper">
            <svg class="search-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input type="text" id="analytics-search-input" class="admin-search-input" placeholder="Search forms by name..." onkeyup="filterAnalyticsForms()" oninput="filterAnalyticsForms()">
            <svg class="clear-icon" id="clearAnalyticsSearch" onclick="clearAnalyticsSearchInput()" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: none;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </div>
        </div>

        <div class="forms-grid" id="analytics-forms-grid">
          <p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">Loading forms...</p>
        </div>
      </div>

      <!-- Analytics Dashboard View -->
      <div id="analytics-dashboard-view" style="display: none;">
        
        <!-- Action Toolbar -->
        <div class="analytics-toolbar">
          <div class="analytics-header-left">
            <button id="back-to-forms-btn" class="btn-back-nav" title="Back to All Forms">
              <span class="back-nav-icon-bubble">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path>
                </svg>
              </span>
              <span class="back-nav-text">Back to Forms</span>
            </button>
            <div class="analytics-nav-divider"></div>
            <div class="analytics-title-row">
              <h2 id="analytics-current-form-title" class="analytics-heading">Feedback Analytics</h2>
              <span class="analytics-badge-pill">
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                Analytics
              </span>
            </div>
          </div>

          <div class="analytics-toolbar-actions">
            <button id="open-filters-btn" class="btn-primary btn-toolbar-filter" title="Filter Responses">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
              <span>Filters</span>
            </button>
            <button id="export-excel-btn" class="btn-export btn-export-excel" title="Download raw submissions in Excel format (.xlsx)">
              <span class="export-icon-wrap excel-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                  <path d="M3 9h18M3 15h18M9 9v12M15 9v12"></path>
                </svg>
              </span>
              <span>Export Excel</span>
            </button>
            <button id="export-ppt-btn" class="btn-export btn-export-ppt" title="Download PowerPoint presentation report (.pptx)">
              <span class="export-icon-wrap ppt-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                  <path d="M8 21h8M12 17v4"></path>
                  <path d="M7 8h5a2 2 0 010 4H7z"></path>
                </svg>
              </span>
              <span>Export PPT</span>
            </button>
          </div>
        </div>

        <!-- Modern Date Range & Calendar Filter Bar -->
        <div class="analytics-date-bar" id="analytics-date-bar">
          <div class="date-bar-left">
            <div class="date-bar-label">
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6" stroke-width="2"></line>
                <line x1="8" y1="2" x2="8" y2="6" stroke-width="2"></line>
                <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"></line>
              </svg>
              <span>Date Range:</span>
            </div>

            <!-- Segmented Date Inputs (dd-mm-yyyy with interactive calendar picker) -->
            <div class="date-inputs-wrapper">
              <!-- From Date Box -->
              <div class="segmented-date-box" id="seg-box-from">
                <input type="text" inputmode="numeric" class="seg-input seg-day" id="from-day" placeholder="dd" maxlength="2" autocomplete="off" aria-label="From Day">
                <span class="seg-divider">-</span>
                <input type="text" inputmode="numeric" class="seg-input seg-month" id="from-month" placeholder="mm" maxlength="2" autocomplete="off" aria-label="From Month">
                <span class="seg-divider">-</span>
                <input type="text" inputmode="numeric" class="seg-input seg-year" id="from-year" placeholder="yyyy" maxlength="4" autocomplete="off" aria-label="From Year">
                
                <label for="native-picker-from" class="seg-cal-btn" title="Pick From Date from Calendar">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6" stroke-width="2"></line>
                    <line x1="8" y1="2" x2="8" y2="6" stroke-width="2"></line>
                    <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"></line>
                  </svg>
                  <input type="date" id="native-picker-from" class="native-hidden-date-picker" tabindex="-1">
                </label>
              </div>

              <span class="date-range-sep">to</span>

              <!-- To Date Box -->
              <div class="segmented-date-box" id="seg-box-to">
                <input type="text" inputmode="numeric" class="seg-input seg-day" id="to-day" placeholder="dd" maxlength="2" autocomplete="off" aria-label="To Day">
                <span class="seg-divider">-</span>
                <input type="text" inputmode="numeric" class="seg-input seg-month" id="to-month" placeholder="mm" maxlength="2" autocomplete="off" aria-label="To Month">
                <span class="seg-divider">-</span>
                <input type="text" inputmode="numeric" class="seg-input seg-year" id="to-year" placeholder="yyyy" maxlength="4" autocomplete="off" aria-label="To Year">
                
                <label for="native-picker-to" class="seg-cal-btn" title="Pick To Date from Calendar">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6" stroke-width="2"></line>
                    <line x1="8" y1="2" x2="8" y2="6" stroke-width="2"></line>
                    <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"></line>
                  </svg>
                  <input type="date" id="native-picker-to" class="native-hidden-date-picker" tabindex="-1">
                </label>
              </div>
            </div>

            <!-- Apply & Reset Buttons -->
            <button type="button" id="apply-date-range-btn" class="btn-date-apply" title="Apply date filter">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
              <span>Apply</span>
            </button>

            <button type="button" id="reset-date-range-btn" class="btn-date-reset" title="Reset date filter" style="display: none;">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              <span>Reset</span>
            </button>
          </div>

          <!-- Date Range Validation Error Banner (Integrated inside date filter card) -->
          <div id="date-range-error-msg" class="date-range-error-text" style="display: none;">
            <span class="date-error-icon-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </span>
            <span id="date-range-error-text-content">Please enter a valid date range.</span>
          </div>
        </div>

        <!-- Date Range Status Banner -->
        <div id="date-filter-status-banner" class="date-filter-banner" style="display: none;">
          <div class="date-filter-status-text">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <span id="date-filter-status-desc">Filtering submissions...</span>
          </div>
          <button type="button" id="date-filter-clear-banner-btn" class="date-filter-banner-clear" title="Clear date filter">Clear Filter &times;</button>
        </div>

        <div class="form-selector-wrapper" id="question-selector-container" style="margin-bottom: 20px; display: none; gap: 16px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 250px;">
            <label for="question-selector" style="white-space: nowrap; display: block; margin-bottom: 8px;">Focus on Question:</label>
            <select id="question-selector" style="width: 100%;">
              <option value="all" selected>All Questions</option>
            </select>
          </div>
          <div style="flex: 1; min-width: 250px;">
            <label for="status-selector" style="white-space: nowrap; display: block; margin-bottom: 8px;">Question Status:</label>
            <select id="status-selector" style="width: 100%;">
              <option value="all" selected>All (Active & Archived)</option>
              <option value="active">Active Questions Only</option>
              <option value="archived">Archived Questions Only</option>
            </select>
          </div>
        </div>

        <!-- Filters Card Removed -->

        <!-- Summary Overview Card -->
        <div class="executive-scorecard-grid" id="executive-scorecard" style="display: none; grid-template-columns: repeat(auto-fit, minmax(260px, 320px));">
          <div class="scorecard-kpi-card">
            <div class="kpi-icon-wrap" style="background: rgba(179, 43, 43, 0.1); color: var(--primary-color);">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-label">Total Submissions</div>
              <div class="kpi-value" id="kpi-total-responses">0</div>
              <div class="kpi-subtext">Total verified responses</div>
            </div>
          </div>

          <!-- View Responses Card Button -->
          <div class="scorecard-kpi-card" id="view-responses-btn" style="cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; justify-content: center; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="kpi-icon-wrap" style="background: rgba(43, 179, 100, 0.1); color: #2bb364;">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m4 2v-4m4 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <div class="kpi-content">
                <div class="kpi-label" style="font-size: 16px; font-weight: 600; color: var(--primary-color);">View All Responses</div>
                <div class="kpi-subtext" style="margin-top: 4px;">Open full table in new tab</div>
              </div>
            </div>
          </div>

          <!-- View Individual Reports Card Button -->
          <div class="scorecard-kpi-card" id="view-individual-reports-btn" style="cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; justify-content: center; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="kpi-icon-wrap" style="background: rgba(43, 110, 179, 0.1); color: #2b78b3;">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              </div>
              <div class="kpi-content">
                <div class="kpi-label" style="font-size: 16px; font-weight: 600; color: var(--primary-color);">Individual Reports</div>
                <div class="kpi-subtext" style="margin-top: 4px;">Stacked printable reports</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Charts Container -->
        <div id="charts-wrapper">
          <!-- Dynamically populated by JS -->
        </div>

        <!-- Qualitative Comments & Text Feedback Section -->
        <div class="card qualitative-card" id="qualitative-feedback-card" style="display: none; margin-top: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
            <div>
              <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">💬 Qualitative Suggestions & Open Feedback</h3>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-secondary);">Verbatim feedback and text responses submitted by stakeholders.</p>
            </div>
          </div>
          <div id="qualitative-comments-container">
            <!-- Dynamically populated -->
          </div>
        </div>

      </div>

  <!-- Chart Modal -->
  <div id="chart-modal" class="analytics-modal" style="display: none;">
    <div class="analytics-modal-content">
      <span class="analytics-modal-close" onclick="closeChartModal()">&times;</span>
      <h3 id="chart-modal-title" style="margin-top: 0; text-align: center; margin-bottom: 12px; font-size: 18px; color: var(--text-main);"></h3>
      <div id="chart-modal-insight-pill" class="modal-insight-pill"></div>
      <div id="chart-modal-body" style="height: 65vh; width: 100%; position: relative; display: flex; justify-content: center;">
        <canvas id="chart-modal-canvas"></canvas>
      </div>
    </div>
  </div>

  <!-- Loading Overlay -->
  <div id="loading-overlay">Loading Analytics...</div>

  <!-- Filter Side Drawer -->
  <div id="filter-overlay" class="filter-overlay" style="display: none;"></div>
  <div id="filter-sidebar" class="filter-sidebar">
    <div class="filter-sidebar-header">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Filters</h3>
      <span class="filter-sidebar-close" id="close-filters-btn">&times;</span>
    </div>
    
    <div class="filter-sidebar-content" id="filters-container">
      <div class="filter-accordion">
        <button class="filter-accordion-btn">Submission Year</button>
        <div class="filter-accordion-content" style="display: none;">
          <div id="year-filter-options" class="checkbox-group">
            <!-- Year checkboxes will be injected here -->
          </div>
        </div>
      </div>
      
      <!-- Dynamic filter accordions will be injected here -->
    </div>
    
    <div class="filter-sidebar-footer">
      <button id="clear-filters-btn" class="btn-secondary" style="flex: 1;">Clear All</button>
      <button id="apply-filters-btn" class="btn-primary" style="flex: 1;">Apply</button>
    </div>
  </div>
