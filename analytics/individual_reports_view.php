<?php
// analytics/individual_reports_view.php
require_once '../configuration/config.php';
require_once '../includes/auth.php';
requireAdmin();

$form_id = isset($_GET['form_id']) ? intval($_GET['form_id']) : 1;

// Fetch Form Title
$form_title = 'Feedback Form';
try {
    $stmt = $pdo->prepare("SELECT title FROM forms WHERE id = :id");
    $stmt->execute(['id' => $form_id]);
    if ($f = $stmt->fetch()) {
        $form_title = $f['title'];
    }
} catch(PDOException $e) {}

// Fetch ALL questions for this form
$all_questions = [];
try {
    $q_stmt = $pdo->prepare("SELECT id, question, type, filter, active, option_group_id FROM questions WHERE form_id = :form_id ORDER BY step_no ASC, question_order ASC");
    $q_stmt->execute(['form_id' => $form_id]);
    $db_questions = $q_stmt->fetchAll();
    
    $status_filter = isset($_GET['status']) ? trim($_GET['status']) : 'all';
    foreach ($db_questions as $q) {
        if ($status_filter === 'active' && intval($q['active']) === 0) continue;
        if ($status_filter === 'archived' && intval($q['active']) === 1) continue;
        $all_questions[] = $q;
    }
} catch (PDOException $e) {
    die("Error fetching questions");
}

// Find filterable questions
$filterable_questions = [];
foreach ($all_questions as $q) {
    if (intval($q['filter']) === 1 && in_array($q['type'], ['select', 'radio', 'checkbox'])) {
        $filterable_questions[$q['question']] = [];
    }
}

if (!function_exists('classifyDateInput')) {
    function classifyDateInput($input) {
        if (empty($input)) return ['type' => 'empty'];
        $input = trim($input);
        $cleaned = trim(preg_replace('/\bdd\b|\bmm\b/i', '', $input), " -/.,");
        if (empty($cleaned)) return ['type' => 'empty'];

        // 1. Year only (YYYY)
        if (preg_match('/^(\d{4})$/', $cleaned, $m)) {
            $y = (int)$m[1];
            if ($y >= 1900 && $y <= 2100) {
                return ['type' => 'year', 'year' => $y, 'from_sql' => "$y-01-01 00:00:00", 'to_sql' => "$y-12-31 23:59:59"];
            }
            return ['type' => 'invalid', 'error' => "Year must be between 1900 and 2100."];
        }

        // 2. Month-Year (MM-YYYY or MM/YYYY)
        if (preg_match('/^(\d{1,2})[-\/.](\d{4})$/', $cleaned, $m)) {
            $m_num = (int)$m[1];
            $y = (int)$m[2];
            if ($y < 1900 || $y > 2100) return ['type' => 'invalid', 'error' => "Year must be between 1900 and 2100."];
            if ($m_num < 1 || $m_num > 12) return ['type' => 'invalid', 'error' => "Month must be between 01 and 12."];
            $month = str_pad($m_num, 2, '0', STR_PAD_LEFT);
            $lastDay = date('t', strtotime("$y-$month-01"));
            return ['type' => 'month_year', 'year' => $y, 'month' => $m_num, 'from_sql' => "$y-$month-01 00:00:00", 'to_sql' => "$y-$month-$lastDay 23:59:59"];
        }

        // 3. Full Date DD-MM-YYYY or DD/MM/YYYY
        if (preg_match('/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/', $cleaned, $m)) {
            $d_num = (int)$m[1];
            $m_num = (int)$m[2];
            $y = (int)$m[3];
            if ($y < 1900 || $y > 2100) return ['type' => 'invalid', 'error' => "Year must be between 1900 and 2100."];
            if ($m_num < 1 || $m_num > 12) return ['type' => 'invalid', 'error' => "Month must be between 01 and 12."];
            if (!checkdate($m_num, $d_num, $y)) return ['type' => 'invalid', 'error' => "Invalid calendar date."];
            $day = str_pad($d_num, 2, '0', STR_PAD_LEFT);
            $month = str_pad($m_num, 2, '0', STR_PAD_LEFT);
            return ['type' => 'full_date', 'year' => $y, 'month' => $m_num, 'day' => $d_num, 'from_sql' => "$y-$month-$day 00:00:00", 'to_sql' => "$y-$month-$day 23:59:59"];
        }

        // 4. ISO Full Date YYYY-MM-DD
        if (preg_match('/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/', $cleaned, $m)) {
            $y = (int)$m[1];
            $m_num = (int)$m[2];
            $d_num = (int)$m[3];
            if (!checkdate($m_num, $d_num, $y)) return ['type' => 'invalid', 'error' => "Invalid calendar date."];
            $day = str_pad($d_num, 2, '0', STR_PAD_LEFT);
            $month = str_pad($m_num, 2, '0', STR_PAD_LEFT);
            return ['type' => 'full_date', 'year' => $y, 'month' => $m_num, 'day' => $d_num, 'from_sql' => "$y-$month-$day 00:00:00", 'to_sql' => "$y-$month-$day 23:59:59"];
        }

        return ['type' => 'invalid', 'error' => "Unrecognized date format."];
    }
}

