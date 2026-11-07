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

<!-- Modal for Adding New Option Set -->
<div id="add-option-modal" class="modal-overlay" style="display: none;">
  <div class="modal-content" style="max-width: 720px; width: 92%; max-height: 90vh; overflow-y: auto;">
    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
      <h3 style="margin: 0; color: var(--text-main);">Add New Option Set</h3>
      <button class="modal-close" id="close-option-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
    </div>
    <div class="modal-body">
      
      <div class="form-group" style="margin-bottom: 20px;">
        <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--text-main);">Option Set Name *</label>
        <input type="text" id="new-opt-name" class="form-control" placeholder="e.g. 5-Point Quality Scale">
      </div>

      <div class="form-group" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="font-weight: 500; margin: 0; color: var(--text-main);">Parent Option Set (Optional)</label>
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
          <input type="text" id="parent-search-input" class="form-control" placeholder="Search Parent Option Set (e.g. Program)..." autocomplete="off" style="width: 100%; padding-right: 32px;">
          <span id="parent-search-clear" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #94a3b8; font-size: 18px; display: none; line-height: 1; user-select: none;" title="Clear selection">&times;</span>
          <div id="parent-search-dropdown" class="parent-search-dropdown"></div>
        </div>

        <!-- 2. Dropdown Mode -->
        <div id="parent-select-wrapper" style="display: none;">
          <select id="opt-parent-group" class="form-control" style="width: 100%;">
            <option value="">None (Independent Option Set)</option>
          </select>
        </div>

        <small class="text-secondary" style="font-size: 12px; margin-top: 6px; display: block;">Select a parent option set (e.g. Program) to organize choices into buckets.</small>
      </div>

      <!-- Flat Choices View (When Parent is None) -->
      <div id="flat-choices-container" class="form-group">
        <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--text-main);">Choices (Highest weight first)</label>
        <div id="new-opt-choices-list" style="display: flex; flex-direction: column; gap: 12px;">
          <!-- Choice rows will be injected here -->
        </div>
        <div style="display: flex; gap: 12px; margin-top: 12px;">
          <button type="button" id="add-choice-row-btn" class="btn-secondary" style="flex: 1; justify-content: center;">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Add Choice
          </button>
          <button type="button" id="add-other-choice-btn" class="btn-secondary" style="flex: 1; justify-content: center; color: #0284c7; border-color: #0284c7;">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Add 'Other' Option
          </button>
        </div>
      </div>

      <!-- Bucket Choices View (When Parent is Selected) -->
      <div id="bucket-choices-container" class="form-group" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <label style="font-weight: 600; color: var(--text-main); margin: 0; font-size: 15px;">Program Buckets & Applicable Choices</label>
          <button type="button" id="add-bucket-btn" class="btn-secondary" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; font-size: 13px;">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Add Bucket
          </button>
        </div>
        <p class="text-secondary" style="font-size: 13px; margin-top: 0; margin-bottom: 14px;">Group your choices by selecting which parent programs they apply to. You can select multiple programs per bucket.</p>
        <div id="buckets-list" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Bucket cards dynamically injected here -->
        </div>
      </div>
      
    </div>
    <div class="modal-footer" style="margin-top: 24px; text-align: right; border-top: 1px solid var(--border-color); padding-top: 16px;">
      <button class="btn-secondary" id="cancel-option-modal-btn" style="margin-right: 12px;">Cancel</button>
      <button class="btn-primary" id="save-option-set-btn">Save Option Set</button>
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
