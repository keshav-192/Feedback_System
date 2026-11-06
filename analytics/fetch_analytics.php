<?php
// analytics/fetch_analytics.php
header('Content-Type: application/json; charset=utf-8');
require_once '../configuration/config.php';
require_once '../includes/auth.php';
requireApiAdmin();

// 1. Fetch all available forms for the dropdown
$forms = [];
try {
    $forms_stmt = $pdo->query("SELECT id, title, qr_image_path FROM forms ORDER BY id ASC");
    $forms = $forms_stmt->fetchAll();
} catch (PDOException $e) {
    $forms = [];
}

// 2. Determine requested form_id
$form_id = isset($_GET['form_id']) ? intval($_GET['form_id']) : 0;
if ($form_id === 0) {
    if (count($forms) > 0) {
        $form_id = intval($forms[0]['id']);
    } else {
        $form_id = 1;
    }
}

// Ensure the form is in our forms list
$form_exists = false;
foreach ($forms as $f) {
    if (intval($f['id']) === $form_id) {
        $form_exists = true;
        break;
    }
}
if (!$form_exists) {
    $forms[] = ['id' => $form_id, 'title' => 'Feedback Form (ID: ' . $form_id . ')'];
}

// 3. Fetch ALL questions for this form (both quantifiable and text)
$all_questions = [];
$quantifiable_questions = [];
$text_questions = [];
try {
    $q_stmt = $pdo->prepare("SELECT id, question, type, step_no, option_group_id, question_order, section_name, filter, active, created_at, updated_at FROM questions WHERE form_id = :form_id ORDER BY step_no ASC, question_order ASC");
    $q_stmt->execute(['form_id' => $form_id]);
    $all_questions = $q_stmt->fetchAll();
    
    foreach ($all_questions as $q) {
        if (in_array($q['type'], ['text', 'textarea'])) {
            $text_questions[] = $q;
        } else {
            $quantifiable_questions[] = $q;
        }
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error fetching questions']);
    exit;
}

// Step 1 Demographic filterable questions
$filterable_questions = [];
foreach ($all_questions as $q) {
    if (intval($q['filter']) === 1 && in_array($q['type'], ['select', 'radio', 'checkbox'])) {
        $filterable_questions[$q['question']] = [];
    }
}

// Helper to parse Year, Year-Month, Month-Year, or Full Date
if (!function_exists('classifyDateInput')) {
    function classifyDateInput($input) {
        if (empty($input)) return ['type' => 'empty'];
        $input = trim($input);
        // Strip common placeholder tokens
        $cleaned = trim(preg_replace('/\bdd\b|\bmm\b/i', '', $input), " -/.,");
        if (empty($cleaned)) return ['type' => 'empty'];

        // 1. Year only (YYYY)
        if (preg_match('/^(\d{4})$/', $cleaned, $m)) {
            $y = (int)$m[1];
            if ($y >= 1900 && $y <= 2100) {
                return [
                    'type' => 'year',
                    'year' => $y,
                    'from_sql' => "$y-01-01 00:00:00",
                    'to_sql' => "$y-12-31 23:59:59"
                ];
            }
            return ['type' => 'invalid', 'error' => "Year must be between 1900 and 2100."];
        }

        // 2. Month-Year (MM-YYYY or MM/YYYY)
        if (preg_match('/^(\d{1,2})[-\/.](\d{4})$/', $cleaned, $m)) {
            $m_num = (int)$m[1];
            $y = (int)$m[2];
            if ($y < 1900 || $y > 2100) {
                return ['type' => 'invalid', 'error' => "Year must be between 1900 and 2100."];
            }
            if ($m_num < 1 || $m_num > 12) {
                return ['type' => 'invalid', 'error' => "Month must be between 01 and 12."];
            }
            $month = str_pad($m_num, 2, '0', STR_PAD_LEFT);
            $lastDay = date('t', strtotime("$y-$month-01"));
            return [
                'type' => 'month_year',
                'year' => $y,
                'month' => $m_num,
                'from_sql' => "$y-$month-01 00:00:00",
                'to_sql' => "$y-$month-$lastDay 23:59:59"
            ];
        }

        // 3. Full Date DD-MM-YYYY or DD/MM/YYYY
        if (preg_match('/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/', $cleaned, $m)) {
            $d_num = (int)$m[1];
            $m_num = (int)$m[2];
            $y = (int)$m[3];
            if ($y < 1900 || $y > 2100) {
                return ['type' => 'invalid', 'error' => "Year must be between 1900 and 2100."];
            }
            if ($m_num < 1 || $m_num > 12) {
                return ['type' => 'invalid', 'error' => "Month must be between 01 and 12."];
            }
            if (!checkdate($m_num, $d_num, $y)) {
                return ['type' => 'invalid', 'error' => "Invalid calendar date (day $d_num does not exist in month $m_num of $y)."];
            }
            $day = str_pad($d_num, 2, '0', STR_PAD_LEFT);
            $month = str_pad($m_num, 2, '0', STR_PAD_LEFT);
            return [
                'type' => 'full_date',
                'year' => $y,
                'month' => $m_num,
                'day' => $d_num,
                'from_sql' => "$y-$month-$day 00:00:00",
                'to_sql' => "$y-$month-$day 23:59:59"
            ];
        }

        // 4. ISO Full Date YYYY-MM-DD
        if (preg_match('/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/', $cleaned, $m)) {
            $y = (int)$m[1];
            $m_num = (int)$m[2];
            $d_num = (int)$m[3];
            if (!checkdate($m_num, $d_num, $y)) {
                return ['type' => 'invalid', 'error' => "Invalid calendar date."];
            }
            $day = str_pad($d_num, 2, '0', STR_PAD_LEFT);
            $month = str_pad($m_num, 2, '0', STR_PAD_LEFT);
            return [
                'type' => 'full_date',
                'year' => $y,
                'month' => $m_num,
                'day' => $d_num,
                'from_sql' => "$y-$month-$day 00:00:00",
                'to_sql' => "$y-$month-$day 23:59:59"
            ];
        }

        return ['type' => 'invalid', 'error' => "Unrecognized date format. Allowed formats: YYYY, MM-YYYY, or DD-MM-YYYY."];
    }
}

if (!function_exists('validateDateRangeParams')) {
    function validateDateRangeParams($raw_from, $raw_to) {
        $from_info = classifyDateInput($raw_from);
        $to_info = classifyDateInput($raw_to);

        // 1. Both empty -> Valid (no filter)
        if ($from_info['type'] === 'empty' && $to_info['type'] === 'empty') {
            return ['valid' => true, 'parsed_from' => null, 'parsed_to' => null];
        }

        // 2. One empty, one filled -> Invalid (both required)
        if ($from_info['type'] === 'empty' || $to_info['type'] === 'empty') {
            return ['valid' => false, 'error' => "Both 'From' and 'To' dates must be provided."];
        }

        // 3. Format errors
        if ($from_info['type'] === 'invalid') {
            return ['valid' => false, 'error' => "From Date: " . $from_info['error']];
        }
        if ($to_info['type'] === 'invalid') {
            return ['valid' => false, 'error' => "To Date: " . $to_info['error']];
        }

        // 4. Granularity Matching (Both must be same type)
        if ($from_info['type'] !== $to_info['type']) {
            $format_names = [
                'year' => 'Year only (YYYY)',
                'month_year' => 'Month-Year (MM-YYYY)',
                'full_date' => 'Full Date (DD-MM-YYYY)'
            ];
            $from_name = $format_names[$from_info['type']] ?? $from_info['type'];
            $to_name = $format_names[$to_info['type']] ?? $to_info['type'];
            return [
                'valid' => false,
                'error' => "Mismatched date formats! 'From' is $from_name but 'To' is $to_name. Both must have matching formats."
            ];
        }

        // 5. Chronological Order ("To" >= "From")
        // Mode A: Year
        if ($from_info['type'] === 'year') {
            if ($to_info['year'] < $from_info['year']) {
                return ['valid' => false, 'error' => "'To' year ({$to_info['year']}) cannot be earlier than 'From' year ({$from_info['year']})."];
            }
        }
        // Mode B: Month-Year
        elseif ($from_info['type'] === 'month_year') {
            if ($to_info['year'] < $from_info['year']) {
                return ['valid' => false, 'error' => "'To' year ({$to_info['year']}) cannot be earlier than 'From' year ({$from_info['year']})."];
            }
            if ($to_info['year'] === $from_info['year'] && $to_info['month'] < $from_info['month']) {
                return ['valid' => false, 'error' => "'To' month cannot be earlier than 'From' month for year {$from_info['year']}."];
            }
        }
        // Mode C: Full Date
        elseif ($from_info['type'] === 'full_date') {
            $ts_from = strtotime($from_info['from_sql']);
            $ts_to = strtotime($to_info['to_sql']);
            if ($ts_to < $ts_from) {
                return ['valid' => false, 'error' => "'To' date cannot be earlier than 'From' date."];
            }
        }

        return [
            'valid' => true,
            'parsed_from' => $from_info['from_sql'],
            'parsed_to' => $to_info['to_sql']
        ];
    }
}

if (!function_exists('parseDateFilter')) {
    function parseDateFilter($input, $isEndDate = false) {
        $info = classifyDateInput($input);
        if ($info['type'] === 'empty' || $info['type'] === 'invalid') return null;
        return $isEndDate ? $info['to_sql'] : $info['from_sql'];
    }
}

// Filter parameters
$filter_year = isset($_GET['year']) ? trim($_GET['year']) : '';
$filter_date_from = isset($_GET['date_from']) ? trim($_GET['date_from']) : '';
$filter_date_to = isset($_GET['date_to']) ? trim($_GET['date_to']) : '';
$filters_json = isset($_GET['filters']) ? trim($_GET['filters']) : '{}';
$active_filters = json_decode($filters_json, true);
if (!is_array($active_filters)) $active_filters = [];

// Strict Server-Side Validation
$date_validation = validateDateRangeParams($filter_date_from, $filter_date_to);
if (!$date_validation['valid']) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $date_validation['error'],
        'error' => $date_validation['error']
    ]);
    exit;
}

