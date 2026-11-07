<?php
if (basename($_SERVER['PHP_SELF']) === basename(__FILE__)) {
    header("HTTP/1.1 403 Forbidden");
    exit("Direct access not permitted.");
}
?>

<!-- Global Options Section -->
<div id="global-options-section" class="content-section">
  
  <div class="card title-card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; position: relative; z-index: 10; overflow: visible;">
    <div>
      <h2 class="form-title" style="margin-bottom: 4px;">Global Options</h2>
      <p class="text-secondary" style="font-size: 14px;">Manage all predefined option sets available in the form builder.</p>
    </div>
    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <div class="autocomplete-wrapper" id="global-options-search-wrapper">
        <input type="text" id="global-options-filter" class="form-control" placeholder="Search Option Set (e.g. Department)..." style="min-width: 250px;">
        <div id="global-options-dropdown" class="autocomplete-dropdown"></div>
      </div>
      <select id="global-options-select" class="form-control" style="min-width: 200px;">
        <option value="all">All Option Sets</option>
      </select>
      <button id="sort-global-options-btn" type="button" class="btn-sort-toggle" title="Click to toggle: Newest first or Oldest first">
        <svg id="sort-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path>
        </svg>
        <span id="sort-label">Sort: <strong>Oldest First</strong></span>
      </button>
      <button id="add-global-option-btn" class="btn-primary">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Add Option Set
      </button>
    </div>
  </div>

  <!-- Loading State -->
  <div id="options-loading-state" style="text-align: center; padding: 40px; color: var(--text-secondary);">
    Loading option sets...
  </div>

  <!-- Options Grid -->
  <div id="global-options-grid" class="options-grid" style="display: none;">
    <!-- Cards will be injected here via JS -->
  </div>

  <div id="global-preview-box" class="autocomplete-item-preview"></div>

</div>

<!-- Modal for Adding / Editing Option Set -->
<div id="add-option-modal" class="modal-overlay" style="display: none;">
  <div class="modal-content modal-content-modern" style="max-width: 700px; width: 94%; max-height: 90vh; overflow-y: auto;">
    
    <!-- Modal Header -->
    <div class="modal-header-modern">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="modal-icon-badge">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
        </div>
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.2;">Add New Option Set</h3>
          <p style="margin: 3px 0 0 0; font-size: 12.5px; color: #64748b;">Configure standard rating scale or dropdown choices for forms</p>
        </div>
      </div>
      <button type="button" class="modal-close-btn" id="close-option-modal-btn" title="Close dialog">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    <!-- Modal Body -->
    <div class="modal-body-modern">
      
      <!-- Option Set Name -->
      <div class="form-group-modern" style="margin-bottom: 20px;">
        <label class="form-label-modern">
          <span>Option Set Name</span>
          <span class="required-star">*</span>
        </label>
        <input type="text" id="new-opt-name" class="form-control" placeholder="e.g. 5-Point Quality Scale">
      </div>

      <!-- Parent Option Set (Optional) -->
      <div class="form-group-modern" style="margin-bottom: 22px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <label class="form-label-modern" style="margin-bottom: 0;">
            <span>Parent Option Set</span>
            <span class="badge-optional">Optional</span>
          </label>
          <div class="parent-mode-toggle" id="parent-mode-toggle">
            <button type="button" class="mode-toggle-btn active" data-mode="search" title="Search Option Set">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              Search
            </button>
            <button type="button" class="mode-toggle-btn" data-mode="dropdown" title="Select from Dropdown List">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              Dropdown
            </button>
          </div>
        </div>

        <!-- 1. Search Mode (Default) -->
        <div id="parent-search-wrapper" class="parent-search-wrapper">
          <span class="parent-search-icon">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </span>
          <input type="text" id="parent-search-input" class="form-control has-search-icon" placeholder="Search Parent Option Set (e.g. Program)..." autocomplete="off">
          <span id="parent-search-clear" class="parent-search-clear" title="Clear selection">&times;</span>
          <div id="parent-search-dropdown" class="parent-search-dropdown"></div>
        </div>

        <!-- 2. Dropdown Mode -->
        <div id="parent-select-wrapper" style="display: none;">
          <select id="opt-parent-group" class="form-control" style="width: 100%;">
            <option value="">None (Independent Option Set)</option>
          </select>
        </div>

        <div class="parent-hint-text">
          <svg width="13.5" height="13.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span>Select a parent option set (e.g. Program) to organize choices into buckets.</span>
        </div>
      </div>

      <!-- Flat Choices View (When Parent is None) -->
      <div id="flat-choices-container" class="form-group-modern">
        <div class="choices-container-card">
          <div class="choices-section-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 600; font-size: 14px; color: #1e293b;">Choices Configuration</span>
              <span class="choices-order-pill">
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path></svg>
                Highest weight first
              </span>
            </div>
            <span class="choices-hint-badge">Determines score weights in analytics</span>
          </div>

          <!-- Column Header Labels -->
          <div class="choices-columns-header">
            <span style="width: 26px; text-align: center;">#</span>
            <span style="flex: 1; padding-left: 2px;">Choice Label</span>
            <span style="width: 85px; text-align: center;">Weight / Pts</span>
            <span style="width: 36px; text-align: center;"></span>
          </div>

          <!-- Choices List -->
          <div id="new-opt-choices-list" style="display: flex; flex-direction: column; gap: 10px;">
            <!-- Choice rows will be injected here -->
          </div>

          <!-- Add Choice Buttons Row -->
          <div class="choices-actions-row">
            <button type="button" id="add-choice-row-btn" class="btn-add-choice-modern">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              Add Choice
            </button>
            <button type="button" id="add-other-choice-btn" class="btn-add-other-modern">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              Add 'Other' Option
            </button>
          </div>
        </div>
      </div>

      <!-- Bucket Choices View (When Parent is Selected) -->
      <div id="bucket-choices-container" class="form-group-modern" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <label style="font-weight: 600; color: #1e293b; margin: 0; font-size: 14.5px;">Program Buckets & Applicable Choices</label>
            <p class="text-secondary" style="font-size: 12.5px; margin: 2px 0 0 0;">Group your choices by selecting which parent programs they apply to.</p>
          </div>
          <button type="button" id="add-bucket-btn" class="btn-secondary" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600;">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Add Bucket
          </button>
        </div>
        <div id="buckets-list" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Bucket cards dynamically injected here -->
        </div>
      </div>
      
    </div>

    <!-- Modal Footer -->
    <div class="modal-footer-modern">
      <button type="button" class="btn-modal-cancel" id="cancel-option-modal-btn">Cancel</button>
      <button type="button" class="btn-modal-save" id="save-option-set-btn">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        Save Option Set
      </button>
    </div>

  </div>
</div>

<!-- Modal for Viewing All Options -->
<div id="view-options-modal" class="modal-overlay" style="display: none;">
  <div class="modal-content" style="max-width: 500px; width: 90%; max-height: 80vh; display: flex; flex-direction: column;">
    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
      <h3 style="margin: 0; color: var(--text-main);" id="view-options-title">Option Set</h3>
      <button class="modal-close" id="close-view-options-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
    </div>
    <div class="modal-body" style="flex: 1; overflow-y: auto;">
      <ul id="view-options-list" class="option-choices-list">
        <!-- Full options list injected here -->
      </ul>
    </div>
  </div>
</div>
