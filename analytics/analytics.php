<?php
require_once '../includes/auth.php';
requireAdmin();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Dashboard</title>
  <link rel="stylesheet" href="../users/user.css">
  <link rel="stylesheet" href="analytics.css?v=<?= filemtime(__DIR__ . '/analytics.css') ?>">
</head>
<body>

  <?php 
    $base_url = '../';
    include '../includes/header.php'; 
  ?>

  <!-- Main Content Body -->
  <main class="site-main">
    <div class="form-container" id="dashboard-container">
      
      <div class="card title-card">
        <h2 class="form-title">Forms Analytics Dashboard</h2>
        <p class="form-desc" style="margin-top: 8px;">Select a form to view its analytics, or view responses directly.</p>
      </div>
      
      <?php include 'analytics_view.php'; ?>
    </div>
  </main>

  <?php include '../includes/footer.php'; ?>

  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <script src="pptxgen.bundle.js"></script>
  <script src="chart.js"></script>
  <script src="analytics.js?v=<?= filemtime(__DIR__ . '/analytics.js') ?>"></script>

</body>
</html>
