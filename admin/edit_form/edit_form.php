<?php
if (basename($_SERVER['PHP_SELF']) === basename(__FILE__)) {
    header("HTTP/1.1 403 Forbidden");
    exit("Direct access not permitted.");
}
?>

<div id="edit-form-section" class="content-section">
  
  <!-- Step 1: Select Form View -->
  <div id="form-select-view">
    <div class="card title-card">
      <h2 class="form-title">Edit Existing Form</h2>
      <p class="text-secondary">Select a form from the list below to modify its structure and questions.</p>
    </div>
    
    <div class="search-container" style="margin-bottom: 24px; max-width: 600px; margin-left: auto; margin-right: auto;">
      <div class="admin-search-wrapper">
        <svg class="search-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input type="text" id="edit-form-search-input" class="admin-search-input" placeholder="Search forms by name..." onkeyup="filterEditForms()" oninput="filterEditForms()">
        <svg class="clear-icon" id="clearEditSearch" onclick="clearEditSearchInput()" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: none;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </div>
    </div>

    <div id="forms-list-container" class="forms-grid">
      <!-- List of forms will be injected here via JS -->
      <p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">Loading forms...</p>
    </div>
  </div>

  <!-- Step 2: Edit Form Builder View (Hidden initially) -->
  <div id="edit-form-builder-view" class="edit-builder-view-wrapper" style="display: none;">
    <!-- Title Card -->
    <div class="card title-card edit-form-title-card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          <button id="back-to-list-btn" class="btn-secondary" style="padding: 6px; border-radius: 50%;" title="Back to List">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <h2 class="form-title" id="edit-display-form-title" style="margin: 0;">Form Title</h2>
        </div>
        <p class="text-secondary" id="edit-display-form-desc" style="font-size: 14px; opacity: 0.8; max-width: 600px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-left: 44px;">Form Description</p>
      </div>
      <div style="display: flex; gap: 12px;">
        <button id="edit-meta-btn" class="btn-secondary" title="Edit Title/Description" style="padding: 10px;">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button id="open-archived-sidebar-btn" class="btn-secondary" title="View Archived Questions" style="padding: 10px; display: flex; align-items: center; gap: 4px;">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
          <span id="archive-badge" class="archive-btn-badge" style="display: none;">0</span>
        </button>
        <button id="edit-add-section-btn" class="btn-primary">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Add Section
        </button>
      </div>
    </div>
    
    <!-- Dedicated Scrollable Container for Sections & Questions (Option B) -->
    <div id="edit-form-builder-container" class="edit-builder-scroll-area">
      <!-- Dynamic sections will be injected here -->
    </div>

    <div class="form-builder-actions edit-builder-actions" style="margin-top: 16px; text-align: right; display: flex; justify-content: flex-end; gap: 12px;">
      <button id="cancel-edit-btn" class="btn-secondary" style="padding: 12px 32px; font-size: 16px;">Cancel</button>
      <button id="update-form-btn" class="btn-primary" style="padding: 12px 32px; font-size: 16px;">Update Form</button>
    </div>
  </div>

</div>

<!-- Archived Questions Sidebar -->
<div id="archived-sidebar-overlay" class="archived-sidebar-overlay"></div>
<div id="archived-sidebar" class="archived-sidebar">
  <div class="archived-sidebar-header">
    <h3>
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
      Archived Questions
    </h3>
    <button id="close-archived-sidebar" class="btn-secondary" title="Close" style="padding: 6px; border-radius: 50%; flex-shrink: 0;">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
  </div>
  <div id="archived-sidebar-list" class="archived-sidebar-body">
    <p id="archived-sidebar-empty" class="archived-sidebar-empty">No archived questions for this form.</p>
  </div>
</div>

<!-- Modal for Editing Title/Desc -->
<div id="edit-meta-modal" class="modal-overlay" style="display:none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
  <div class="card" style="width: 100%; max-width: 500px; padding: 24px;">
    <h3 style="margin-bottom: 16px; color: var(--text-main);">Edit Form Details</h3>
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-weight: 500; margin-bottom: 8px;">Form Title <span style="color: #e53e3e;">*</span></label>
      <input type="text" id="edit-form-title-input" class="form-control" style="width: 100%;">
    </div>
    <div style="margin-bottom: 24px;">
      <label style="display: block; font-weight: 500; margin-bottom: 8px;">Description</label>
      <textarea id="edit-form-desc-input" class="form-control" style="width: 100%; min-height: 80px;"></textarea>
    </div>
    <div style="margin-bottom: 24px;">
      <label style="display: block; font-weight: 500; margin-bottom: 8px;">QR Code Image (Optional)</label>
      <input type="file" id="edit-form-qr-input" accept="image/*" class="form-control" style="width: 100%; margin-bottom: 8px; padding: 8px;">
      <div id="edit-qr-preview-container" style="display: none; text-align: center; border: 1px dashed var(--input-border); border-radius: 8px; padding: 8px;">
        <img id="edit-qr-preview-img" src="" alt="QR Preview" style="max-height: 150px; max-width: 100%; object-fit: contain;">
      </div>
      <div style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
        <input type="checkbox" id="edit-form-remove-qr">
        <label for="edit-form-remove-qr" style="font-size: 13px; margin: 0; color: var(--text-secondary);">Remove existing QR Code image</label>
      </div>
      <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Leave blank to keep existing image (if any).</p>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 12px;">
      <button id="close-meta-modal-btn" class="btn-secondary">Cancel</button>
      <button id="save-meta-modal-btn" class="btn-primary">Apply</button>
    </div>
  </div>
</div>
