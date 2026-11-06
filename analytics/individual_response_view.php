<?php
// analytics/individual_response_view.php
require_once '../configuration/config.php';
require_once '../includes/auth.php';
requireAdmin();

$response_id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($response_id === 0) {
    die("Invalid Response ID");
}

// Fetch Response
$response_data = null;
try {
    $stmt = $pdo->prepare("SELECT form_id, respondent_id, response, submitted_at FROM responses WHERE id = :id");
    $stmt->execute(['id' => $response_id]);
    $response_data = $stmt->fetch();
} catch (PDOException $e) {
    die("Error fetching response.");
}

if (!$response_data) {
    die("Response not found.");
}

$form_id = $response_data['form_id'];
$answers = json_decode($response_data['response'], true);
if (!is_array($answers)) $answers = [];

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
    $q_stmt = $pdo->prepare("SELECT id, question, type FROM questions WHERE form_id = :form_id ORDER BY step_no ASC, question_order ASC");
    $q_stmt->execute(['form_id' => $form_id]);
    $all_questions = $q_stmt->fetchAll();
} catch (PDOException $e) {
    die("Error fetching questions");
}

// Year Extraction Logic
$year = date('Y', strtotime($response_data['submitted_at']));
// We will try to extract Academic Year from the answers if there's a question called "Academic Year"
foreach ($all_questions as $q) {
    if (stripos($q['question'], 'Academic Year') !== false && isset($answers[$q['question']])) {
        $year = $answers[$q['question']];
        break;
    }
}

$report_title = $form_title . ' Report for ' . $year;
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
    }
    .chart-data-table td {
      padding: 12px 16px !important;
      border: 1px solid #d1d5db !important;
      vertical-align: top !important;
      white-space: normal !important;
    }
    
    .chart-data-table tr:nth-child(even) td {
      background-color: #f8fafc !important; /* Alternating gray row */
    }
    .chart-data-table tr:nth-child(odd) td {
      background-color: #ffffff !important;
    }

    .q-col {
      width: 60%;
      font-weight: 500;
      color: var(--text-main);
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
      color: var(--text-main);
    }
    
    /* Remove inner border around colon for cleaner look */
    .chart-data-table td.q-col { border-right: none !important; }
    .chart-data-table td.a-col { border-left: none !important; }

    /* Print-specific adjustments */
    @media print {
      body { background: #fff !important; }
      .site-header, .site-footer, .print-btn-container, .title-card { display: none !important; }
      .card { border: none !important; box-shadow: none !important; padding: 0 !important; }
      .chart-data-table td { color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .chart-data-table tr:nth-child(even) td { background-color: #f1f5f9 !important; }
      @page { margin: 1cm; size: portrait; }
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
          <p style="color: var(--text-secondary); margin: 0; font-size: 15px;">Individual Student/Stakeholder Feedback Report.</p>
          <div class="print-btn-container" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <button type="button" class="btn-download" id="downloadPdfBtn" onclick="downloadReportPdf()">
              <svg id="downloadPdfIcon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              <span id="downloadPdfText">Download PDF</span>
            </button>
            <button type="button" class="btn-primary" style="display: flex; align-items: center; gap: 8px;" onclick="window.print()">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              <span>Print Report</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Table Card -->
      <div class="card report-card" id="individual-report-card">
        <!-- Report Specific Header with Logos -->
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
          <table class="chart-data-table" style="width: 100%;">
            <tbody>
              
              <!-- Meta Data rows -->
              <!-- Removed Respondent ID and Submitted At as per request -->

              <!-- Dynamic Questions from Response -->
              <?php foreach ($answers as $q_text => $ans): 
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

    </div>
  </main>

  <?php include '../includes/footer.php'; ?>

  <script>
    async function downloadReportPdf() {
      const btn = document.getElementById('downloadPdfBtn');
      const card = document.getElementById('individual-report-card');

      if (!card) {
        alert('Report card not found.');
        return;
      }

      if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        alert('PDF generation libraries could not be loaded. Please ensure jspdf and html2canvas are available.');
        return;
      }

      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      document.body.classList.add('pdf-exporting');

      try {
        btn.innerHTML = `
          <svg class="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity: 0.25;"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" style="opacity: 0.75;"></path>
          </svg>
          <span>Generating PDF...</span>
        `;

        const images = Array.from(card.querySelectorAll('img'));
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

        const canvas = await html2canvas(card, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const cardPdfHeight = (canvas.height * contentWidth) / canvas.width;

        if (cardPdfHeight <= contentHeight) {
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, cardPdfHeight);
        } else {
          const maxSliceCanvasHeight = Math.floor((contentHeight * canvas.width) / contentWidth);
          let currentY = 0;
          let pageCount = 0;

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

        const rawTitle = <?= json_encode($report_title) ?>;
        const cleanName = (rawTitle || 'Individual_Feedback_Report').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
        pdf.save(`${cleanName}.pdf`);

      } catch (err) {
        console.error('Error generating PDF:', err);
        alert('An error occurred while generating the PDF. Please try using "Print Report" and select "Save as PDF".');
      } finally {
        document.body.classList.remove('pdf-exporting');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  </script>
</body>
</html>
