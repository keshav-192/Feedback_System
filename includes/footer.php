<?php
// includes/footer.php
?>
  <!-- Global Footer -->
  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 VFSTR. All rights reserved.</p>
      <p class="footer-sub">Designed & maintained by Technology Development(TD)</p>
    </div>
  </footer>

  <!-- Universal Scroll to Top Floating Button -->
  <button id="btn-scroll-to-top" class="scroll-to-top-btn" title="Back to top" aria-label="Scroll to top">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  </button>

  <style>
    .scroll-to-top-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background-color: var(--primary-color, #8b1d24);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transform: translateY(16px) scale(0.9);
      transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s ease, background-color 0.2s ease, box-shadow 0.2s ease;
      z-index: 9999;
      outline: none;
      user-select: none;
    }

    .scroll-to-top-btn.visible {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }

    .scroll-to-top-btn:hover {
      background-color: var(--primary-hover, #6d151b);
      transform: translateY(-3px) scale(1.06);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
    }

    .scroll-to-top-btn:active {
      transform: translateY(0) scale(0.94);
    }

    @media print {
      .scroll-to-top-btn {
        display: none !important;
      }
    }

    @media (max-width: 600px) {
      .scroll-to-top-btn {
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
      }
    }
  </style>

  <script>
    (function() {
      const scrollBtn = document.getElementById('btn-scroll-to-top');
      if (!scrollBtn) return;

      let ticking = false;
      function checkScroll() {
        const scrolled = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        if (scrolled > 260) {
          scrollBtn.classList.add('visible');
        } else {
          scrollBtn.classList.remove('visible');
        }
        ticking = false;
      }

      window.addEventListener('scroll', function() {
        if (!ticking) {
          window.requestAnimationFrame(checkScroll);
          ticking = true;
        }
      }, { passive: true });

      scrollBtn.addEventListener('click', function() {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });

      // Initial check in case page is already scrolled on load
      checkScroll();
    })();
  </script>