$parsed_from = $date_validation['parsed_from'];
$parsed_to = $date_validation['parsed_to'];

// 4. Fetch all raw responses for the form
$responses = [];
$years = [];
try {
    $y_stmt = $pdo->prepare("SELECT DISTINCT YEAR(submitted_at) as year FROM responses WHERE form_id = :form_id AND submitted_at IS NOT NULL ORDER BY year DESC");
    $y_stmt->execute(['form_id' => $form_id]);
    $years = array_values(array_filter(array_map('intval', $y_stmt->fetchAll(PDO::FETCH_COLUMN))));

    $sql = "SELECT id, respondent_id, response, submitted_at FROM responses WHERE form_id = ?";
    $params = [$form_id];

    if ($parsed_from) {
        $sql .= " AND submitted_at >= ?";
        $params[] = $parsed_from;
    }
    if ($parsed_to) {
        $sql .= " AND submitted_at <= ?";
        $params[] = $parsed_to;
    }

    if (!$parsed_from && !$parsed_to && $filter_year !== '') {
        $year_arr = array_filter(array_map('intval', explode(',', $filter_year)));
        if (!empty($year_arr)) {
            $placeholders = implode(',', array_fill(0, count($year_arr), '?'));
            $sql .= " AND YEAR(submitted_at) IN ($placeholders)";
            $params = array_merge($params, array_values($year_arr));
        }
    }

    $sql .= " ORDER BY submitted_at DESC";
    $r_stmt = $pdo->prepare($sql);
    $r_stmt->execute($params);
    $responses = $r_stmt->fetchAll();
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error fetching responses']);
    exit;
}

