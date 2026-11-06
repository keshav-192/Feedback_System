<?php
require_once '../configuration/config.php';
require_once '../trace_log.php';

// Load options.json
$fatal_error_title = '';
$fatal_error_message = '';
$options_json_path = '../options.json';

if (!file_exists($options_json_path)) {
    writeLog("Error: options.json not found.");
    $fatal_error_title = "Configuration Missing";
    $fatal_error_message = "The system configuration file is missing. Please contact the administrator.";
    $options_data = [];
} else {
    $options_json = file_get_contents($options_json_path);
    $options_data = json_decode($options_json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        writeLog("Error: Failed to parse options.json.");
        $fatal_error_title = "Configuration Error";
        $fatal_error_message = "The system configuration file is corrupted. Please contact the administrator.";
        $options_data = [];
    }
}

// Index options by group_name
$option_groups = [];
foreach ($options_data as $group) {
    if (isset($group['group_name'])) {
        $option_groups[$group['group_name']] = isset($group['options']) ? $group['options'] : [];
    }
}

/**
 * Calculates a Red-to-Green gradient color palette for rating / linear scale options.
 * Worst (lowest weight)  => Crimson Red (#dc2626)
 * Intermediate           => Orange (#ea580c), Amber (#d97706), Lime (#65a30d)
 * Best (highest weight)  => Emerald Green (#16a34a)
 */
function getScaleColorMap($options) {
    if (empty($options)) return [];
    
    $weights = [];
    $hasWeights = true;
    foreach ($options as $opt) {
        if (isset($opt['weight']) && is_numeric($opt['weight'])) {
            $weights[] = floatval($opt['weight']);
        } else {
            $hasWeights = false;
            break;
        }
    }
    
    $total = count($options);
    $stops = [
        ['t' => 0.00, 'rgb' => [220, 38, 38]],   // #dc2626 Red
        ['t' => 0.25, 'rgb' => [234, 88, 12]],   // #ea580c Orange
        ['t' => 0.50, 'rgb' => [217, 119, 6]],   // #d97706 Amber
        ['t' => 0.75, 'rgb' => [101, 163, 13]],  // #65a30d Lime Green
        ['t' => 1.00, 'rgb' => [22, 163, 74]]    // #16a34a Emerald Green
    ];

    $calcColor = function($t) use ($stops) {
        $t = max(0.0, min(1.0, floatval($t)));
        $c1 = $stops[0]['rgb'];
        $c2 = $stops[count($stops) - 1]['rgb'];
        $t1 = 0.0;
        $t2 = 1.0;
        for ($i = 0; $i < count($stops) - 1; $i++) {
            if ($t >= $stops[$i]['t'] && $t <= $stops[$i + 1]['t']) {
                $t1 = $stops[$i]['t'];
                $t2 = $stops[$i + 1]['t'];
                $c1 = $stops[$i]['rgb'];
                $c2 = $stops[$i + 1]['rgb'];
                break;
            }
        }
        $factor = ($t2 > $t1) ? ($t - $t1) / ($t2 - $t1) : 0;
        $r = round($c1[0] + ($c2[0] - $c1[0]) * $factor);
        $g = round($c1[1] + ($c2[1] - $c1[1]) * $factor);
        $b = round($c1[2] + ($c2[2] - $c1[2]) * $factor);
        return [          
            'hex' => sprintf('#%02x%02x%02x', $r, $g, $b),
            'bg' => "rgba($r, $g, $b, 0.12)",
            'border' => "rgba($r, $g, $b, 0.35)",
            'glow' => "rgba($r, $g, $b, 0.22)"
        ];
    };

    $colorMap = [];
    if ($hasWeights && count($weights) === $total && max($weights) > min($weights)) {
        $minW = min($weights);
        $maxW = max($weights);
        foreach ($options as $opt) {
            $t = (floatval($opt['weight']) - $minW) / ($maxW - $minW);
            $colorMap[] = $calcColor($t);
        }
    } else {
        $firstLabel = strtolower(trim($options[0]['label'] ?? ''));
        $firstIsHigh = (
            strpos($firstLabel, 'excellent') !== false ||
            strpos($firstLabel, 'strongly agree') !== false ||
            strpos($firstLabel, 'very satisfied') !== false ||
            preg_match('/^5/', $firstLabel)
        );
        for ($i = 0; $i < $total; $i++) {
            $t = ($total > 1) ? ($i / ($total - 1)) : 0.5;
            if ($firstIsHigh) $t = 1.0 - $t;
            $colorMap[] = $calcColor($t);
        }
    }
    return $colorMap;
}



$form_id = isset($_GET['id']) ? intval($_GET['id']) : 1;