if (!function_exists('validateDateRangeParams')) {
    function validateDateRangeParams($raw_from, $raw_to) {
        $from_info = classifyDateInput($raw_from);
        $to_info = classifyDateInput($raw_to);

        if ($from_info['type'] === 'empty' && $to_info['type'] === 'empty') {
            return ['valid' => true, 'parsed_from' => null, 'parsed_to' => null];
        }
        if ($from_info['type'] === 'empty' || $to_info['type'] === 'empty') {
            return ['valid' => false, 'error' => "Both 'From' and 'To' dates must be provided."];
        }
        if ($from_info['type'] === 'invalid') return ['valid' => false, 'error' => $from_info['error']];
        if ($to_info['type'] === 'invalid') return ['valid' => false, 'error' => $to_info['error']];
        if ($from_info['type'] !== $to_info['type']) return ['valid' => false, 'error' => "Mismatched date formats."];

        if ($from_info['type'] === 'year' && $to_info['year'] < $from_info['year']) {
            return ['valid' => false, 'error' => "'To' year cannot be earlier than 'From' year."];
        } elseif ($from_info['type'] === 'month_year') {
            if ($to_info['year'] < $from_info['year']) return ['valid' => false, 'error' => "'To' year cannot be earlier than 'From' year."];
            if ($to_info['year'] === $from_info['year'] && $to_info['month'] < $from_info['month']) return ['valid' => false, 'error' => "'To' month cannot be earlier than 'From' month."];
        } elseif ($from_info['type'] === 'full_date') {
            if (strtotime($to_info['to_sql']) < strtotime($from_info['from_sql'])) return ['valid' => false, 'error' => "'To' date cannot be earlier than 'From' date."];
        }

        return ['valid' => true, 'parsed_from' => $from_info['from_sql'], 'parsed_to' => $to_info['to_sql']];
    }
}

if (!function_exists('parseDateFilter')) {
    function parseDateFilter($input, $isEndDate = false) {
        $info = classifyDateInput($input);
        if ($info['type'] === 'empty' || $info['type'] === 'invalid') return null;
        return $isEndDate ? $info['to_sql'] : $info['from_sql'];
    }
}

// Get Filters
$filter_year = isset($_GET['year']) ? trim($_GET['year']) : '';
$filter_date_from = isset($_GET['date_from']) ? trim($_GET['date_from']) : '';
$filter_date_to = isset($_GET['date_to']) ? trim($_GET['date_to']) : '';
$filters_json = isset($_GET['filters']) ? trim($_GET['filters']) : '{}';
$active_filters = json_decode($filters_json, true);
if (!is_array($active_filters)) $active_filters = [];