// 5. Load Option Groups and Scale Weights from options.json
$options_json_path = '../options.json';
$options_data = [];
if (file_exists($options_json_path)) {
    $options_data = json_decode(file_get_contents($options_json_path), true);
}
$option_groups = [];
$weight_lookup = []; // [group_id => [label_lowercase => weight]]
if (is_array($options_data)) {
    foreach ($options_data as $grp) {
        if (isset($grp['group_id'])) {
            $gid = $grp['group_id'];
            $gname = isset($grp['group_name']) ? $grp['group_name'] : '';
            
            $option_groups[$gid] = $grp;
            if ($gname !== '') {
                $option_groups[$gname] = $grp;
            }

            if (isset($grp['options']) && is_array($grp['options'])) {
                foreach ($grp['options'] as $opt) {
                    if (isset($opt['label']) && isset($opt['weight'])) {
                        $lbl = strtolower(trim($opt['label']));
                        $w = floatval($opt['weight']);
                        
                        $weight_lookup[$gid][$lbl] = $w;
                        if ($gname !== '') {
                            $weight_lookup[$gname][$lbl] = $w;
                        }
                    }
                }
            }
        }
    }
}

// 6. Process and Filter Responses
$valid_responses = [];
$qualitative_feedback = []; // [question_text => [['text' => '...', 'date' => '...']]]

