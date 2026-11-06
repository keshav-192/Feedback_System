<?php
// admin/login.php
session_start();
require_once '../configuration/config.php';
require_once '../trace_log.php';

// Prevent caching of the login page
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// If accessing the login page while logged in (e.g., via browser back button), log them out immediately
if (isset($_SESSION['admin_id'])) {
    session_unset();
    session_destroy();
    session_start(); // Start a fresh session for the login form
}

$error = $_SESSION['login_error'] ?? '';
unset($_SESSION['login_error']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $emp_id = trim($_POST['emp_id'] ?? '');
    $password = trim($_POST['password'] ?? '');

    if (empty($emp_id) || empty($password)) {
        $_SESSION['login_error'] = "Please enter both Employee ID and password.";
        header("Location: login.php");
        exit;
    } else {
        try {
            $stmt = $pdo->prepare("SELECT * FROM admins WHERE emp_id = :emp_id");
            $stmt->execute(['emp_id' => $emp_id]);
            $admin = $stmt->fetch();

            if ($admin && password_verify($password, $admin['password_hash'])) {
                // Login successful
                writeLog("Admin Login Success (Emp ID: $emp_id)", 'admin');
                $_SESSION['admin_id'] = $admin['id'];
                $_SESSION['admin_emp_id'] = $admin['emp_id'];
                $_SESSION['admin_role'] = $admin['role'];

                // Update last_login
                $update = $pdo->prepare("UPDATE admins SET last_login = NOW() WHERE id = :id");
                $update->execute(['id' => $admin['id']]);

                $_SESSION['just_logged_in'] = true;

                header("Location: index.php");
                exit;
            } else {
                writeLog("Admin Login Failed (Emp ID: $emp_id)", 'admin');
                $_SESSION['login_error'] = "Invalid Employee ID or password.";
                header("Location: login.php");
                exit;
            }
        } catch (PDOException $e) {
            $_SESSION['login_error'] = "Database error: " . $e->getMessage();
            header("Location: login.php");
            exit;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <script>
    // Force page reload if loaded from BFCache (back/forward button)
    // This clears filled credentials and re-runs PHP session checks.
    window.addEventListener("pageshow", function(event) {
        if (event.persisted) {
            window.location.reload();
        }
    });
    // Clear form inputs when leaving the page
    window.addEventListener("pagehide", function() {
        const form = document.querySelector('form');
        if (form) form.reset();
    });
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - Stakeholder Feedback</title>
  <link rel="stylesheet" href="admin.css?v=13">
  <style>
    /* Make body a flex container to take full height */
    body {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      margin: 0;
    }
    
    .login-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-grow: 1; /* Takes up remaining space between header and footer */
      padding: 40px 16px;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      text-align: center;
      border-top: 4px solid var(--primary-color);
      /* Add some margin to ensure it doesn't touch the header on small screens */
      margin: auto; 
    }
    .login-card .form-group {
      text-align: left;
    }
    .error-msg {
      background-color: #fee2e2;
      color: #ef4444;
      padding: 10px;
      border-radius: var(--radius-md);
      margin-bottom: 16px;
      font-size: 14px;
      border: 1px solid #fecaca;
    }
    .login-card .form-control {
      width: 100%;
      box-sizing: border-box;
    }
  </style>
</head>
<body>

  <?php 
    $base_url = '../';
    include '../includes/header.php'; 
  ?>

  <!-- Main Content Body -->
  <main class="site-main login-wrapper">
    <div class="card login-card">
      <h2 style="color: var(--primary-color); margin-top: 0; margin-bottom: 8px;">Admin Login</h2>
      <p class="text-secondary" style="margin-bottom: 24px;">Enter your Employee ID and password.</p>

      <?php if ($error): ?>
          <div id="errorMsg" class="error-msg"><?php echo htmlspecialchars($error); ?></div>
      <?php endif; ?>

      <form method="POST" action="login.php">
          <div class="form-group" style="margin-bottom: 16px;">
              <label for="emp_id">Employee ID</label>
              <input type="text" id="emp_id" name="emp_id" class="form-control" required autofocus>
          </div>
          <div class="form-group" style="margin-bottom: 24px;">
              <label for="password">Password</label>
              <div style="position: relative;">
                  <input type="password" id="password" name="password" class="form-control" required style="padding-right: 40px;">
                  <button type="button" id="togglePassword" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6b7280; padding: 0; display: flex; align-items: center; justify-content: center;">
                      <!-- Eye Icon (Closed by default) -->
                      <svg id="eyeIcon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                  </button>
              </div>
          </div>
          <button type="submit" class="btn-primary" style="width: 100%;">Sign In</button>
      </form>
    </div>
  </main>

  <?php include '../includes/footer.php'; ?>

  <script>
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');

    togglePassword.addEventListener('click', function (e) {
      // Toggle the type attribute
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      // Toggle the eye icon SVG
      if (type === 'text') {
        // Eye Open icon
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />';
      } else {
        // Eye Closed (crossed) icon
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />';
      }
    });

    // Hide error message after 2 seconds
    const errorMsg = document.getElementById('errorMsg');
    if (errorMsg) {
      setTimeout(() => {
        errorMsg.style.transition = 'opacity 0.5s ease';
        errorMsg.style.opacity = '0';
        setTimeout(() => {
          errorMsg.style.display = 'none';
        }, 500); // wait for fade out transition to finish
      }, 2000); // 2000ms = 2 seconds
    }
  </script>
</body>
</html>