$date_val = validateDateRangeParams($filter_date_from, $filter_date_to);
$parsed_from = $date_val['valid'] ? $date_val['parsed_from'] : null;
$parsed_to = $date_val['valid'] ? $date_val['parsed_to'] : null;

// Fetch Responses
$responses = [];
try {
    $sql = "SELECT id, respondent_id, response, submitted_at FROM responses WHERE form_id = ?";
    $params = [$form_id];

    if ($filter_year !== '') {
        $year_arr = array_filter(array_map('intval', explode(',', $filter_year)));
        if (!empty($year_arr)) {
            $placeholders = implode(',', array_fill(0, count($year_arr), '?'));
            $sql .= " AND YEAR(submitted_at) IN ($placeholders)";
            $params = array_merge($params, array_values($year_arr));
        }
    }

    if ($parsed_from !== null) {
        $sql .= " AND submitted_at >= ?";
        $params[] = $parsed_from;
    }
    if ($parsed_to !== null) {
        $sql .= " AND submitted_at <= ?";
        $params[] = $parsed_to;
    }

    $sql .= " ORDER BY submitted_at DESC";
    $r_stmt = $pdo->prepare($sql);
    $r_stmt->execute($params);
    $responses = $r_stmt->fetchAll();
} catch (PDOException $e) {
    die("Error fetching responses");
}

// Filter Responses
$valid_responses = [];
foreach ($responses as $r) {
    $resp_json = json_decode($r['response'], true);
    if (!is_array($resp_json)) continue;
    
    $matches_all_filters = true;
    foreach ($active_filters as $fq_text => $f_val) {
        if (empty($f_val)) continue;
        if (!isset($resp_json[$fq_text])) {
            $matches_all_filters = false;
            break;
        }
        $ans = $resp_json[$fq_text];
        $ans_arr = is_array($ans) ? array_map('trim', $ans) : array_map('trim', explode(', ', (string)$ans));
        $has_match = false;
        
        if (is_array($f_val)) {
            foreach ($ans_arr as $a) {
                if (strpos($a, 'Other:') === 0) $a = 'Other';
                if (in_array($a, $f_val)) { $has_match = true; break; }
            }
        } else {
            foreach ($ans_arr as $a) {
                if (strpos($a, 'Other:') === 0) $a = 'Other';
                if ($a === $f_val) { $has_match = true; break; }
            }
        }
        
        if (!$has_match) {
            $matches_all_filters = false;
            break;
        }
    }
    
    if (!$matches_all_filters) continue;
    
    $valid_responses[] = [
        'id' => $r['id'],
        'respondent_id' => $r['respondent_id'],
        'submitted_at' => $r['submitted_at'],
        'answers' => $resp_json
    ];
}

// Build question map and apply heuristic to valid_responses
$options_json_path = '../options.json';
$options_data = [];
if (file_exists($options_json_path)) {
    $options_data = json_decode(file_get_contents($options_json_path), true);
}
$option_groups = [];
if (is_array($options_data)) {
    foreach ($options_data as $grp) {
        if (isset($grp['group_id'])) {
            $option_groups[$grp['group_id']] = $grp;
        }
        if (isset($grp['group_name']) && $grp['group_name'] !== '') {
            $option_groups[$grp['group_name']] = $grp;
        }
    }
}

$question_map = [];
foreach ($all_questions as &$q) {
    $q_text = trim($q['original_question'] ?? $q['question']);
    $group_id = $q['option_group_id'];
    $group_options = [];
    if (isset($option_groups[$group_id]['options'])) {
        foreach ($option_groups[$group_id]['options'] as $opt) {
            $group_options[] = $opt['label'];
        }
    }
    
    $display_text = intval($q['active']) === 1 ? $q_text : $q_text . " [Archived v" . $q['id'] . "]";
    $q['display_text'] = $display_text;
    
    if (!isset($question_map[$q_text])) {
        $question_map[$q_text] = [];
    }
    $question_map[$q_text][] = [
        'active' => intval($q['active']),
        'display_text' => $display_text,
        'options' => $group_options
    ];
}
unset($q);