foreach ($responses as $r) {
    $resp_json = json_decode($r['response'], true);
    if (!is_array($resp_json)) continue;
    
    // Populate dynamic filter options from raw responses
    foreach ($filterable_questions as $fq_text => &$opts) {
        if (isset($resp_json[$fq_text]) && $resp_json[$fq_text] !== 'Not answered') {
            $ans = $resp_json[$fq_text];
            $ans_arr = is_array($ans) ? array_map('trim', $ans) : array_map('trim', explode(', ', (string)$ans));
            foreach ($ans_arr as $a) {
                if (strpos($a, 'Other:') === 0) $a = 'Other';
                if (!in_array($a, $opts) && $a !== '') {
                    $opts[] = $a;
                }
            }
        }
    }
    unset($opts); // Break the reference so it doesn't accidentally get overwritten later

    // Check Level 2 active filters
    $matches_all_filters = true;
    foreach ($active_filters as $fq_text => $f_val) {
        if (empty($f_val)) continue; // Can be empty string or empty array
        
        if (!isset($resp_json[$fq_text])) {
            $matches_all_filters = false;
            break;
        }
        $ans = $resp_json[$fq_text];
        $ans_arr = is_array($ans) ? array_map('trim', $ans) : array_map('trim', explode(', ', (string)$ans));
        $has_match = false;
        
        if (is_array($f_val)) {
            // New logic: multiple selection
            foreach ($ans_arr as $a) {
                if (strpos($a, 'Other:') === 0) $a = 'Other';
                if (in_array($a, $f_val)) {
                    $has_match = true;
                    break;
                }
            }
        } else {
            // Old logic: single string
            foreach ($ans_arr as $a) {
                if (strpos($a, 'Other:') === 0) $a = 'Other';
                if ($a === $f_val) {
                    $has_match = true;
                    break;
                }
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

    // Qualitative comments will be collected during the heuristic resolution phase
}

$total_responses = count($valid_responses);

// ── 7.5 Aggregate Form Activity Timeline (Daily & Monthly for Line Chart) ──
$daily_counts = [];
$monthly_counts = [];
$peak_day = null;
$peak_day_count = 0;
$peak_month = null;
$peak_month_count = 0;

foreach ($valid_responses as $vr) {
    if (empty($vr['submitted_at'])) continue;
    $ts = strtotime($vr['submitted_at']);
    if ($ts === false) continue;

    $d_key = date('Y-m-d', $ts);
    $m_key = date('Y-m', $ts);

    if (!isset($daily_counts[$d_key])) $daily_counts[$d_key] = 0;
    $daily_counts[$d_key]++;

    if (!isset($monthly_counts[$m_key])) $monthly_counts[$m_key] = 0;
    $monthly_counts[$m_key]++;
}

ksort($daily_counts);
ksort($monthly_counts);

$daily_series = [];
$running_daily = 0;
foreach ($daily_counts as $d => $cnt) {
    $running_daily += $cnt;
    if ($cnt > $peak_day_count) {
        $peak_day_count = $cnt;
        $peak_day = date('d M Y', strtotime($d));
    }
    $daily_series[] = [
        'date' => $d,
        'label' => date('d M Y', strtotime($d)),
        'short_label' => date('d M', strtotime($d)),
        'count' => $cnt,
        'cumulative' => $running_daily,
        'percentage' => $total_responses > 0 ? round(($cnt / $total_responses) * 100, 1) : 0
    ];
}

$monthly_series = [];
$running_monthly = 0;
foreach ($monthly_counts as $m => $cnt) {
    $running_monthly += $cnt;
    if ($cnt > $peak_month_count) {
        $peak_month_count = $cnt;
        $peak_month = date('M Y', strtotime($m . '-01'));
    }
    $monthly_series[] = [
        'month' => $m,
        'label' => date('M Y', strtotime($m . '-01')),
        'short_label' => date('M Y', strtotime($m . '-01')),
        'count' => $cnt,
        'cumulative' => $running_monthly,
        'percentage' => $total_responses > 0 ? round(($cnt / $total_responses) * 100, 1) : 0
    ];
}

$submission_timeline = [
    'has_timeline' => count($daily_series) > 0,
    'total_count' => $total_responses,
    'daily' => $daily_series,
    'monthly' => $monthly_series,
    'peak_day' => $peak_day ? "$peak_day ($peak_day_count responses)" : null,
    'peak_month' => $peak_month ? "$peak_month ($peak_month_count responses)" : null,
    'start_date' => !empty($daily_series) ? $daily_series[0]['label'] : null,
    'end_date' => !empty($daily_series) ? $daily_series[count($daily_series) - 1]['label'] : null,
];

// (Excel export logic moved to the bottom, after heuristic processing)

// ── 8. Initialize Groups & Calculate Tallies ─────────────────────
// Every question is preserved individually in form question sequence
$analytics_data = [];
$question_map = []; 
$formed_groups = [];

foreach ($all_questions as $q) {
    $q_text = trim($q['question']);
    $is_text = in_array($q['type'], ['text', 'textarea']);
    $display_text = intval($q['active']) ? $q_text : $q_text . " [Archived v" . $q['id'] . "]";

    if ($is_text) {
        if (!isset($question_map[$q_text])) {
            $question_map[$q_text] = [];
        }
        $question_map[$q_text][] = [
            'type' => $q['type'],
            'is_text' => true,
            'group_id' => null,
            'idx' => null,
            'active' => intval($q['active']),
            'options' => [],
            'display_text' => $display_text,
            'created_at' => strtotime($q['created_at']),
            'updated_at' => strtotime($q['updated_at']),
            'original_q' => $q
        ];
        continue;
    }

    $group_options = [];
    if (!empty($q['option_group_id']) && isset($option_groups[$q['option_group_id']])) {
        if (isset($option_groups[$q['option_group_id']]['options'])) {
            foreach ($option_groups[$q['option_group_id']]['options'] as $opt) {
                $group_options[] = $opt['label'];
            }
        }
    } elseif (in_array($q['type'], ['rating', 'linear_scale', 'radio_grid', 'checkbox_grid', 'slider_grid'])) {
        $group_options = ['1', '2', '3', '4', '5'];
    }

    $group_id = 'ungrouped_' . $q['id'];
    $grp_name = $q_text;

    $question_struct = [
        'id' => $q['id'],
        'question' => $display_text,
        'original_question' => $q_text,
        'type' => $q['type'],
        'option_group_id' => $q['option_group_id'],
        'section_name' => $q['section_name'],
        'step_no' => $q['step_no'],
        'active' => intval($q['active']),
        'tallies' => [], 
        'total_answered' => 0,
        'weighted_score' => 0,
        'score_percentage' => 0,
        'positive_rate' => 0,
        'checkbox_score_sum' => 0,
        'checkbox_pos_sum' => 0
    ];

    $formed_groups[$group_id] = [
        'group_id' => $group_id,
        'group_name' => $grp_name,
        'option_group_id' => $q['option_group_id'],
        'options' => $group_options,
        'first_question' => $q,
        'questions' => [$question_struct]
    ];

    if (!isset($question_map[$q_text])) {
        $question_map[$q_text] = [];
    }
    $question_map[$q_text][] = [
        'type' => $q['type'],
        'is_text' => false,
        'group_id' => $group_id,
        'idx' => 0,
        'active' => intval($q['active']),
        'options' => $group_options,
        'display_text' => $display_text,
        'created_at' => strtotime($q['created_at']),
        'updated_at' => strtotime($q['updated_at']),
        'original_q' => $q
    ];
}

$analytics_data = $formed_groups;

// Process tallies and rewrite valid_responses keys for Excel Export
foreach ($valid_responses as $vr_idx => $vr) {
    $resp_json = $vr['answers'];
    $new_answers = [];
    
    foreach ($resp_json as $q_text => $answer) {
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
            // Heuristic matching: Try to match the answer to the options of each version
            $match_scores = [];
            foreach ($refs as $r) {
                $score = 0;
                $is_active = $r['active'];
                $opts = array_map('strtolower', array_map('trim', $r['options']));
                
                // If the answer is one of the options, high score
                $answer_is_array = is_array($answer);
                $ans_str = $answer_is_array ? implode(', ', $answer) : (string)$answer;
                $ans_lower = strtolower(trim($ans_str));
                
                // Temporal matching (strongest indicator)
                $sub_time = strtotime($vr['submitted_at']);
                $q_created = $r['created_at'];
                $q_updated = $r['updated_at'];
                
                if ($sub_time >= $q_created) {
                    if ($r['active'] == 1 || $sub_time <= $q_updated) {
                        $score += 500; // Perfect time match
                    } else {
                        // Response after archival (e.g. form opened before archival, submitted after)
                        $score += 100;
                    }
                }
                
                if ($r['is_text']) {
                    // Free text fields accept any string, give them a strong baseline score
                    $score += 50;
                    $len = strlen($ans_lower);
                    if ($r['type'] === 'textarea') {
                        if ($len > 40) $score += 20;
                    } elseif ($r['type'] === 'text') {
                        if ($len <= 40) $score += 20;
                    }
                } else {
                    if (!$answer_is_array && in_array($ans_lower, $opts)) {
                        $score += 100; // Perfect match for quantifiable
                    } else {
                        // Check for checkbox comma separated values or array
                        $selected_opts = $answer_is_array ? array_map('trim', $answer) : array_map('trim', explode(', ', (string)$answer));
                        $match_count = 0;
                        foreach ($selected_opts as $opt) {
                            if (strpos($opt, 'Other:') === 0) $opt = 'Other';
                            if (in_array(strtolower($opt), $opts)) {
                                $match_count++;
                            }
                        }
                        if ($match_count > 0 && $match_count == count($selected_opts)) {
                            $score += 100; // All comma-separated values match
                        } elseif ($match_count > 0) {
                            $score += 80; // Some match
                        }
                    }
                }
                
                // Active version gets a slight priority in a tie
                if ($is_active) {
                    $score += 1;
                }
                $match_scores[] = ['ref' => $r, 'score' => $score];
            }
            
            usort($match_scores, function($a, $b) {
                return $b['score'] <=> $a['score'];
            });
            
            $best_ref = $match_scores[0]['ref'];
        }

        // Rewrite the answer key using the display text so Excel export works flawlessly
        $display_text = $best_ref['display_text'];
        $new_answers[$display_text] = $answer;

        if ($answer === 'Not answered' || $answer === '' || (is_array($answer) && empty($answer))) continue;

        if ($best_ref['is_text']) {
            $val = is_array($answer) ? implode(', ', $answer) : trim((string)$answer);
            if ($val !== '' && strcasecmp($val, 'Not answered') !== 0) {
                if (!isset($qualitative_feedback[$display_text])) {
                    $qualitative_feedback[$display_text] = [
                        'active' => $best_ref['active'],
                        'comments' => []
                    ];
                }
                $qualitative_feedback[$display_text]['comments'][] = [
                    'text' => $val,
                    'date' => $vr['submitted_at'],
                    'respondent' => $vr['respondent_id'] ?: 'Anonymous'
                ];
            }
        } else {
            $group_id = $best_ref['group_id'];
            $idx = $best_ref['idx'];
            
            $analytics_data[$group_id]['questions'][$idx]['total_answered']++;
            
            $type = $analytics_data[$group_id]['questions'][$idx]['type'];
            if ($type === 'checkbox' || is_array($answer)) {
                $selected_opts = is_array($answer) ? array_map('trim', $answer) : array_map('trim', explode(', ', (string)$answer));
                foreach ($selected_opts as $opt) {
                    if (strpos($opt, 'Other:') === 0) $opt = 'Other';
                    if (!isset($analytics_data[$group_id]['questions'][$idx]['tallies'][$opt])) {
                        $analytics_data[$group_id]['questions'][$idx]['tallies'][$opt] = 0;
                    }
                    $analytics_data[$group_id]['questions'][$idx]['tallies'][$opt]++;
                }

                // If this is specifically a checkbox question with scale weights, compute respondent-level average
                if ($type === 'checkbox') {
                    $q_group_id = $analytics_data[$group_id]['questions'][$idx]['option_group_id'];
                    if (isset($weight_lookup[$q_group_id])) {
                        $weights = $weight_lookup[$q_group_id];
                        $resp_score_sum = 0;
                        $resp_opts_count = 0;
                        $resp_pos_count = 0;

                        foreach ($selected_opts as $opt) {
                            $clean_opt = (strpos($opt, 'Other:') === 0) ? 'Other' : $opt;
                            $lbl_lower = strtolower(trim($clean_opt));
                            if (isset($weights[$lbl_lower])) {
                                $w = $weights[$lbl_lower];
                                $resp_score_sum += $w;
                                $resp_opts_count++;
                                if ($w >= 4 || in_array($lbl_lower, ['excellent', 'good', 'strongly agree', 'agree', 'highly effective', 'effective', 'yes'])) {
                                    $resp_pos_count++;
                                }
                            }
                        }

                        if ($resp_opts_count > 0) {
                            $analytics_data[$group_id]['questions'][$idx]['checkbox_score_sum'] += ($resp_score_sum / $resp_opts_count);
                            $analytics_data[$group_id]['questions'][$idx]['checkbox_pos_sum'] += ($resp_pos_count / $resp_opts_count);
                        }
                    }
                }
            } else {
                $opt = (string)$answer;
                if (strpos($opt, 'Other:') === 0) $opt = 'Other';
                if (!isset($analytics_data[$group_id]['questions'][$idx]['tallies'][$opt])) {
                    $analytics_data[$group_id]['questions'][$idx]['tallies'][$opt] = 0;
                }
                $analytics_data[$group_id]['questions'][$idx]['tallies'][$opt]++;
            }
        }
    }
    
    // Save rewritten answers back
    $valid_responses[$vr_idx]['answers'] = $new_answers;
}

// ── 7. Handle Excel Export Request (Moved here to use rewritten answers) ──
if (isset($_GET['export']) && $_GET['export'] === 'excel') {
    $status_filter = isset($_GET['status']) ? $_GET['status'] : 'all';
    $export_questions = [];
    foreach ($all_questions as $q) {
        if ($status_filter === 'active' && intval($q['active']) === 0) continue;
        if ($status_filter === 'archived' && intval($q['active']) === 1) continue;
        
        // Use the display text so it perfectly matches our rewritten JSON keys
        $q['display_text'] = intval($q['active']) ? trim($q['question']) : trim($q['question']) . " [Archived v" . $q['id'] . "]";
        $export_questions[] = $q;
    }

    header('Content-Type: application/vnd.ms-excel; charset=utf-8');
    header('Content-Disposition: attachment; filename="feedback_report_form_' . $form_id . '.xls"');
    
    echo '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
    echo '<head><meta charset="UTF-8"></head>';
    echo '<body>';
    echo '<table border="1">';
    echo '<tr>';
    echo '<th style="background-color: #f3f4f6;">Submission ID</th>';
    echo '<th style="background-color: #f3f4f6;">Submitted At</th>';
    echo '<th style="background-color: #f3f4f6;">Respondent ID</th>';
    foreach ($export_questions as $q) {
        echo '<th style="background-color: #f3f4f6;">' . htmlspecialchars($q['display_text']) . '</th>';
    }
    echo '</tr>';
    
    foreach ($valid_responses as $vr) {
        echo '<tr>';
        echo '<td>' . htmlspecialchars($vr['id']) . '</td>';
        echo '<td>' . htmlspecialchars($vr['submitted_at']) . '</td>';
        echo '<td>' . htmlspecialchars($vr['respondent_id'] ?: 'N/A') . '</td>';
        foreach ($export_questions as $q) {
            $ans = isset($vr['answers'][$q['display_text']]) ? $vr['answers'][$q['display_text']] : '-';
            if (is_array($ans)) {
                $ans = implode(', ', $ans);
            }
            echo '<td>' . htmlspecialchars((string)$ans) . '</td>';
        }
        echo '</tr>';
    }
    echo '</table>';
    echo '</body></html>';
    exit;
}

// ── 9. Calculate Executive KPI Metrics & Scorecards ──────────────
$all_scored_questions = [];
$total_weighted_points = 0;
$total_max_possible_points = 0;
$global_positive_count = 0;
$global_total_scale_answers = 0;

foreach ($analytics_data as $g_id => &$grp) {
    foreach ($grp['questions'] as &$q) {
        $q_group_id = $q['option_group_id'];
        $total_ans = $q['total_answered'];
        
        if ($total_ans > 0 && isset($weight_lookup[$q_group_id])) {
            $weights = $weight_lookup[$q_group_id];
            $max_weight = count($weights) > 0 ? max($weights) : 5;
            $question_score_sum = 0;
            $pos_count = 0;
            
            if ($q['type'] === 'checkbox') {
                // Checkbox questions use respondent-level average sum
                $question_score_sum = isset($q['checkbox_score_sum']) ? $q['checkbox_score_sum'] : 0;
                $pos_count = isset($q['checkbox_pos_sum']) ? $q['checkbox_pos_sum'] : 0;
            } else {
                // Normal questions (select, radio, rating, etc.) - completely untouched
                foreach ($q['tallies'] as $lbl => $cnt) {
                    $lbl_lower = strtolower(trim($lbl));
                    $w = isset($weights[$lbl_lower]) ? $weights[$lbl_lower] : 0;
                    $question_score_sum += ($cnt * $w);
                    
                    // Positive threshold (weight >= 4 or positive label)
                    if ($w >= 4 || in_array($lbl_lower, ['excellent', 'good', 'strongly agree', 'agree', 'highly effective', 'effective', 'yes'])) {
                        $pos_count += $cnt;
                    }
                }
            }
            
            $q_avg_score = min($max_weight, round($question_score_sum / $total_ans, 2));
            $q_pct = $max_weight != 0 ? min(100.0, round(($q_avg_score / $max_weight) * 100, 1)) : 0;
            $q_pos_pct = min(100.0, round(($pos_count / $total_ans) * 100, 1));
            
            $q['weighted_score'] = $q_avg_score;
            $q['score_percentage'] = $q_pct;
            $q['positive_rate'] = $q_pos_pct;
            
            $total_weighted_points += $question_score_sum;
            $total_max_possible_points += ($total_ans * $max_weight);
            $global_positive_count += $pos_count;
            $global_total_scale_answers += $total_ans;
            
            $all_scored_questions[] = [
                'id' => $q['id'],
                'question' => $q['question'],
                'group_name' => $grp['group_name'],
                'score' => $q_avg_score,
                'max_score' => $max_weight,
                'percentage' => $q_pct,
                'positive_rate' => $q_pos_pct,
                'total_answered' => $total_ans
            ];
        }
    }
}
unset($grp);
unset($q);

// Sort for Top Strengths & Focus Areas
usort($all_scored_questions, function($a, $b) {
    return $b['percentage'] <=> $a['percentage'];
});

$top_strengths = array_slice($all_scored_questions, 0, 3);
$bottom_focus_areas = array_reverse(array_slice($all_scored_questions, -3));

$overall_satisfaction_percentage = $total_max_possible_points > 0 
    ? round(($total_weighted_points / $total_max_possible_points) * 100, 1) 
    : 0;

$overall_score_5 = round(($overall_satisfaction_percentage / 100) * 5, 2);
$overall_positive_rate = $global_total_scale_answers > 0 
    ? round(($global_positive_count / $global_total_scale_answers) * 100, 1) 
    : 0;

// ── 8.5 Aggregate Year-over-Year (YoY) Multi-Year Performance Trend ──
$yoy_stats = [];

foreach ($valid_responses as $vr) {
    if (empty($vr['submitted_at'])) continue;
    $ts = strtotime($vr['submitted_at']);
    if ($ts === false) continue;
    $yr = date('Y', $ts);

    if (!isset($yoy_stats[$yr])) {
        $yoy_stats[$yr] = [
            'count' => 0,
            'weighted_points' => 0,
            'max_points' => 0,
            'categories' => []
        ];
    }
    $yoy_stats[$yr]['count']++;

    $resp_json = $vr['answers'];
    if (!is_array($resp_json)) continue;

    foreach ($all_questions as $q) {
        $q_text = trim($q['question']);
        $display_text = intval($q['active']) ? $q_text : $q_text . " [Archived v" . $q['id'] . "]";
        
        $answer = null;
        if (isset($resp_json[$display_text])) {
            $answer = $resp_json[$display_text];
        } elseif (isset($resp_json[$q_text])) {
            $answer = $resp_json[$q_text];
        }
        if ($answer === null || $answer === 'Not answered' || $answer === '' || (is_array($answer) && empty($answer))) {
            continue;
        }

        $og = !empty($q['option_group_id']) ? trim($q['option_group_id']) : (in_array($q['type'], ['rating', 'linear_scale', 'radio_grid', 'checkbox_grid', 'slider_grid']) ? 'scale_1_5' : null);
        if (!$og || !isset($weight_lookup[$og])) continue;

        $weights = $weight_lookup[$og];
        $max_weight = count($weights) > 0 ? max($weights) : 5;
        $cat = !empty($q['section_name']) ? trim($q['section_name']) : (!empty($q['option_group_id']) ? trim($q['option_group_id']) : 'General Rating');

        if (!isset($yoy_stats[$yr]['categories'][$cat])) {
            $yoy_stats[$yr]['categories'][$cat] = ['points' => 0, 'max_points' => 0];
        }

        if ($q['type'] === 'checkbox' || is_array($answer)) {
            $selected_opts = is_array($answer) ? $answer : explode(', ', (string)$answer);
            $sum = 0;
            $cnt = 0;
            foreach ($selected_opts as $opt) {
                $lbl_lower = strtolower(trim($opt));
                if (isset($weights[$lbl_lower])) {
                    $sum += $weights[$lbl_lower];
                    $cnt++;
                }
            }
            if ($cnt > 0) {
                $p = ($sum / $cnt);
                $yoy_stats[$yr]['weighted_points'] += $p;
                $yoy_stats[$yr]['max_points'] += $max_weight;
                $yoy_stats[$yr]['categories'][$cat]['points'] += $p;
                $yoy_stats[$yr]['categories'][$cat]['max_points'] += $max_weight;
            }
        } else {
            $lbl_lower = strtolower(trim((string)$answer));
            if (isset($weights[$lbl_lower])) {
                $w = $weights[$lbl_lower];
                $yoy_stats[$yr]['weighted_points'] += $w;
                $yoy_stats[$yr]['max_points'] += $max_weight;
                $yoy_stats[$yr]['categories'][$cat]['points'] += $w;
                $yoy_stats[$yr]['categories'][$cat]['max_points'] += $max_weight;
            }
        }
    }
}

ksort($yoy_stats);
$yoy_years = array_keys($yoy_stats);
$yoy_series = [];
$prev_score = null;
$prev_pct = null;
$highest_year_label = null;
$highest_year_score = -1;

foreach ($yoy_stats as $yr => $data) {
    $score_5 = $data['max_points'] > 0 ? round(($data['weighted_points'] / $data['max_points']) * 5, 2) : 0;
    $pct = $data['max_points'] > 0 ? round(($data['weighted_points'] / $data['max_points']) * 100, 1) : 0;
    
    // NAAC standard accreditation performance grade
    $grade = 'A++ (Outstanding)';
    if ($score_5 < 2.50) {
        $grade = 'C (Needs Focus)';
    } elseif ($score_5 < 3.00) {
        $grade = 'B (Satisfactory)';
    } elseif ($score_5 < 3.50) {
        $grade = 'B++ (Good)';
    } elseif ($score_5 < 4.00) {
        $grade = 'A (Very Good)';
    } elseif ($score_5 < 4.50) {
        $grade = 'A+ (Excellent)';
    }

    $score_change = null;
    $pct_change = null;
    if ($prev_score !== null) {
        $score_change = round($score_5 - $prev_score, 2);
        $pct_change = round($pct - $prev_pct, 1);
    }

    if ($score_5 > $highest_year_score) {
        $highest_year_score = $score_5;
        $highest_year_label = "$yr ($score_5 / 5.0)";
    }

    $prev_score = $score_5;
    $prev_pct = $pct;

    $cat_scores = [];
    foreach ($data['categories'] as $cat => $cdata) {
        $cat_scores[$cat] = $cdata['max_points'] > 0 ? round(($cdata['points'] / $cdata['max_points']) * 5, 2) : 0;
    }

    $yoy_series[] = [
        'year' => (string)$yr,
        'label' => 'AY ' . $yr,
        'count' => $data['count'],
        'score_5' => $score_5,
        'percentage' => $pct,
        'grade' => $grade,
        'yoy_score_change' => $score_change,
        'yoy_pct_change' => $pct_change,
        'category_scores' => $cat_scores
    ];
}

// Build distinct list of categories across all years
$all_categories = [];
foreach ($yoy_stats as $yr => $data) {
    foreach (array_keys($data['categories']) as $cat) {
        if (!in_array($cat, $all_categories)) {
            $all_categories[] = $cat;
        }
    }
}

$category_series = [];
foreach ($all_categories as $cat) {
    $scores = [];
    foreach ($yoy_series as $ys) {
        $scores[$ys['year']] = isset($ys['category_scores'][$cat]) ? $ys['category_scores'][$cat] : null;
    }
    $category_series[] = [
        'name' => $cat,
        'scores' => $scores
    ];
}

$latest_trajectory = 'stable';
if (count($yoy_series) >= 2) {
    $last_item = $yoy_series[count($yoy_series) - 1];
    if ($last_item['yoy_score_change'] !== null) {
        if ($last_item['yoy_score_change'] > 0.05) {
            $latest_trajectory = 'improving';
        } elseif ($last_item['yoy_score_change'] < -0.05) {
            $latest_trajectory = 'declining';
        }
    }
}

$yoy_trend = [
    'has_multi_year' => count($yoy_years) >= 2,
    'total_years' => count($yoy_years),
    'years' => $yoy_years,
    'target_benchmark' => 4.0,
    'overall_series' => $yoy_series,
    'category_series' => $category_series,
    'highest_year' => $highest_year_label,
    'latest_trajectory' => $latest_trajectory
];

// ── Build Comparative Groups for Shared Option Sets (Horizontal Stacked Bar) ──
$comparative_groups = [];
$comp_buckets = [];

foreach ($all_questions as $q) {
    if (in_array($q['type'], ['text', 'textarea'])) continue;
    $og = !empty($q['option_group_id']) ? trim($q['option_group_id']) : (in_array($q['type'], ['rating', 'linear_scale']) ? 'scale_1_5' : null);
    if (!$og) continue;

    $sec = !empty($q['section_name']) ? trim($q['section_name']) : '';
    $key = $sec ? $sec . '___' . $og : $og;

    if (!isset($comp_buckets[$key])) {
        $opt_group_name = isset($option_groups[$og]['group_name']) ? $option_groups[$og]['group_name'] : $og;
        $grp_name = $sec ? ($sec . ($opt_group_name && $opt_group_name !== $sec ? ' (' . $opt_group_name . ')' : '')) : ($opt_group_name ? $opt_group_name : $og);

        $group_options = [];
        if (!empty($q['option_group_id']) && isset($option_groups[$q['option_group_id']]['options'])) {
            foreach ($option_groups[$q['option_group_id']]['options'] as $opt) {
                $group_options[] = $opt['label'];
            }
        } elseif (in_array($q['type'], ['rating', 'linear_scale', 'radio_grid', 'checkbox_grid', 'slider_grid'])) {
            $group_options = ['1', '2', '3', '4', '5'];
        }

        $comp_buckets[$key] = [
            'group_id' => 'comp_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $key),
            'group_name' => $grp_name,
            'option_group_id' => $og,
            'options' => $group_options,
            'questions' => []
        ];
    }

    $g_id = 'ungrouped_' . $q['id'];
    if (isset($analytics_data[$g_id]['questions'][0])) {
        $comp_buckets[$key]['questions'][] = $analytics_data[$g_id]['questions'][0];
    }
}

foreach ($comp_buckets as $cb) {
    if (count($cb['questions']) > 1) {
        $comparative_groups[] = $cb;
    }
}

$final_groups = array_values($analytics_data);

$human_readable = 'All Time';
if ($parsed_from && $parsed_to) {
    $human_readable = date('d M Y', strtotime($parsed_from)) . ' to ' . date('d M Y', strtotime($parsed_to));
} elseif ($parsed_from) {
    $human_readable = 'From ' . date('d M Y', strtotime($parsed_from)) . ' onwards';
} elseif ($parsed_to) {
    $human_readable = 'Up to ' . date('d M Y', strtotime($parsed_to));
}

echo json_encode([
    'success' => true,
    'forms' => $forms,
    'current_form_id' => $form_id,
    'summary' => [
        'total_responses' => $total_responses,
        'overall_score_5' => $overall_score_5,
        'overall_percentage' => $overall_satisfaction_percentage,
        'overall_positive_rate' => $overall_positive_rate,
        'total_scored_questions' => count($all_scored_questions)
    ],
    'top_strengths' => $top_strengths,
    'focus_areas' => $bottom_focus_areas,
    'available_years' => $years,
    'filterable_questions' => $filterable_questions,
    'qualitative_feedback' => $qualitative_feedback,
    'submission_timeline' => $submission_timeline,
    'yoy_trend' => $yoy_trend,
    'groups' => $final_groups,
    'comparative_groups' => $comparative_groups,
    'applied_date_filter' => [
        'date_from' => $filter_date_from,
        'date_to' => $filter_date_to,
        'parsed_from' => $parsed_from,
        'parsed_to' => $parsed_to,
        'human_readable' => $human_readable
    ]
]);

