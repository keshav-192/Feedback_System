<?php
require_once '../includes/auth.php';
requireAdmin();

$just_logged_in = false;
if (isset($_SESSION['just_logged_in'])) {
    $just_logged_in = true;
    unset($_SESSION['just_logged_in']);
}

$admin_emp_id = $_SESSION['admin_emp_id'] ?? 'Administrator';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    /* Hide body initially to prevent flashing the dashboard before JS session check */
    body { display: none; }
  </style>
  <script>
    document.write('<style>body { display: flex !important; flex-direction: column !important; min-height: 100vh !important; }</style>');

    // Force page reload if loaded from BFCache (back/forward button)
    window.addEventListener("pageshow", function(event) {
        if (event.persisted) {
            window.location.reload();
        }
    });
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - Stakeholder Feedback</title>
  <link rel="stylesheet" href="admin.css?v=37">
  <link rel="stylesheet" href="new_form.css?v=<?= filemtime(__DIR__ . '/new_form.css') ?>">
  <link rel="stylesheet" href="edit_form/edit_form.css?v=<?= filemtime(__DIR__ . '/edit_form/edit_form.css') ?>">
  <link rel="stylesheet" href="global_options/global_options.css?v=<?= filemtime(__DIR__ . '/global_options/global_options.css') ?>">
  <link rel="stylesheet" href="../analytics/analytics.css?v=<?= filemtime(__DIR__ . '/../analytics/analytics.css') ?>">
</head>
<body>

  <?php 
    $base_url = '../';
    $is_admin_dashboard = true;
    include '../includes/header.php'; 
  ?>

  <!-- Main Content Layout -->
  <main class="site-main">
    <div class="admin-layout">
      
      <!-- Modern Sidebar with Collapsible Toggle -->
      <aside class="admin-sidebar" id="adminSidebar">
        <!-- Floating Border Toggle Arrow Button -->
        <button type="button" class="sidebar-toggle-btn" id="sidebarToggleBtn" title="Minimize sidebar" aria-label="Toggle sidebar navigation">
          <svg class="toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <div class="sidebar-inner" id="sidebarInner">
          <h3 class="sidebar-title">Admin Panel</h3>
          <nav class="sidebar-nav">
            <a href="#new-form" class="nav-item active" data-target="new-form-section" title="New Form">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span class="nav-text">New Form</span>
            </a>
            <a href="#edit-form" class="nav-item" data-target="edit-form-section" title="Edit Form">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              <span class="nav-text">Edit Form</span>
            </a>
            <a href="#global-options" class="nav-item" data-target="global-options-section" title="Global Options">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="6" r="2" stroke-width="2"></circle>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 6h9"></path>
                <circle cx="5" cy="12" r="2" stroke-width="2"></circle>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 12h9"></path>
                <circle cx="5" cy="18" r="2" stroke-width="2"></circle>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 18h9"></path>
              </svg>
              <span class="nav-text">Global Options</span>
            </a>
            <a href="#analytics" class="nav-item" data-target="analytics-section" title="Analytics">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              <span class="nav-text">Analytics</span>
            </a>
          </nav>
        </div>
      </aside>

      <!-- Main Content Area -->
      <section class="admin-content">
        
        <!-- New Form Section -->
        <?php include 'new_form.php'; ?>

        <!-- Edit Form Section -->
        <?php include 'edit_form/edit_form.php'; ?>

        <!-- Global Options Section -->
        <?php include 'global_options/global_options.php'; ?>

        <!-- Analytics Section -->
        <div id="analytics-section" class="content-section">
          <div class="card title-card">
            <h2 class="form-title">Form Analytics</h2>
            <p class="text-secondary">View aggregate responses and metrics for any form.</p>
          </div>
          <?php include '../analytics/analytics_view.php'; ?>
        </div>

        <!-- Change Password Section -->
        <div id="change-password-section" class="content-section">
          <div class="card title-card" style="max-width: 500px; margin: 0 auto 24px auto;">
            <h2 class="form-title">Change Password</h2>
            <p class="text-secondary">Update your administrative password.</p>
          </div>
          <div class="card" style="max-width: 500px; margin: 0 auto;">
            <form id="change-password-form">
              <div class="form-group">
                <label for="current-password">Current Password</label>
                <div class="password-field-wrapper" style="position: relative;">
                  <input type="password" id="current-password" class="form-control" required style="padding-right: 42px;">
                  <button type="button" class="toggle-password-btn" data-target="current-password" aria-label="Toggle password visibility" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6b7280; padding: 0; display: flex; align-items: center; justify-content: center;">
                    <svg class="eye-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="form-group" style="margin-top: 16px;">
                <label for="new-password">New Password</label>
                <div class="password-field-wrapper" style="position: relative;">
                  <input type="password" id="new-password" class="form-control" required style="padding-right: 42px;">
                  <button type="button" class="toggle-password-btn" data-target="new-password" aria-label="Toggle password visibility" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6b7280; padding: 0; display: flex; align-items: center; justify-content: center;">
                    <svg class="eye-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="form-group" style="margin-top: 16px;">
                <label for="confirm-password">Confirm New Password</label>
                <div class="password-field-wrapper" style="position: relative;">
                  <input type="password" id="confirm-password" class="form-control" required style="padding-right: 42px;">
                  <button type="button" class="toggle-password-btn" data-target="confirm-password" aria-label="Toggle password visibility" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6b7280; padding: 0; display: flex; align-items: center; justify-content: center;">
                    <svg class="eye-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  </button>
                </div>
              </div>
              <button type="submit" class="btn-primary" style="display: block; margin: 24px auto 0 auto;">Update Password</button>
            </form>
          </div>
        </div>

      </section>

    </div>
  </main>

  <?php include '../includes/footer.php'; ?>

  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
  <script src="admin.js?v=37"></script>
  <script src="new_form.js?v=34"></script>
  <script src="edit_form/edit_form.js?v=34"></script>
  <script src="global_options/global_options.js?v=<?= filemtime(__DIR__ . '/global_options/global_options.js') ?>"></script>
  <script src="../analytics/pptxgen.bundle.js"></script>
  <script src="../analytics/chart.js"></script>
  <script src="../analytics/analytics.js?v=<?= filemtime(__DIR__ . '/../analytics/analytics.js') ?>"></script>

</body>
</html>