$form_found = true;
try {
    if ($fatal_error_title !== '') {
        // Skip DB fetch if there's already a fatal error
        $form_found = false;
        $form = [
            'id' => $form_id,
            'title' => 'System Error',
            'description' => ''
        ];
    } else {
        $form_stmt = $pdo->prepare("SELECT * FROM forms WHERE id = :id LIMIT 1");
        $form_stmt->execute(['id' => $form_id]);
        $form = $form_stmt->fetch();
        if (!$form) {
            writeLog("Warning: Form ID $form_id not found.");
            $form_found = false;
            $fatal_error_title = "Form Not Found";
            $fatal_error_message = "The form you are looking for does not exist, has been removed, or the link is invalid.";
            // Dummy form array to prevent PHP warnings when accessing $form['id'] and $form['title'] below
            $form = [
                'id' => $form_id,
                'title' => 'Form Not Found',
                'description' => ''
            ];
        }
    }
} catch (PDOException $e) {
    writeLog("Database Error (Fetching Form $form_id): " . $e->getMessage());
    $fatal_error_title = "Database Error";
    $fatal_error_message = "An error occurred while fetching the form data. Please try again later.";
}

// Fetch questions for form ID 1
$questions = [];
try {
    $q_stmt = $pdo->prepare("SELECT * FROM questions WHERE form_id = :form_id AND active = 1 ORDER BY step_no ASC, question_order ASC");
    $q_stmt->execute(['form_id' => $form['id']]);
    $questions = $q_stmt->fetchAll();
} catch (PDOException $e) {
    writeLog("Database Error (Fetching Questions for Form $form_id): " . $e->getMessage());
    die("Database query error: " . $e->getMessage());
}

// Group questions by step_no
$steps = [];
foreach ($questions as $q) {
    $step_no = intval($q['step_no']);
    $steps[$step_no][] = $q;
}
ksort($steps);