foreach ($valid_responses as &$vr) {
    $new_answers = [];
    foreach ($vr['answers'] as $q_text => $answer) {
        $q_text = trim($q_text);
        if (!isset($question_map[$q_text])) {
            $new_answers[$q_text] = $answer;
            continue;
        }
        
        $refs = $question_map[$q_text];
        $best_ref = null;
        if (count($refs) === 1) {
            $best_ref = $refs[0];
        } else {
            $match_scores = [];
            foreach ($refs as $r) {
                $score = 0;
                $opts = array_map('strtolower', array_map('trim', $r['options']));
                $answer_is_array = is_array($answer);
                $ans_str = $answer_is_array ? implode(', ', $answer) : (string)$answer;
                $ans_lower = strtolower(trim($ans_str));
                if (!$answer_is_array && in_array($ans_lower, $opts)) {
                    $score += 10;
                } else if ($answer_is_array) {
                    $selected_opts = array_map('trim', $answer);
                    $match_count = 0;
                    foreach ($selected_opts as $opt) {
                        if (strpos($opt, 'Other:') === 0) $opt = 'Other';
                        if (in_array(strtolower($opt), $opts)) $match_count++;
                    }
                    if ($match_count > 0) $score += 10;
                }
                if ($r['active']) $score += 1;
                $match_scores[] = ['ref' => $r, 'score' => $score];
            }
            usort($match_scores, function($a, $b) { return $b['score'] <=> $a['score']; });
            $best_ref = $match_scores[0]['ref'];
        }
        $new_answers[$best_ref['display_text']] = $answer;
    }
    $vr['answers'] = $new_answers;
}
unset($vr);

