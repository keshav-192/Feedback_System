document.addEventListener('DOMContentLoaded', function() {
  const navItems = document.querySelectorAll('.nav-item');
  const contentSections = document.querySelectorAll('.content-section');

  // Sidebar Collapse / Expand Toggle
  const adminLayout = document.querySelector('.admin-layout');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

  function updateSidebarState(collapsed, save = true) {
    if (!adminLayout || !sidebarToggleBtn) return;
    if (collapsed) {
      adminLayout.classList.add('sidebar-collapsed');
      sidebarToggleBtn.setAttribute('title', 'Expand sidebar');
      sidebarToggleBtn.setAttribute('aria-label', 'Expand sidebar navigation');
    } else {
      adminLayout.classList.remove('sidebar-collapsed');
      sidebarToggleBtn.setAttribute('title', 'Minimize sidebar');
      sidebarToggleBtn.setAttribute('aria-label', 'Minimize sidebar navigation');
    }
    if (save) {
      try {
        localStorage.setItem('admin_sidebar_collapsed', collapsed ? 'true' : 'false');
      } catch (e) {}
    }
    // Dispatch resize event after CSS transition finishes so Chart.js charts cleanly recalculate dimensions
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
  }

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const isCurrentlyCollapsed = adminLayout.classList.contains('sidebar-collapsed');
      updateSidebarState(!isCurrentlyCollapsed, true);
    });

    // Check localStorage preference on load
    try {
      const savedCollapsed = localStorage.getItem('admin_sidebar_collapsed');
      if (savedCollapsed === 'true') {
        updateSidebarState(true, false);
      }
    } catch (e) {}
  }

  function logAdminNavigation(targetId) {
    let readableName = '';
    if (targetId === 'new-form-section') readableName = 'Navigated to New Form Page';
    else if (targetId === 'edit-form-section') readableName = 'Navigated to Edit Form Page';
    else if (targetId === 'global-options-section') readableName = 'Navigated to Global Options Page';
    else if (targetId === 'analytics-section') readableName = 'Navigated to Analytics Page';
    else if (targetId === 'change-password-section') readableName = 'Navigated to Change Password Page';
    
    if (readableName !== '') {
        fetch('log_admin_event.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: readableName })
        }).catch(e => console.error(e));
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active class from all nav items
      navItems.forEach(nav => nav.classList.remove('active'));
      
      // Add active class to clicked nav item
      this.classList.add('active');
      
      // Ensure any open analytics filters are closed when navigating away
      if (typeof window.closeAnalyticsSidebar === 'function') {
        window.closeAnalyticsSidebar();
      }
      
      // Hide all content sections
      contentSections.forEach(section => section.classList.remove('active'));
      
      // Show target content section
      const targetId = this.getAttribute('data-target');

      // Flush any active analytics session if navigating away
      if (typeof window.flushAnalyticsSession === 'function') {
        const readableDest = (targetId === 'analytics-section') ? 'Forms Grid' : targetId.replace('-section', '').replace(/-/g, ' ');
        window.flushAnalyticsSession('Navigated away to ' + readableDest);
      }

      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add('active');
        logAdminNavigation(targetId);
      }

      if (targetId === 'analytics-section' && typeof window.refreshAnalytics === 'function') {
        window.refreshAnalytics();
      }

      // Update URL hash without scrolling
      const hash = this.getAttribute('href');
      if (hash && hash !== '#') {
        window.history.pushState(null, null, hash);
      }

      // In mobile view, when nav-item is clicked, smooth scroll to top of content
      if (window.innerWidth <= 900) {
        window.scrollTo({
          top: targetSection ? targetSection.offsetTop - 80 : 0,
          behavior: 'smooth'
        });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    });
  });

  // Handle URL hash on load
  if (window.location.hash) {
    const hash = window.location.hash;
    const targetNav = document.querySelector(`.nav-item[href="${hash}"]`);
    if (targetNav) {
      targetNav.click();
    } else if (hash === '#change-password') {
      // Show change password section if loaded directly
      contentSections.forEach(section => section.classList.remove('active'));
      const cpSection = document.getElementById('change-password-section');
      if (cpSection) {
          cpSection.classList.add('active');
          logAdminNavigation('change-password-section');
      }
    }
  } else {
    // Default load is New Form Page
    logAdminNavigation('new-form-section');
  }

  // Handle dropdown Change Password link
  const cpDropdownLink = document.querySelector('a[href="#change-password"]');
  if (cpDropdownLink) {
    cpDropdownLink.addEventListener('click', function(e) {
      e.preventDefault();
      // Remove active class from nav items so none are highlighted
      navItems.forEach(nav => nav.classList.remove('active'));
      
      // Ensure any open analytics filters are closed when navigating away
      if (typeof window.closeAnalyticsSidebar === 'function') {
        window.closeAnalyticsSidebar();
      }
      
      // Hide all content sections
      contentSections.forEach(section => section.classList.remove('active'));
      
      // Show target content section
      const targetSection = document.getElementById('change-password-section');
      if (targetSection) {
        targetSection.classList.add('active');
        logAdminNavigation('change-password-section');
      }
      
      window.history.pushState(null, null, '#change-password');
      
      // Close dropdown
      const adminDropdown = document.getElementById("adminDropdown");
      const adminProfileBtn = document.getElementById("adminProfileBtn");
      if (adminDropdown) adminDropdown.classList.remove('show');
      if (adminProfileBtn) adminProfileBtn.classList.remove('active');
    });
  }

  function showInlineError(element, message, position = 'afterend') {
    if (!element) return;
    const container = element.closest('.form-group') || element.parentNode;
    const existing = container.querySelector('.inline-error-text');
    if (existing) existing.remove();
    
    const err = document.createElement('span');
    err.className = 'inline-error-text';
    err.textContent = message;
    
    const target = element.closest('.password-field-wrapper') || element;
    if (position === 'afterend') {
      target.insertAdjacentElement('afterend', err);
    } else if (position === 'beforebegin') {
      target.insertAdjacentElement('beforebegin', err);
    } else {
      target.appendChild(err);
    }
    
    setTimeout(() => { if(err.parentNode) err.remove(); }, 4000);
  }

  // Toggle password visibility for Change Password form
  document.querySelectorAll('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const icon = this.querySelector('.eye-icon');
      if (!input || !icon) return;

      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');

      if (isPassword) {
        // Eye Open icon (visible)
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />';
      } else {
        // Eye Closed icon (hidden)
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />';
      }
    });
  });

  // Handle change password form submission
  const changePasswordForm = document.getElementById('change-password-form');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentPwdEl = document.getElementById('current-password');
      const newPwdEl = document.getElementById('new-password');
      const confirmPwdEl = document.getElementById('confirm-password');
      
      const currentPwd = currentPwdEl.value;
      const newPwd = newPwdEl.value;
      const confirmPwd = confirmPwdEl.value;
      const submitBtn = changePasswordForm.querySelector('button[type="submit"]');
      
      // Clear previous messages
      const existingSuccess = changePasswordForm.querySelector('.inline-success-text');
      if (existingSuccess) existingSuccess.remove();
      const existingError = changePasswordForm.querySelector('.inline-error-text');
      if (existingError) existingError.remove();
      
      if (newPwd !== confirmPwd) {
        showInlineError(confirmPwdEl, 'New passwords do not match!');
        return;
      }
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;
      if (!passwordRegex.test(newPwd)) {
        showInlineError(newPwdEl, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
        return;
      }
      
      // Disable button during request
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Updating...';
      submitBtn.disabled = true;

      try {
        const response = await fetch('change_password.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            current_password: currentPwd,
            new_password: newPwd,
            confirm_password: confirmPwd
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          const successSpan = document.createElement('span');
          successSpan.className = 'inline-success-text';
          successSpan.textContent = 'Password changed successfully!';
          submitBtn.insertAdjacentElement('afterend', successSpan);
          setTimeout(() => { if(successSpan.parentNode) successSpan.remove(); }, 4000);
          changePasswordForm.reset();
        } else {
          showInlineError(submitBtn, data.message || 'Failed to change password.');
        }
      } catch (error) {
        console.error("Error:", error);
        showInlineError(submitBtn, 'An error occurred. Please try again.');
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
});

// Admin Dropdown Toggle
document.addEventListener("DOMContentLoaded", function() {
    const adminProfileBtn = document.getElementById("adminProfileBtn");
    const adminDropdown = document.getElementById("adminDropdown");

    if (adminProfileBtn && adminDropdown) {
        adminProfileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            adminDropdown.classList.toggle("show");
            adminProfileBtn.classList.toggle("active");
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (e) => {
            if (!adminDropdown.contains(e.target) && !adminProfileBtn.contains(e.target)) {
                adminDropdown.classList.remove("show");
                adminProfileBtn.classList.remove("active");
            }
        });
    }
});
