<?php
require_once '../configuration/config.php';
require_once '../includes/auth.php';

// Load options.json
$options_json_path = '../options.json';
if (!file_exists($options_json_path)) {
    die("Error: options.json not found.");
}
$options_json = file_get_contents($options_json_path);
$options_data = json_decode($options_json, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    die("Error: Failed to parse options.json.");
}

// Index options by group_id
$option_groups = [];
foreach ($options_data as $group) {
    if (isset($group['group_id'])) {
        $option_groups[$group['group_id']] = isset($group['options']) ? $group['options'] : [];
    }
}

// Fetch form details using query parameter 'id' (fallback to 1)
$form_id = isset($_GET['id']) ? intval($_GET['id']) : 1;

try {
    $form_stmt = $pdo->prepare("SELECT * FROM forms WHERE id = :id LIMIT 1");
    $form_stmt->execute(['id' => $form_id]);
    $form = $form_stmt->fetch();
    if (!$form) {
        $form = [
            'id' => $form_id,
            'title' => 'Feedback Form',
            'description' => 'Feedback Survey for Stakeholders.'
        ];
    }
} catch (PDOException $e) {
    $form = [
        'id' => $form_id,
        'title' => 'Feedback Form',
        'description' => 'Feedback Survey for Stakeholders.'
    ];
}

// Fetch questions for form ID
$questions = [];
try {
    $q_stmt = $pdo->prepare("SELECT * FROM questions WHERE form_id = :form_id ORDER BY step_no ASC, question_order ASC");
    $q_stmt->execute(['form_id' => $form['id']]);
    $questions = $q_stmt->fetchAll();
} catch (PDOException $e) {
    die("Database query error: " . $e->getMessage());
}

// Group questions by step_no for clean layout
$steps = [];
foreach ($questions as $q) {
    $step_no = intval($q['step_no']);
    $steps[$step_no][] = $q;
}
ksort($steps);
$total_steps = count($steps);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Response - <?= htmlspecialchars($form['title']) ?></title>
  <link rel="stylesheet" href="../users/user.css">
</head>
<body>

  <?php 
    $base_url = '../';
    include '../includes/header.php'; 
  ?>

  <!-- Main Content Body -->
  <main class="site-main">
    <div class="form-container">
      
      <!-- Top Action Bar -->
      <div class="response-header-actions">
        <h2 class="form-title" style="margin-bottom: 0; font-size: 26px;">Response Summary</h2>
        <div class="action-buttons-flex">
          <button type="button" class="btn-secondary" onclick="window.print()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 6px; vertical-align: middle;"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-12 0v5h12v-5m-12 0h12"></path></svg>
            Print
          </button>
          <a href="../users/user.php?id=<?= $form['id'] ?>" class="btn-primary" style="text-decoration: none;">
            Submit New Response
          </a>
        </div>
      </div>

      <!-- No Response Alert -->
      <div id="no-response-alert" class="response-alert-card" style="display: none;">
        <strong>Notice:</strong> No locally stored response was found for this session. The response details shown below might be blank. Fill out the feedback form to view your recorded answers.
      </div>

      <!-- Main response viewer layout -->
      <div class="response-container">
        
        <!-- Header details card -->
        <div class="card title-card">
          <h2 class="form-title"><?= htmlspecialchars($form['title']) ?></h2>
          <p style="margin-top: 8px; color: var(--text-secondary);"><?= htmlspecialchars($form['description']) ?></p>
          <div style="margin-top: 16px; font-weight: 500; font-size: 14px; color: var(--primary-color);">
            Status: Feedback Successfully Recorded
          </div>
        </div>

        <!-- Render all questions in structured summary -->
        <?php foreach ($steps as $step_no => $step_questions): ?>
          <!-- Step Header -->
          <div class="summary-step-header">
            Page <?= $step_no ?> OF <?= $total_steps ?>
          </div>

          <!-- Step Cards: stacked full-width -->
          <div class="summary-step-cards">
            <?php foreach ($step_questions as $q): 
              $q_name = "question_" . $q['id'];
              $type = $q['type'];
            ?>
              <div class="summary-item" id="q-card-<?= $q['id'] ?>" data-qname="<?= $q_name ?>" data-type="<?= $type ?>">
                <div class="summary-question">
                  <?= htmlspecialchars($q['question']) ?>
                </div>
                
                <!-- Display answer value -->
                <div class="summary-answer" id="ans-container-<?= $q['id'] ?>">
                  Loading response...
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endforeach; ?>

      </div>

    </div>
  </main>

  <?php include '../includes/footer.php'; ?>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // 1. Retrieve feedback data from sessionStorage
      const dataStr = sessionStorage.getItem('vignan_user_feedback');
      const noResponseAlert = document.getElementById('no-response-alert');
      
      let responses = {};
      if (!dataStr) {
        noResponseAlert.style.display = 'block';
      } else {
        try {
          responses = JSON.parse(dataStr);
        } catch (e) {
          console.error("Error parsing response JSON", e);
          noResponseAlert.style.display = 'block';
        }
      }

      // 2. Scan all question cards on the page and populate their values
      const cards = document.querySelectorAll('.summary-item');
      cards.forEach(card => {
        const qId = card.id.replace('q-card-', '');
        const qName = card.getAttribute('data-qname');
        const qType = card.getAttribute('data-type');
        const container = document.getElementById('ans-container-' + qId);
        
        if (!container) return;

        let value = responses[qName];
        let hasValue = (value !== undefined && value !== null && value !== '');

        if (qType === 'checkbox' || qType === 'checkbox_grid') {
          // Checkboxes store array of values
          const selectedList = Array.isArray(value) ? value : [];
          
          if (selectedList.length === 0) {
            container.textContent = 'Not answered';
            container.classList.add('not-answered');
          } else {
            const tags = [];
            selectedList.forEach(opt => {
              if (opt && opt.toLowerCase().startsWith('other')) {
                const otherVal = responses[qName + '_other'] || '';
                tags.push(otherVal ? `Other: ${otherVal}` : 'Other');
              } else {
                tags.push(opt);
              }
            });
            container.textContent = tags.join(', ');
            container.classList.remove('not-answered');
          }
        } else if (qType === 'select' || qType === 'radio' || qType === 'rating' || qType === 'linear_scale' || qType === 'radio_grid' || qType === 'slider_grid') {
          // Select/Radio dropdown/option value
          if (!hasValue) {
            container.textContent = 'Not answered';
            container.classList.add('not-answered');
          } else if (value && value.toLowerCase().startsWith('other')) {
            const otherVal = responses[qName + '_other'] || '';
            container.textContent = otherVal ? `Other: ${otherVal}` : 'Other';
            container.classList.remove('not-answered');
          } else {
            container.textContent = value;
            container.classList.remove('not-answered');
          }
        } else {
          // Text/Textarea standard input values
          if (!hasValue) {
            container.textContent = 'Not answered';
            container.classList.add('not-answered');
          } else {
            container.textContent = value;
            container.classList.remove('not-answered');
          }
        }
      });

      // Helper to escape HTML characters
      function escapeHtml(text) {
        if (!text) return '';
        return text
          .toString()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
    });
  </script>
</body>
</html>