// Construct Title Strings for the view
$filter_text_parts = [];
if ($filter_year) $filter_text_parts[] = $filter_year . " (Academic Year)";
foreach ($active_filters as $k => $v) {
    if (!empty($v)) {
        if (is_array($v)) {
            $filter_text_parts[] = implode(', ', $v);
        } else {
            $filter_text_parts[] = $v;
        }
    }
}
$title_filters_str = empty($filter_text_parts) ? '' : implode(' - ', $filter_text_parts) . ' - ';
$report_title = $title_filters_str . $form_title . ' Stacked Feedback Reports';

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title><?= htmlspecialchars($report_title) ?></title>
  <link rel="stylesheet" href="../users/user.css">
  <link rel="stylesheet" href="analytics.css?v=5">
  <script src="html2canvas.min.js"></script>
  <script src="jspdf.umd.min.js"></script>
  <style>
    /* Table Container & Sizing Overrides */
    .chart-data-table-container {
      max-height: none !important;
      overflow-y: visible !important;
    }
    /* Compact Table Styles */
    .chart-data-table {
      font-size: 14px !important;
      width: 100%;
      border-collapse: collapse;
    }
    .chart-data-table td {
      padding: 12px 16px !important;
      border: 1px solid #d1d5db !important;
      vertical-align: top !important;
      white-space: normal !important;
      color: var(--text-main);
    }
    
    .chart-data-table tr:nth-child(even) td {
      background-color: #f8fafc !important;
    }
    .chart-data-table tr:nth-child(odd) td {
      background-color: #ffffff !important;
    }

    .q-col {
      width: 60%;
      font-weight: 500;
    }
    .colon-col {
      width: 10px;
      text-align: center;
      font-weight: bold;
      border-left: none !important;
      border-right: none !important;
    }
    .a-col {
      width: calc(40% - 10px);
    }
    
    /* Remove inner border around colon for cleaner look */
    .chart-data-table td.q-col { border-right: none !important; }
    .chart-data-table td.a-col { border-left: none !important; }

    .report-card {
      margin-bottom: 24px;
    }

    /* Print-specific adjustments */
    @media print {
      body { background: #fff !important; }
      .site-header, .site-footer, .print-btn-container, .title-card { display: none !important; }
      .card { border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
      .chart-data-table td { color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .chart-data-table tr:nth-child(even) td { background-color: #f1f5f9 !important; }
      @page { margin: 1cm; size: portrait; }
      
      .report-card {
        page-break-after: always;
        break-after: page;
        margin-bottom: 0;
        padding-top: 1cm !important;
      }
      .report-card:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }

    /* Download button & PDF Generation Styles */
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin {
      animation: spin 1s linear infinite;
    }

    .btn-download {
      background-color: #10b981;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      transition: background-color 0.2s, opacity 0.2s, transform 0.1s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .btn-download:hover {
      background-color: #059669;
    }
    .btn-download:active {
      transform: translateY(1px);
    }
    .btn-download:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* Clean snapshot styling during PDF export */
    body.pdf-exporting .site-header,
    body.pdf-exporting .site-footer,
    body.pdf-exporting .title-card,
    body.pdf-exporting .print-btn-container {
      display: none !important;
    }
    body.pdf-exporting .card.report-card {
      box-shadow: none !important;
      border: 1px solid #e2e8f0 !important;
      background-color: #ffffff !important;
      margin-bottom: 0 !important;
    }
  </style>
</head>
<body>

  <?php 
    $base_url = '../';
    include '../includes/header.php'; 
  ?>

  <main class="site-main">
    <div class="form-container" style="max-width: 1000px; margin: 0 auto; padding: 24px 15px;">
      
      <!-- Title & Controls Card -->
      <div class="card title-card" style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <h2 class="form-title" style="color: var(--primary-color); margin: 0;"><?= htmlspecialchars($report_title) ?></h2>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <p style="color: var(--text-secondary); margin: 0; font-size: 15px;">Viewing <?= count($valid_responses) ?> individual reports.</p>
          <div class="print-btn-container" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <button type="button" class="btn-download" id="downloadPdfBtn" onclick="downloadAllReportsPdf()">
              <svg id="downloadPdfIcon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              <span id="downloadPdfText">Download PDF</span>
            </button>
            <button type="button" class="btn-primary" style="display: flex; align-items: center; gap: 8px;" onclick="window.print()">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              <span>Print All Reports</span>
            </button>
          </div>
        </div>
      </div>

      <?php if (count($valid_responses) > 0): ?>
        <?php foreach ($valid_responses as $vr): ?>
          <!-- Individual Report Card -->
          <div class="card report-card">
            
            <!-- Report Specific Header with Logos (for printing each page) -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--border-color);">
              <div style="display: flex; gap: 12px; align-items: center;">
                <img src="<?= defined('BASE_URL') ? BASE_URL : '../' ?>images/vignan's_logo.png" alt="Vignan Logo" style="height: 55px; object-fit: contain;">
                <img src="<?= defined('BASE_URL') ? BASE_URL : '../' ?>images/iqac_logo.png" alt="IQAC Logo" style="height: 45px; object-fit: contain;">
              </div>
              <div style="text-align: center;">
                <h3 style="margin: 0; color: var(--primary-color); font-size: 16px;">
                  <?= htmlspecialchars($form_title) ?> - Individual Report
                </h3>
              </div>
            </div>

            <div class="chart-data-table-container" style="margin-top: 0;">
              <table class="chart-data-table">
                <tbody>
                  
                  <!-- Removed Respondent ID and Submitted At as per request -->

                  <?php 
                    $allowed_questions = array_map(function($q) { return trim($q['display_text']); }, $all_questions);
                  ?>
                  <!-- Dynamic Questions from Response -->
                  <?php foreach ($vr['answers'] as $q_text => $ans): 
                    if (!in_array(trim($q_text), $allowed_questions)) continue;
                    $ans_str = is_array($ans) ? implode(', ', $ans) : (string)$ans;
                  ?>
                    <tr>
                      <td class="q-col"><?= htmlspecialchars($q_text) ?></td>
                      <td class="colon-col">:</td>
                      <td class="a-col"><?= htmlspecialchars($ans_str) ?></td>
                    </tr>
                  <?php endforeach; ?>

                </tbody>
              </table>
            </div>
          </div>
        <?php endforeach; ?>
      <?php else: ?>
        <div class="card">
          <p style="text-align: center; color: var(--text-secondary); padding: 40px 0;">No responses found for the selected filters.</p>
        </div>
      <?php endif; ?>

    </div>
  </main>

  <?php include '../includes/footer.php'; ?>

  <script>
    async function downloadAllReportsPdf() {
      const btn = document.getElementById('downloadPdfBtn');
      const cards = document.querySelectorAll('.report-card');

      if (!cards || cards.length === 0) {
        alert('No individual reports found to download.');
        return;
      }

      if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        alert('PDF generation libraries could not be loaded. Please ensure jspdf and html2canvas are available.');
        return;
      }

      const originalHtml = btn.innerHTML;
      btn.disabled = true;

      // Add export class to apply clean styling during capture
      document.body.classList.add('pdf-exporting');

      try {
        // Ensure images are fully loaded
        const images = Array.from(document.querySelectorAll('.report-card img'));
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        });

        const pdfPageWidth = 210;
        const pdfPageHeight = 297;
        const margin = 10;
        const contentWidth = pdfPageWidth - (margin * 2); // 190 mm
        const contentHeight = pdfPageHeight - (margin * 2); // 277 mm

        let pageCount = 0;
        const totalCards = cards.length;

        for (let i = 0; i < totalCards; i++) {
          const card = cards[i];
          btn.innerHTML = `
            <svg class="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity: 0.25;"></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" style="opacity: 0.75;"></path>
            </svg>
            <span>Generating (${i + 1}/${totalCards})...</span>
          `;

          // Capture the card with html2canvas
          const canvas = await html2canvas(card, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const cardPdfHeight = (canvas.height * contentWidth) / canvas.width;

          if (cardPdfHeight <= contentHeight) {
            // Fits cleanly on a single page
            if (pageCount > 0) {
              pdf.addPage();
            }
            pageCount++;
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, cardPdfHeight);
          } else {
            // Long card: slice vertically across pages
            const maxSliceCanvasHeight = Math.floor((contentHeight * canvas.width) / contentWidth);
            let currentY = 0;

            while (currentY < canvas.height) {
              const sliceHeight = Math.min(maxSliceCanvasHeight, canvas.height - currentY);
              const sliceCanvas = document.createElement('canvas');
              sliceCanvas.width = canvas.width;
              sliceCanvas.height = sliceHeight;
              const sliceCtx = sliceCanvas.getContext('2d');

              sliceCtx.fillStyle = '#ffffff';
              sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
              sliceCtx.drawImage(
                canvas,
                0, currentY, canvas.width, sliceHeight,
                0, 0, canvas.width, sliceHeight
              );

              const slicePdfHeight = (sliceHeight * contentWidth) / canvas.width;
              if (pageCount > 0) {
                pdf.addPage();
              }
              pageCount++;

              const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
              pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, slicePdfHeight);

              currentY += sliceHeight;
            }
          }
        }

        btn.innerHTML = `
          <svg class="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity: 0.25;"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" style="opacity: 0.75;"></path>
          </svg>
          <span>Saving PDF...</span>
        `;

        const rawTitle = <?= json_encode($report_title) ?>;
        const cleanName = (rawTitle || 'Individual_Feedback_Reports').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
        pdf.save(`${cleanName}.pdf`);

      } catch (err) {
        console.error('Error generating PDF:', err);
        alert('An error occurred while generating the PDF. Please try using the "Print All Reports" option and select "Save as PDF".');
      } finally {
        document.body.classList.remove('pdf-exporting');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  </script>
</body>
</html>