$total_steps = count($steps);
if ($total_steps === 0) {
    $total_steps = 1; // absolute fallback
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($form['title']) ?></title>
  <link rel="stylesheet" href="user.css?v=<?= filemtime(__DIR__ . '/user.css') ?>">
</head>
<body>

  <?php 
    $base_url = '../';
    include '../includes/header.php'; 
  ?>

  <!-- Main Content Body -->
  <main class="site-main<?= (!$form_found || $fatal_error_title !== '') ? ' fatal-error-site-main' : '' ?>">
    <?php if (!$form_found || $fatal_error_title !== ''): ?>
      <div class="form-container fatal-error-container">
        <div class="card fatal-error-card">
          <div class="fatal-error-badge-outer">
            <div class="fatal-error-badge-inner">
              <svg class="fatal-error-svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
          </div>

          <div class="fatal-error-chip">
            <span class="fatal-error-chip-dot"></span>
            System Notice
          </div>

          <h2 class="fatal-error-title"><?= htmlspecialchars($fatal_error_title) ?></h2>
          <p class="fatal-error-desc"><?= htmlspecialchars($fatal_error_message) ?></p>

          <div class="fatal-error-actions">
            <a href="<?= $base_url ?>index.php" class="fatal-error-btn-primary">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              <span>Return to Dashboard</span>
            </a>
            <button type="button" class="fatal-error-btn-secondary" onclick="window.location.reload()">
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              <span>Try Again</span>
            </button>
          </div>
        </div>
      </div>
    <?php else: ?>
      <div class="form-container" id="form-container">
        <!-- Progress Bar Indicator Card -->
        <div class="card progress-card" id="progress-card" data-total-steps="<?= $total_steps ?>">
          <div class="progress-text" id="progress-text">Page 1 of <?= $total_steps ?></div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="progress-bar-fill" style="width: <?= (1 / $total_steps) * 100 ?>%;"></div>
          </div>
        </div>

        <!-- Feedback Form -->
        <form id="feedback-form" novalidate data-form-id="<?= htmlspecialchars($form['id']) ?>">

        <?php foreach ($steps as $step_no => $step_questions): 
            $sec_name = '';
            if (isset($step_questions[0]['section_name']) && trim($step_questions[0]['section_name']) !== '') {
                $sec_name = trim($step_questions[0]['section_name']);
            }
        ?>
          <div class="form-step <?= $step_no === 1 ? 'active' : '' ?>" id="step-<?= $step_no ?>" <?= $sec_name ? 'data-section-name="'.htmlspecialchars($sec_name).'"' : '' ?>>
            
            <?php if ($step_no === 1): ?>
              <div class="card title-card">
                <h2 class="form-title"><?= htmlspecialchars($form['title']) ?></h2>
                <?php if (!empty($form['description'])): ?>
                  <p class="section-header-description" style="margin-top: 8px; color: var(--text-secondary);"><?= htmlspecialchars($form['description']) ?></p>
                <?php endif; ?>
                <div class="required-notice" style="margin-top: 16px;">* Indicates required question</div>
              </div>
            <?php endif; ?>

            <?php 
              // Group step questions into blocks (handling consecutive matrix questions)
              $blocks = [];
              $current_matrix = null;
              foreach ($step_questions as $sq) {
                  $is_mat = in_array($sq['type'], ['linear_scale', 'radio_grid', 'checkbox_grid', 'slider_grid']);
                  if ($is_mat) {
                      $gid = !empty($sq['option_group_id']) ? $sq['option_group_id'] : '';
                      $m_subtype = ($sq['type'] === 'checkbox_grid') ? 'checkbox_grid' : (($sq['type'] === 'slider_grid') ? 'slider_grid' : 'radio_grid');
                      if ($current_matrix !== null && $current_matrix['option_group_id'] === $gid && $current_matrix['subtype'] === $m_subtype) {
                          $current_matrix['questions'][] = $sq;
                      } else {
                          if ($current_matrix !== null) {
                              $blocks[] = $current_matrix;
                          }
                          $current_matrix = [
                              'type' => 'matrix',
                              'subtype' => $m_subtype,
                              'option_group_id' => $gid,
                              'questions' => [$sq]
                          ];
                      }
                  } else {
                      if ($current_matrix !== null) {
                          $blocks[] = $current_matrix;
                          $current_matrix = null;
                      }
                      $blocks[] = [
                          'type' => 'single',
                          'question' => $sq
                      ];
                  }
              }
              if ($current_matrix !== null) {
                  $blocks[] = $current_matrix;
              }

              foreach ($blocks as $block):
                if ($block['type'] === 'matrix'):
                  $subtype = $block['subtype'] ?? 'radio_grid';
                  $group_id = $block['option_group_id'];
                  $options = ($group_id && isset($option_groups[$group_id])) ? $option_groups[$group_id] : [];
                  if (empty($options)) {
                      $options = [
                          ['label' => '1 (Poor)', 'weight' => 1],
                          ['label' => '2', 'weight' => 2],
                          ['label' => '3', 'weight' => 3],
                          ['label' => '4', 'weight' => 4],
                          ['label' => '5 (Excellent)', 'weight' => 5]
                      ];
                  }
                  $matrixColorMap = getScaleColorMap($options);
                  $first_q_id = $block['questions'][0]['id'];
            ?>
                <?php if ($subtype === 'slider_grid'): 
                    // Sliders must ALWAYS strictly progress from lowest rating (1 / worst) to highest rating (N / best)
                    $sliderOptions = $options;
                    usort($sliderOptions, function($a, $b) {
                        $wA = isset($a['weight']) && is_numeric($a['weight']) ? floatval($a['weight']) : null;
                        $wB = isset($b['weight']) && is_numeric($b['weight']) ? floatval($b['weight']) : null;
                        if ($wA !== null && $wB !== null) {
                            return $wA <=> $wB; // Ascending order
                        }
                        preg_match('/^(\d+)/', trim($a['label'] ?? ''), $mA);
                        preg_match('/^(\d+)/', trim($b['label'] ?? ''), $mB);
                        if (!empty($mA) && !empty($mB)) {
                            return intval($mA[1]) <=> intval($mB[1]);
                        }
                        return 0;
                    });
                    $optCount = count($sliderOptions);
                    $sliderColorMap = getScaleColorMap($sliderOptions);

                    $sliderOptMeta = [];
                    foreach ($sliderOptions as $optIdx => $opt) {
                        $colData = $sliderColorMap[$optIdx] ?? ['hex' => '#1a73e8', 'bg' => 'rgba(26, 115, 232, 0.12)', 'glow' => 'rgba(26, 115, 232, 0.22)'];
                        $sliderOptMeta[] = [
                            'index' => $optIdx + 1,
                            'label' => $opt['label'],
                            'color' => $colData['hex'],
                            'glow' => $colData['glow']
                        ];
                    }
                    $optMetaJson = htmlspecialchars(json_encode($sliderOptMeta), ENT_QUOTES, 'UTF-8');
                ?>
                  <div class="card matrix-card grid-full-width matrix-slider-grid" id="matrix-card-<?= $first_q_id ?>">
                    <div class="matrix-table-container">
                      <table class="matrix-table matrix-slider-table" style="--slider-opt-count: <?= $optCount ?>;">
                        <thead>
                          <tr>
                            <th class="matrix-th-statement">Questions</th>
                            <?php foreach ($sliderOptions as $optIdx => $opt): 
                                $colData = $sliderColorMap[$optIdx] ?? ['hex' => '#1a73e8', 'bg' => 'rgba(26, 115, 232, 0.12)', 'border' => 'rgba(26, 115, 232, 0.35)', 'glow' => 'rgba(26, 115, 232, 0.22)'];
                            ?>
                              <th class="matrix-th-option" style="--scale-color: <?= $colData['hex'] ?>; --scale-bg: <?= $colData['bg'] ?>; --scale-border: <?= $colData['border'] ?>;">
                                <span class="matrix-header-pill">
                                  <?= htmlspecialchars($opt['label']) ?>
                                </span>
                              </th>
                            <?php endforeach; ?>
                          </tr>
                        </thead>
                        <tbody>
                          <?php foreach ($block['questions'] as $q): 
                              $is_req = intval($q['is_required']) === 1;
                              $q_name = "question_" . $q['id'];
                          ?>
                            <tr class="matrix-row matrix-row-slider" id="q-<?= $q['id'] ?>" data-question-id="<?= $q['id'] ?>" <?= $is_req ? 'data-required-matrix-slider="1"' : '' ?>>
                              <td class="matrix-cell-statement">
                                <div class="question-title">
                                  <?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?>
                                </div>
                                <div class="matrix-row-error-text">Please provide a rating for this question</div>
                              </td>
                              <td class="matrix-cell-slider" colspan="<?= $optCount ?>">
                                <div class="matrix-slider-wrapper">
                                  <input type="hidden" name="<?= $q_name ?>" class="slider-actual-input" value="">
                                  <div class="slider-track-container">
                                    <span class="slider-bound-label slider-bound-min"><?= htmlspecialchars($sliderOptions[0]['label']) ?></span>
                                    <div class="slider-input-box">
                                      <input type="range" class="matrix-slider-control" min="0" max="100" step="1" value="0" data-touched="0" data-q-id="<?= $q['id'] ?>" data-opt-count="<?= $optCount ?>" data-options="<?= $optMetaJson ?>">
                                    </div>
                                    <span class="slider-bound-label slider-bound-max"><?= htmlspecialchars($sliderOptions[$optCount - 1]['label']) ?></span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          <?php endforeach; ?>
                        </tbody>
                      </table>
                    </div>
                  </div>

                <?php elseif ($subtype === 'checkbox_grid'): ?>
                  <div class="card matrix-card grid-full-width matrix-checkbox-grid" id="matrix-card-<?= $first_q_id ?>">
                    <div class="matrix-table-container">
                      <table class="matrix-table">
                        <thead>
                          <tr>
                            <th class="matrix-th-statement">Questions</th>
                            <?php foreach ($options as $optIdx => $opt): ?>
                              <th class="matrix-th-option">
                                <span class="matrix-header-pill">
                                  <?= htmlspecialchars($opt['label']) ?>
                                </span>
                              </th>
                            <?php endforeach; ?>
                          </tr>
                        </thead>
                        <tbody>
                          <?php foreach ($block['questions'] as $q): 
                              $is_req = intval($q['is_required']) === 1;
                              $q_name = "question_" . $q['id'];
                          ?>
                            <tr class="matrix-row matrix-row-checkbox" id="q-<?= $q['id'] ?>" data-question-id="<?= $q['id'] ?>" <?= $is_req ? 'data-required-matrix-checkbox="1"' : '' ?>>
                              <td class="matrix-cell-statement">
                                <div class="question-title">
                                  <?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?>
                                </div>
                                <div class="matrix-row-error-text">Please select at least one option</div>
                              </td>
                              <?php foreach ($options as $optIdx => $opt): ?>
                                <td class="matrix-cell-checkbox" data-option-label="<?= htmlspecialchars($opt['label']) ?>">
                                  <label class="matrix-checkbox-label">
                                    <input type="checkbox" name="<?= $q_name ?>[]" value="<?= htmlspecialchars($opt['label']) ?>">
                                    <span class="matrix-checkbox-custom"></span>
                                    <span class="matrix-mobile-label"><?= htmlspecialchars($opt['label']) ?></span>
                                  </label>
                                </td>
                              <?php endforeach; ?>
                            </tr>
                          <?php endforeach; ?>
                        </tbody>
                      </table>
                    </div>
                  </div>

                <?php else: // Default radio_grid ?>
                  <div class="card matrix-card grid-full-width matrix-radio-grid" id="matrix-card-<?= $first_q_id ?>">
                    <div class="matrix-table-container">
                      <table class="matrix-table">
                        <thead>
                          <tr>
                            <th class="matrix-th-statement">Questions</th>
                            <?php foreach ($options as $optIdx => $opt): 
                                $colData = $matrixColorMap[$optIdx] ?? ['hex' => '#1a73e8', 'bg' => 'rgba(26, 115, 232, 0.12)', 'border' => 'rgba(26, 115, 232, 0.35)', 'glow' => 'rgba(26, 115, 232, 0.22)'];
                            ?>
                              <th class="matrix-th-option" style="--scale-color: <?= $colData['hex'] ?>; --scale-bg: <?= $colData['bg'] ?>; --scale-border: <?= $colData['border'] ?>;">
                                <span class="matrix-header-pill">
                                  <?= htmlspecialchars($opt['label']) ?>
                                </span>
                              </th>
                            <?php endforeach; ?>
                          </tr>
                        </thead>
                        <tbody>
                          <?php foreach ($block['questions'] as $q): 
                              $is_req = intval($q['is_required']) === 1;
                              $q_name = "question_" . $q['id'];
                          ?>
                            <tr class="matrix-row matrix-row-radio" id="q-<?= $q['id'] ?>" data-question-id="<?= $q['id'] ?>" <?= $is_req ? 'data-required-matrix-row="1"' : '' ?>>
                              <td class="matrix-cell-statement">
                                <div class="question-title">
                                  <?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?>
                                </div>
                                <div class="matrix-row-error-text">This question requires an answer</div>
                              </td>
                              <?php foreach ($options as $optIdx => $opt): 
                                  $colData = $matrixColorMap[$optIdx] ?? ['hex' => '#1a73e8', 'bg' => 'rgba(26, 115, 232, 0.12)', 'border' => 'rgba(26, 115, 232, 0.35)', 'glow' => 'rgba(26, 115, 232, 0.22)'];
                              ?>
                                <td class="matrix-cell-radio" data-option-label="<?= htmlspecialchars($opt['label']) ?>" style="--scale-color: <?= $colData['hex'] ?>; --scale-bg: <?= $colData['bg'] ?>; --scale-border: <?= $colData['border'] ?>; --scale-glow: <?= $colData['glow'] ?>;">
                                  <label class="matrix-radio-label">
                                    <input type="radio" name="<?= $q_name ?>" value="<?= htmlspecialchars($opt['label']) ?>">
                                    <span class="matrix-radio-custom"></span>
                                    <span class="matrix-mobile-label"><?= htmlspecialchars($opt['label']) ?></span>
                                  </label>
                                </td>
                              <?php endforeach; ?>
                            </tr>
                          <?php endforeach; ?>
                        </tbody>
                      </table>
                    </div>
                  </div>
                <?php endif; ?>

            <?php 
                else: 
                  $q = $block['question'];
                  $is_req = intval($q['is_required']) === 1;
                  $q_name = "question_" . $q['id'];
                  $type = $q['type'];
                  $group_id = $q['option_group_id'];
                  
                  // Determine card layout classes
                  $card_class = 'card';
                  if ($type === 'textarea') {
                      $card_class .= ' grid-full-width';
                  } elseif ($type === 'checkbox' || $type === 'radio') {
                      $card_class .= ' card-checkbox';
                  }
            ?>
              <?php if ($type === 'text'): ?>
                <div class="<?= $card_class ?>" id="q-<?= $q['id'] ?>">
                  <div class="question-title"><?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?></div>
                  <div class="input-wrapper">
                    <?php 
                      $inputType = (stripos($q['question'], 'email') !== false) ? 'email' : 'text'; 
                      $extra_attrs = '';
                      $extra_class = '';
                      $q_lower = strtolower(trim($q['question']));
                      
                      $validation_type = isset($q['validation_type']) ? $q['validation_type'] : 'alphanumeric';
                      $max_length = isset($q['max_length']) && $q['max_length'] ? (int)$q['max_length'] : 250;
                      
                      $is_reg = (strpos($q_lower, 'register no') !== false || strpos($q_lower, 'reg no') !== false || strpos($q_lower, 'reg. no') !== false || strpos($q_lower, 'reg.no') !== false);
                      $is_emp = (strpos($q_lower, 'emp id') !== false || strpos($q_lower, 'empid') !== false || strpos($q_lower, 'emp. id') !== false || strpos($q_lower, 'employee id') !== false);

                      if ($is_reg && $is_emp) {
                          $extra_class = 'reg-emp-input';
                          $extra_attrs = 'maxlength="10"';
                      } elseif ($is_reg) {
                          $extra_class = 'register-no-input';
                          $extra_attrs = 'maxlength="10" minlength="10"';
                      } elseif ($is_emp) {
                          $extra_class = 'emp-id-input';
                          $extra_attrs = 'maxlength="5" minlength="5"';
                      } elseif (strpos($q_lower, 'email') !== false) {
                          $extra_class = 'email-id-input';
                          $extra_attrs = 'maxlength="50"';
                      } else {
                          $extra_attrs = 'maxlength="' . $max_length . '" data-validation-type="' . htmlspecialchars($validation_type) . '"';
                      }
                    ?>
                    <input type="<?= $inputType ?>" class="text-input <?= $extra_class ?>" name="<?= $q_name ?>" <?= $is_req ? 'required' : '' ?> placeholder="Your answer" <?= $extra_attrs ?>>
                  </div>
                  <div class="error-message">This is a required question</div>
                </div>

              <?php elseif ($type === 'textarea'): 
                    $max_length = isset($q['max_length']) && $q['max_length'] ? (int)$q['max_length'] : 2000;
              ?>
                <div class="<?= $card_class ?>" id="q-<?= $q['id'] ?>">
                  <div class="question-title"><?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?></div>
                  <div class="input-wrapper">
                    <textarea class="textarea-input" name="<?= $q_name ?>" maxlength="<?= $max_length ?>" <?= $is_req ? 'required' : '' ?> placeholder="Your answer"></textarea>
                  </div>
                  <div class="error-message">This is a required question</div>
                </div>

              <?php elseif ($type === 'select'): 
                $options = ($group_id && isset($option_groups[$group_id])) ? $option_groups[$group_id] : [];
                $hasOther = false;
                foreach ($options as $opt) {
                    if (strcasecmp(trim($opt['label']), 'Other') === 0 || strcasecmp(trim($opt['label']), 'Other:') === 0) {
                        $hasOther = true;
                        break;
                    }
                }
                $selectClass = $hasOther ? 'select-input select-with-other' : 'select-input';
                $otherTarget = $hasOther ? "{$q_name}_other_container" : '';
              ?>
                <div class="<?= $card_class ?>" id="q-<?= $q['id'] ?>">
                  <div class="question-title"><?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?></div>
                  <div class="select-wrapper">
                    <select class="<?= $selectClass ?>" name="<?= $q_name ?>" <?= $is_req ? 'required' : '' ?> <?= $hasOther ? "data-other-target=\"{$otherTarget}\"" : '' ?>>
                      <option value="" disabled selected hidden>Choose option</option>
                      <?php foreach ($options as $opt): ?>
                        <option value="<?= htmlspecialchars($opt['label']) ?>"><?= htmlspecialchars($opt['label']) ?></option>
                      <?php endforeach; ?>
                    </select>
                    <span class="select-arrow"></span>
                  </div>
                  <?php if ($hasOther): ?>
                    <div class="other-input-wrapper" id="<?= $otherTarget ?>" style="display: none;">
                      <input type="text" class="text-input other-text-input" name="<?= $q_name ?>_other" placeholder="Write your answer">
                    </div>
                  <?php endif; ?>
                  <div class="error-message">This is a required question</div>
                </div>

              <?php elseif ($type === 'checkbox'): 
                $options = ($group_id && isset($option_groups[$group_id])) ? $option_groups[$group_id] : [];
              ?>
                <div class="<?= $card_class ?>" id="q-<?= $q['id'] ?>" <?= $is_req ? 'data-required-checkbox' : '' ?>>
                  <div class="question-title"><?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?></div>
                  <div class="options-container">
                    <?php foreach ($options as $opt): 
                      $isOther = (strcasecmp(trim($opt['label']), 'Other') === 0 || strcasecmp(trim($opt['label']), 'Other:') === 0);
                    ?>
                      <?php if ($isOther): 
                        $otherCbTarget = "{$q_name}_other_cb_container";
                      ?>
                        <label class="checkbox-option other-input-container">
                          <input type="checkbox" name="<?= $q_name ?>[]" value="<?= htmlspecialchars($opt['label']) ?>" class="checkbox-other-trigger" data-other-target="<?= $otherCbTarget ?>">
                          <span class="checkbox-checkmark"></span>
                          <span><?= htmlspecialchars($opt['label']) ?><?= strpos($opt['label'], ':') === false ? ':' : '' ?></span>
                        </label>
                        <div class="other-checkbox-input-wrapper" id="<?= $otherCbTarget ?>" style="display: none;">
                          <input type="text" class="text-input other-text-input" name="<?= $q_name ?>_other" placeholder="Write other option">
                        </div>
                      <?php else: ?>
                        <label class="checkbox-option">
                          <input type="checkbox" name="<?= $q_name ?>[]" value="<?= htmlspecialchars($opt['label']) ?>">
                          <span class="checkbox-checkmark"></span>
                          <?= htmlspecialchars($opt['label']) ?>
                        </label>
                      <?php endif; ?>
                    <?php endforeach; ?>
                  </div>
                  <div class="error-message">This is a required question</div>
                </div>

              <?php elseif ($type === 'radio'): 
                $options = ($group_id && isset($option_groups[$group_id])) ? $option_groups[$group_id] : [];
              ?>
                <div class="<?= $card_class ?>" id="q-<?= $q['id'] ?>" <?= $is_req ? 'data-required-radio-option' : '' ?>>
                  <div class="question-title"><?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?></div>
                  <div class="options-container">
                    <?php foreach ($options as $opt): 
                      $isOther = (strcasecmp(trim($opt['label']), 'Other') === 0 || strcasecmp(trim($opt['label']), 'Other:') === 0);
                    ?>
                      <?php if ($isOther): 
                        $otherCbTarget = "{$q_name}_other_cb_container";
                      ?>
                        <label class="radio-option other-input-container">
                          <input type="radio" name="<?= $q_name ?>" value="<?= htmlspecialchars($opt['label']) ?>" class="radio-other-trigger" data-other-target="<?= $otherCbTarget ?>">
                          <span class="radio-checkmark"></span>
                          <span><?= htmlspecialchars($opt['label']) ?><?= strpos($opt['label'], ':') === false ? ':' : '' ?></span>
                        </label>
                        <div class="other-checkbox-input-wrapper" id="<?= $otherCbTarget ?>" style="display: none;">
                          <input type="text" class="text-input other-text-input" name="<?= $q_name ?>_other" placeholder="Write other option">
                        </div>
                      <?php else: ?>
                        <label class="radio-option">
                          <input type="radio" name="<?= $q_name ?>" value="<?= htmlspecialchars($opt['label']) ?>">
                          <span class="radio-checkmark"></span>
                          <?= htmlspecialchars($opt['label']) ?>
                        </label>
                      <?php endif; ?>
                    <?php endforeach; ?>
                  </div>
                  <div class="error-message">This is a required question</div>
                </div>

              <?php elseif ($type === 'rating'): 
                $options = ($group_id && isset($option_groups[$group_id])) ? $option_groups[$group_id] : [];
                $min_label = '';
                $max_label = '';
                
                if (empty($options)) {
                    $options = [
                        ['label' => '1', 'weight' => 1],
                        ['label' => '2', 'weight' => 2],
                        ['label' => '3', 'weight' => 3],
                        ['label' => '4', 'weight' => 4],
                        ['label' => '5', 'weight' => 5]
                    ];
                }
                $ratingColorMap = getScaleColorMap($options);

                // Detect if all options are numeric-prefixed (e.g. "1", "2 (Good)", "5 (Excellent)")
                // vs purely text-based (e.g. "Yes", "No", "Not Sure")
                $isNumericScale = true;
                foreach ($options as $opt) {
                    if (!preg_match('/^\d/', trim($opt['label']))) {
                        $isNumericScale = false;
                        break;
                    }
                }
                
                if ($isNumericScale && count($options) > 0) {
                    $first_opt = $options[0]['label'];
                    $last_opt = $options[count($options) - 1]['label'];
                    
                    // Extract descriptive text from parentheses: "1 (Poor)" => "Poor"
                    if (preg_match('/^\d+\s*\((.*?)\)$/', trim($first_opt), $m)) {
                        $min_label = $m[1];
                    } else {
                        $min_label = preg_replace('/^\d+\s*[-–]?\s*/', '', trim($first_opt));
                        if (is_numeric($min_label)) $min_label = '';
                    }
                    
                    if (preg_match('/^\d+\s*\((.*?)\)$/', trim($last_opt), $m)) {
                        $max_label = $m[1];
                    } else {
                        $max_label = preg_replace('/^\d+\s*[-–]?\s*/', '', trim($last_opt));
                        if (is_numeric($max_label)) $max_label = '';
                    }
                }
              ?>
                <div class="<?= $card_class ?>" id="q-<?= $q['id'] ?>" <?= $is_req ? 'data-required-radio' : '' ?>>
                  <div class="question-title"><?= htmlspecialchars($q['question']) ?> <?= $is_req ? '<span class="required-asterisk">*</span>' : '' ?></div>
                  
                  <div class="rating-scale-container<?= !$isNumericScale ? ' rating-text-scale' : '' ?>">
                    <?php if ($min_label): ?>
                        <div class="rating-label rating-label-min"><?= htmlspecialchars($min_label) ?></div>
                    <?php endif; ?>
                    
                    <div class="rating-options">
                        <?php foreach ($options as $optIdx => $opt): 
                            $colData = $ratingColorMap[$optIdx] ?? ['hex' => '#1a73e8', 'bg' => 'rgba(26, 115, 232, 0.12)', 'border' => 'rgba(26, 115, 232, 0.35)', 'glow' => 'rgba(26, 115, 232, 0.22)'];
                            if ($isNumericScale) {
                                // Extract just the leading number for badge display
                                $num_text = trim($opt['label']);
                                if (preg_match('/^(\d+)/', $num_text, $m)) {
                                    $num_text = $m[1];
                                }
                            }
                        ?>
                            <label class="rating-option<?= !$isNumericScale ? ' rating-option-text' : '' ?>" style="--scale-color: <?= $colData['hex'] ?>; --scale-bg: <?= $colData['bg'] ?>; --scale-border: <?= $colData['border'] ?>; --scale-glow: <?= $colData['glow'] ?>;">
                                <?php if ($isNumericScale): ?>
                                    <span class="rating-num"><?= htmlspecialchars($num_text) ?></span>
                                    <div class="rating-radio-wrapper">
                                        <input type="radio" name="<?= $q_name ?>" value="<?= htmlspecialchars($opt['label']) ?>">
                                        <span class="rating-radio-custom"></span>
                                    </div>
                                <?php else: ?>
                                    <input type="radio" name="<?= $q_name ?>" value="<?= htmlspecialchars($opt['label']) ?>">
                                    <span class="rating-text-pill"><?= htmlspecialchars($opt['label']) ?></span>
                                <?php endif; ?>
                            </label>
                        <?php endforeach; ?>
                    </div>
                    
                    <?php if ($max_label): ?>
                        <div class="rating-label rating-label-max"><?= htmlspecialchars($max_label) ?></div>
                    <?php endif; ?>
                  </div>
                  <div class="error-message">This is a required question</div>
                </div>

              <?php endif; ?>
            <?php endif; // End block check ?>
          <?php endforeach; // End blocks loop ?>

            <!-- Navigation Buttons -->
            <div class="nav-buttons-container">
              <?php if ($step_no > 1): ?>
                <button type="button" class="back-btn prev-step-btn">Back</button>
              <?php else: ?>
                <div></div>
              <?php endif; ?>
              
              <?php if ($step_no < $total_steps): ?>
                <button type="button" class="submit-btn next-step-btn">Next</button>
              <?php else: ?>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <button type="button" class="clear-btn" id="clear-form-btn">Clear form</button>
                  <button type="submit" class="submit-btn">Submit</button>
                </div>
              <?php endif; ?>
            </div>

          </div>
        <?php endforeach; ?>

      </form>
    </div>

    <!-- Response Summary Section -->
    <!-- JS fills #summary-body with Q&A pairs grouped by step -->
    <div class="summary-section" id="summary-section">
      <div class="form-container">

        <div class="summary-header">
          <h2 class="summary-title">Response Summary</h2>
          <p class="summary-subtitle">Please review your answers carefully before final submission.</p>
        </div>

        <!-- JS populates this with question+answer cards -->
        <div class="summary-body" id="summary-body"></div>

        <!-- Inline Page Navigator -->
        <div class="page-navigator" id="page-navigator" data-total-steps="<?= $total_steps ?>">
          <div class="page-navigator-label">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px"><path d="M9 18l6-6-6-6"/></svg>
            Go to Page
          </div>
          <div class="page-navigator-row">
            <input
              type="number"
              id="page-jump-input"
              class="page-jump-input"
              min="1"
              max="<?= $total_steps ?>"
              placeholder="1–<?= $total_steps ?>"
            >
            <button type="button" id="page-jump-btn" class="page-jump-btn">Go</button>
          </div>
          <div class="page-navigator-hint" id="page-navigator-hint"></div>
        </div>

        <div class="summary-footer">
          <button type="button" class="summary-edit-btn" id="summary-edit-btn">&#8592; Edit</button>
          <button type="button" class="summary-submit-btn" id="summary-submit-btn">Final Submit &#8594;</button>
        </div>

      </div>
    </div>
    <?php endif; ?>
  </main>

  <!-- Global Footer -->
  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 VFSTR. All rights reserved.</p>
      <p class="footer-sub">Designed & maintained by Technology Development(TD).</p>
    </div>
  </footer>

  <!-- Success Modal Dialog -->
  <div class="modal-overlay" id="success-modal">
    <div class="modal-content">
      <h3 class="modal-title">Thank you!</h3>
      <p class="modal-text">Your feedback on "<?= htmlspecialchars($form['title']) ?>" has been successfully recorded.</p>
      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px; flex-wrap: wrap;">
        <button type="button" class="modal-close-btn" id="modal-ok-btn">Submit another response</button>
      </div>
    </div>
  </div>

  <!-- Confirm Modal Dialog -->
  <div class="modal-overlay" id="confirm-modal">
    <div class="modal-content">
      <h3 class="modal-title" style="color: var(--error-color);">Clear Form?</h3>
      <p class="modal-text">Are you sure you want to clear all your answers in the form?</p>
      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px; flex-wrap: wrap;">
        <button type="button" class="btn-secondary" id="confirm-cancel-btn">Cancel</button>
        <button type="button" class="btn-primary" id="confirm-ok-btn" style="background-color: var(--error-color);">Clear</button>
      </div>
    </div>
  </div>

  <!-- Top Error Popup Modal Dialog -->
  <div class="modal-overlay top-error-modal-overlay" id="top-error-modal" style="display: none;">
    <div class="modal-content top-error-modal-content">
      <button type="button" class="top-error-close-btn" id="top-error-close-x" aria-label="Close dialog">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="top-error-icon-wrapper">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>

      <h3 class="modal-title top-error-modal-title">Error Submitting Response</h3>
      <p class="modal-text top-error-modal-text" id="top-error-desc">Please reload the page and try to fill the form again.</p>

      <div class="top-error-actions">
        <button type="button" class="btn-primary top-error-btn-reload" id="top-error-reload-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Reload Form
        </button>
        <button type="button" class="btn-secondary top-error-btn-dismiss" id="top-error-dismiss-btn">Dismiss</button>
      </div>
    </div>
  </div>

  <!-- Fixed Return to Summary button (appears after first summary visit, visible on form steps) -->
  <button type="button" class="return-to-summary-btn" id="return-to-summary-btn">
    Response Summary &#8594;
  </button>



  <script src="user.js?v=<?= filemtime(__DIR__ . '/user.js') ?>"></script>

</body>
</html>
