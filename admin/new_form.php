<?php
if (basename($_SERVER['PHP_SELF']) === basename(__FILE__)) {
    header("HTTP/1.1 403 Forbidden");
    exit("Direct access not permitted.");
}
?>


<!-- New Form Section -->
<div id="new-form-section" class="content-section active">
  
  <!-- Step 1: Form Setup View -->
  <div id="form-setup-view" style="max-width: 600px; margin: 40px auto;">
    <div class="card" style="padding: 40px 32px; text-align: center;">
      <div style="margin-bottom: 32px;">
        <svg width="48" height="48" fill="none" stroke="var(--primary-color)" viewBox="0 0 24 24" style="margin-bottom: 16px; opacity: 0.9;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <h2 style="font-size: 24px; color: var(--text-main); margin-bottom: 8px;">Let's Create a New Form</h2>
        <p style="color: var(--text-secondary); font-size: 15px;">Start by giving your feedback form a title and a description. You can add questions in the next step.</p>
      </div>

      <div style="text-align: left; margin-bottom: 24px;">
        <label style="display: block; font-weight: 500; color: var(--text-main); margin-bottom: 8px;">Form Title <span style="color: #e53e3e;">*</span></label>
        <input type="text" id="form-title-input" class="form-control" placeholder="e.g. Alumni Feedback Form 2026" style="font-size: 16px; padding: 12px; border: 1px solid var(--input-border); border-radius: 8px; width: 100%;">
      </div>

      <div style="text-align: left; margin-bottom: 24px;">
        <label style="display: block; font-weight: 500; color: var(--text-main); margin-bottom: 8px;">Description (Optional)</label>
        <textarea id="form-desc-input" class="form-control" placeholder="Provide some context or instructions for the users filling this form..." style="font-size: 14px; padding: 12px; border: 1px solid var(--input-border); border-radius: 8px; width: 100%; resize: vertical; min-height: 100px;"></textarea>
      </div>

      <div style="text-align: left; margin-bottom: 32px;">
        <label style="display: block; font-weight: 500; color: var(--text-main); margin-bottom: 8px;">QR Code Image (Optional)</label>
        <input type="file" id="form-qr-input" accept="image/*" class="form-control" style="font-size: 14px; padding: 8px; border: 1px solid var(--input-border); border-radius: 8px; width: 100%; margin-bottom: 8px;">
        <div id="qr-preview-container" style="display: none; text-align: center; border: 1px dashed var(--input-border); border-radius: 8px; padding: 8px;">
          <img id="qr-preview-img" src="" alt="QR Preview" style="max-height: 150px; max-width: 100%; object-fit: contain;">
        </div>
      </div>

      <button id="start-building-btn" class="btn-primary" style="width: 100%; padding: 14px; font-size: 16px; justify-content: center;">
        Start Building Form
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-left: 8px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
      </button>
    </div>
  </div>

  <!-- Step 2: Form Builder View (Hidden initially) -->
  <div id="form-builder-view" style="display: none;">
    <!-- Title Card (Sticky) -->
    <div class="card title-card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; position: sticky; top: 120px; z-index: 10;">
      <div>
        <h2 class="form-title" id="display-form-title" style="margin-bottom: 4px;">Form Title</h2>
        <p class="text-secondary" id="display-form-desc" style="font-size: 14px; opacity: 0.8; max-width: 600px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Form Description</p>
      </div>
      <div style="display: flex; gap: 12px;">
        <button id="edit-setup-btn" class="btn-secondary" title="Edit Title/Description" style="padding: 10px;">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button id="add-section-btn" class="btn-primary">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Add Section
        </button>
      </div>
    </div>
    
    <div id="form-builder-container">
      <!-- Dynamic sections will be injected here -->
    </div>

    <div class="form-builder-actions" style="margin-top: 24px; text-align: right; display: none; justify-content: flex-end; gap: 12px;" id="form-save-actions">
      <button type="button" id="cancel-new-form-btn" class="btn-secondary" style="padding: 12px 32px; font-size: 16px;">Cancel</button>
      <button type="button" id="save-form-btn" class="btn-primary" style="padding: 12px 32px; font-size: 16px;">Save Form</button>
    </div>
  </div>

</div>
