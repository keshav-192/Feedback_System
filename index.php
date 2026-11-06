<?php
// Root index.php - Public Dashboard
require_once 'configuration/config.php';
require_once 'trace_log.php';

writeLog("User visited public dashboard");

// Fetch all forms from the database
$forms = [];
try {
    $stmt = $pdo->query("SELECT * FROM forms ORDER BY id ASC");
    $forms = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    // If the table doesn't exist yet, we will just show an empty state.
    $forms = [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stakeholder Feedback Portal - VFSTR</title>
  
  <!-- Use user.css as a base for global variables and header/footer -->
  <link rel="stylesheet" href="users/user.css">
  
  <!-- Dashboard specific styles -->
  <link rel="stylesheet" href="css/dashboard.css">
</head>
<body>

  <?php 
    $base_url = './';
    include 'includes/header.php'; 
  ?>

  <!-- Main Content Body -->
  <main class="site-main" style="display: block; padding-top: 0;">
    <div class="dashboard-container">
      
      <div class="dashboard-header">
        <h1>Stakeholder Feedback</h1>
      </div>
      
      <?php if (!empty($forms)): ?>
      <div class="search-container">
        <div class="search-wrapper">
          <svg class="search-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input type="text" id="form-search-input" placeholder="Search forms by name..." onkeyup="debounceSearch()">
          <svg class="clear-icon" id="clearSearch" onclick="clearSearchInput()" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: none;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </div>
      </div>
      <?php endif; ?>

      <div class="forms-grid">
        
        <?php if (empty($forms)): ?>
          <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <p>No feedback forms are currently active.<br>Please check back later.</p>
          </div>
        <?php else: ?>
          
          <?php foreach ($forms as $form): ?>
            <div class="form-card-container">
              <div class="form-card-inner">

                <!-- Front Side (Premium Pass Design) -->
                <div class="form-card-front">
                  <!-- Official Logo Header -->
                  <div class="card-official-header">
                    <div class="card-logos">
                      <img src="<?= htmlspecialchars($base_url) ?>images/vignan's_logo.png" alt="Vignan Logo" class="logo-vignan">
                      <img src="<?= htmlspecialchars($base_url) ?>images/iqac_logo.png" alt="IQAC Logo" class="logo-iqac">
                    </div>
                    <div class="header-divider"></div>
                    <h3 class="card-bright-title"><?= htmlspecialchars($form['title']) ?></h3>
                  </div>
                  
                  <!-- QR Code Area -->
                  <div class="front-qr-section">
                    <div class="qr-viewfinder">
                      <div class="scanner-line"></div>
                      <?php if (!empty($form['qr_image_path'])): ?>
                        <img src="<?= htmlspecialchars($form['qr_image_path']) ?>" alt="QR Code">
                      <?php else: ?>
                        <svg class="placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      <?php endif; ?>
                    </div>
                  </div>
                  
                  <!-- Footer Info (Premium Curve Match) -->
                  <div class="front-footer">
                    <div class="footer-left">
                      <span class="footer-query">Any queries reach<br>out to us at</span>
                      <strong class="footer-office">Office of IQAC,<br>VFSTR</strong>
                    </div>
                    <div class="footer-right">
                      <div class="footer-contact"><span class="icon-circle"><svg width="8" height="8" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"></path></svg></span> 0863 - 2344700 | Ext.: 1027</div>
                      <div class="footer-contact"><span class="icon-circle"><svg width="8" height="8" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg></span> qualityinitiatives@vignan.ac.in</div>
                      <div class="footer-contact"><span class="icon-circle"><svg width="8" height="8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path></svg></span> https://vignan.ac.in/feedbackfacility.php</div>
                    </div>
                  </div>
                </div>

                <!-- Back Side (Unified Structure) -->
                <div class="form-card-back">
                  <!-- Official Logo Header -->
                  <div class="card-official-header">
                    <div class="card-logos">
                      <img src="<?= htmlspecialchars($base_url) ?>images/vignan's_logo.png" alt="Vignan Logo" class="logo-vignan">
                      <img src="<?= htmlspecialchars($base_url) ?>images/iqac_logo.png" alt="IQAC Logo" class="logo-iqac">
                    </div>
                    <div class="header-divider"></div>
                    <h3 class="card-bright-title"><?= htmlspecialchars($form['title']) ?></h3>
                  </div>
                  
                  <!-- Back Side Middle (Description + Button) -->
                  <div class="front-qr-section" style="background-color: #ffffff; padding: 16px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; overflow: hidden; flex: 1 1 auto;">
                    <?php if (!empty($form['description'])): ?>
                      <div class="back-description" style="color: #4b5563; font-size: 14.5px; text-align: center; line-height: 1.6; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; width: 100%;">
                        <?= htmlspecialchars($form['description']) ?>
                      </div>
                    <?php endif; ?>
                    
                    <div style="width: 100%; display: flex; justify-content: center; margin-top: auto; margin-bottom: auto;">
                      <a href="users/user.php?id=<?= htmlspecialchars(urlencode($form['id'])) ?>" class="btn-fill-form btn-back-side" target="_blank">
                        Submit Feedback
                        <svg class="tinkle-arrow" width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                      </a>
                    </div>
                  </div>
                  
                  <!-- Footer Info (Premium Curve Match) -->
                  <div class="front-footer">
                    <div class="footer-left">
                      <span class="footer-query">Any queries reach<br>out to us at</span>
                      <strong class="footer-office">Office of IQAC,<br>VFSTR</strong>
                    </div>
                    <div class="footer-right">
                      <div class="footer-contact"><span class="icon-circle"><svg width="8" height="8" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"></path></svg></span> 0863 - 2344700 | Ext.: 1027</div>
                      <div class="footer-contact"><span class="icon-circle"><svg width="8" height="8" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg></span> qualityinitiatives@vignan.ac.in</div>
                      <div class="footer-contact"><span class="icon-circle"><svg width="8" height="8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path></svg></span> https://vignan.ac.in/feedbackfacility.php</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          <?php endforeach; ?>

        <?php endif; ?>
      </div>

    </div>
  </main>

  <?php include 'includes/footer.php'; ?>

  <script>
    let searchDebounceTimer;
    
    function debounceSearch() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(filterForms, 250);
    }

    function filterForms() {
      const input = document.getElementById('form-search-input');
      const clearBtn = document.getElementById('clearSearch');
      
      if (!input) return;
      const filter = input.value.toLowerCase();
      
      if (clearBtn) {
          clearBtn.style.display = filter.length > 0 ? 'block' : 'none';
      }

      const grid = document.querySelector('.forms-grid');
      const cards = grid.querySelectorAll('.form-card-container');
      
      let visibleCount = 0;
      cards.forEach(card => {
        const title = card.querySelector('.card-bright-title').textContent.toLowerCase();
        if (title.includes(filter)) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });
      
      let noMatchMsg = document.getElementById('no-match-msg');
      if (visibleCount === 0 && cards.length > 0) {
        if (!noMatchMsg) {
          noMatchMsg = document.createElement('div');
          noMatchMsg.id = 'no-match-msg';
          noMatchMsg.className = 'empty-state';
          noMatchMsg.style.gridColumn = '1 / -1';
          noMatchMsg.innerHTML = '<p>No forms match your search.</p>';
          grid.appendChild(noMatchMsg);
        }
        noMatchMsg.style.display = 'flex';
      } else if (noMatchMsg) {
        noMatchMsg.style.display = 'none';
      }
    }

    function clearSearchInput() {
      const input = document.getElementById('form-search-input');
      if (input) {
          input.value = '';
          filterForms();
          input.focus();
      }
    }
  </script>

</body>
</html>
