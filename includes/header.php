<?php
// includes/header.php
require_once __DIR__ . '/../configuration/config.php';
$base_url = defined('BASE_URL') ? BASE_URL : './';
$is_admin_dashboard = isset($is_admin_dashboard) ? $is_admin_dashboard : false;
?>
  <!-- Global Header -->
  <link rel="stylesheet" href="<?php echo htmlspecialchars($base_url); ?>css/base.css">
  <!-- <input type="hidden" id="csrf-token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'] ?? ''); ?>"> -->
  <header class="site-header">
    <div class="header-inner" style="position: relative;">
      <div class="banner-flex">
        <!-- Vignan Logo Left -->
        <img class="vignan-logo" src="<?php echo htmlspecialchars($base_url); ?>images/vignan's_logo.png" alt="Vignan's Logo">
        <!-- IQAC Logo Right -->
        <img class="iqac-logo" src="<?php echo htmlspecialchars($base_url); ?>images/iqac_logo.png" alt="IQAC Logo">
      </div>
      
      <?php if ($is_admin_dashboard): ?>
      <!-- Admin Profile Dropdown (Top Right) -->
      <div class="header-actions admin-profile-container" style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); z-index: 10;">
        <button class="admin-profile-btn" id="adminProfileBtn">
          <img src="<?php echo htmlspecialchars($base_url); ?>images/admin_avatar.jpg" alt="Admin" class="admin-avatar-img">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        
        <div class="admin-dropdown-menu" id="adminDropdown">
          <div class="dropdown-header" style="text-align: center;">
            <strong style="font-size: 16px; color: var(--primary-color);"><?php echo htmlspecialchars($_SESSION['admin_emp_id'] ?? 'Administrator'); ?></strong>
          </div>
          <hr class="dropdown-divider">
          <a href="#change-password" class="dropdown-item">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            Change Password
          </a>
          <hr class="dropdown-divider">
          <a href="logout.php" class="dropdown-item text-danger">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Logout
          </a>
        </div>
      </div>
      <?php endif; ?>
    </div>
  </header>
