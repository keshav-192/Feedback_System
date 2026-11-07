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

<!-- Modal for Editing Title/Desc & Branding -->
<div id="edit-meta-modal" class="modal-overlay" style="display: none;">
  <div class="modal-content modal-content-modern" style="max-width: 540px; width: 94%; max-height: 90vh; overflow-y: auto;">
    
    <!-- Modal Header -->
    <div class="modal-header-modern">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="modal-icon-badge">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
        </div>
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.2;">Edit Form Details</h3>
          <p style="margin: 3px 0 0 0; font-size: 12.5px; color: #64748b;">Update form title, description, and QR branding</p>
        </div>
      </div>
      <button type="button" class="modal-close-btn" id="close-meta-modal-x-btn" title="Close dialog">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    <!-- Modal Body -->
    <div class="modal-body-modern">
      
      <!-- Form Title -->
      <div class="form-group-modern" style="margin-bottom: 20px;">
        <label class="form-label-modern">
          <span>Form Title</span>
          <span class="required-star">*</span>
        </label>
        <input type="text" id="edit-form-title-input" class="form-control" placeholder="Enter a descriptive form title...">
      </div>

      <!-- Description -->
      <div class="form-group-modern" style="margin-bottom: 22px;">
        <label class="form-label-modern">
          <span>Description</span>
          <span class="badge-optional">Optional</span>
        </label>
        <textarea id="edit-form-desc-input" class="form-control" rows="3" placeholder="Provide instructions or additional context for respondents..."></textarea>
      </div>

      <!-- QR Code Image -->
      <div class="form-group-modern" style="margin-bottom: 20px;">
        <label class="form-label-modern">
          <span>QR Code Image</span>
          <span class="badge-optional">Optional</span>
        </label>

        <!-- Custom Upload Dropzone Card -->
        <div class="qr-upload-dropzone" id="qr-upload-dropzone">
          <input type="file" id="edit-form-qr-input" accept="image/*" class="qr-file-input">
          <div class="qr-upload-content">
            <div class="qr-upload-icon-circle">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
            <div class="qr-upload-text">
              <span class="qr-upload-prompt"><strong style="color: var(--primary-color, #b32b2b);">Choose an image</strong> or drag and drop</span>
              <span class="qr-upload-hint">PNG, JPG, or SVG up to 5MB</span>
            </div>
          </div>
          <div id="qr-file-selected-name" class="qr-file-selected-name" style="display: none;"></div>
        </div>

        <!-- Preview Container -->
        <div id="edit-qr-preview-container" class="qr-preview-box" style="display: none; margin-top: 10px;">
          <div class="qr-preview-header">
            <span style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Current QR Preview</span>
          </div>
          <img id="edit-qr-preview-img" src="" alt="QR Preview" class="qr-preview-img">
        </div>

        <!-- Remove Checkbox & Helper -->
        <div class="qr-remove-checkbox-wrap" style="margin-top: 10px;">
          <label class="custom-checkbox-label">
            <input type="checkbox" id="edit-form-remove-qr">
            <span class="custom-checkbox-indicator"></span>
            <span class="custom-checkbox-text">Remove existing QR Code image</span>
          </label>
          <span class="qr-note-text">Leave blank to keep existing image (if any)</span>
        </div>
      </div>

    </div>

    <!-- Modal Footer -->
    <div class="modal-footer-modern">
      <button type="button" class="btn-modal-cancel" id="close-meta-modal-btn">Cancel</button>
      <button type="button" class="btn-modal-save" id="save-meta-modal-btn">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Apply
      </button>
    </div>

  </div>
</div>
