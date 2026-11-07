<?php
header('Content-Type: application/json');
require_once '../configuration/config.php';
require_once '../trace_log.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    writeLog("Submit Error: Invalid request method from IP " . $_SERVER['REMOTE_ADDR']);
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    writeLog("Submit Error: Invalid JSON payload received.");
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

$form_id = isset($data['form_id']) ? intval($data['form_id']) : 0;
$respondent_id = isset($data['respondent_id']) ? trim($data['respondent_id']) : null;
$responses_json = isset($data['response']) ? json_encode($data['response']) : '{}';

$journey_raw = isset($data['journey']) && is_array($data['journey']) ? $data['journey'] : [];
$journey_clean = !empty($journey_raw) ? implode(' -> ', array_map('strip_tags', $journey_raw)) : 'Opened Form -> Final Submit';
$duration_str = isset($data['duration_sec']) ? intval($data['duration_sec']) . 's' : 'unknown';

function logUserSession($status, $detail) {
    global $form_id, $duration_str, $journey_clean;
    writeLog("User Session $status [Form ID: $form_id, Duration: $duration_str]: $journey_clean -> $detail");
}

if ($form_id <= 0) {
    writeLog("Submit Error: Invalid form ID ($form_id).");
    echo json_encode(['success' => false, 'error' => 'Invalid form ID']);
    exit;
}

// Rate Limiting / Spam Protection
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$now = time();
if (isset($_SESSION['last_form_submit_time'])) {
    if ($now - $_SESSION['last_form_submit_time'] < 60) {
        logUserSession('Blocked', "Submit Spam Warning: Rate limited IP " . $_SERVER['REMOTE_ADDR']);
        echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
        exit;
    }
}
$_SESSION['last_form_submit_time'] = $now;

// --- SECURITY: Server-Side Validation against DOM Tampering ---
$options_json_path = '../options.json';
$option_groups = [];
$option_group_parents = [];
if (file_exists($options_json_path)) {
    $options_data = json_decode(file_get_contents($options_json_path), true);
    if (is_array($options_data)) {
        foreach ($options_data as $group) {
            if (isset($group['group_name'])) {
                $option_groups[$group['group_name']] = isset($group['options']) ? $group['options'] : [];
                if (!empty($group['parent_group'])) {
                    $option_group_parents[$group['group_name']] = trim($group['parent_group']);
                }
            }
        }
    }
}

/**
 * Checks if a dependent question is applicable under hierarchical rules or conditional sub-section rules.
 * Returns false if the question is conditional and the parent question's answer does not match,
 * or if matching options are zero.
 */
function isQuestionApplicable($q, $db_questions, $response_data, $option_groups, $option_group_parents) {
    // 1. Check Conditional Sub-Section Dependency (depends_on_question_id & depends_on_value)
    if (!empty($q['depends_on_question_id']) && isset($q['depends_on_value']) && trim($q['depends_on_value']) !== '') {
        $parent_id = (int)$q['depends_on_question_id'];
        $expected_val = trim($q['depends_on_value']);

        // Find parent question in $db_questions by id
        $parent_q_text = null;
        foreach ($db_questions as $candidate) {
            if (isset($candidate['id']) && (int)$candidate['id'] === $parent_id) {
                $parent_q_text = trim($candidate['question']);
                break;
            }
        }

        // If parent question is missing or respondent did not answer it, dependent question is not applicable
        if (!$parent_q_text || !isset($response_data[$parent_q_text])) {
            return false;
        }

        $parent_ans = $response_data[$parent_q_text];
        if ($parent_ans === 'Not answered' || $parent_ans === 'Not applicable' || $parent_ans === '') {
            return false;
        }

        if (is_array($parent_ans)) {
            $matched = false;
            foreach ($parent_ans as $ansItem) {
                if (strcasecmp(trim($ansItem), $expected_val) === 0) {
                    $matched = true;
                    break;
                }
            }
            if (!$matched) return false;
        } else {
            if (strcasecmp(trim($parent_ans), $expected_val) !== 0) {
                return false;
            }
        }
    }

    // 2. Check Option Set Hierarchical Dependency (e.g. Program -> Department)
    $group_id = isset($q['option_group_id']) ? trim($q['option_group_id']) : null;
    if (!$group_id || !isset($option_group_parents[$group_id])) {
        return true; // Independent question, applicable
    }

    $parent_group_name = $option_group_parents[$group_id];

    // Find the parent question in the form that uses $parent_group_name
    $parent_q_text = null;
    foreach ($db_questions as $candidate) {
        if (isset($candidate['option_group_id']) && trim($candidate['option_group_id']) === $parent_group_name) {
            $parent_q_text = trim($candidate['question']);
            break;
        }
    }

    // If parent question is missing or not answered, child cannot be applicable
    if (!$parent_q_text || !isset($response_data[$parent_q_text])) {
        return false;
    }

    $parent_ans = $response_data[$parent_q_text];
    if ($parent_ans === 'Not answered' || $parent_ans === 'Not applicable' || $parent_ans === '') {
        return false;
    }

    // Check if any option in child group applies to parent's selected answer
    $options = isset($option_groups[$group_id]) ? $option_groups[$group_id] : [];
    foreach ($options as $opt) {
        if (empty($opt['parents']) || !is_array($opt['parents'])) {
            return true; // Universal option without parent restrictions
        }
        if (in_array($parent_ans, $opt['parents'])) {
            return true;
        }
    }

    return false; // Zero matching options
}

$q_stmt = $pdo->prepare("SELECT id, question, type, option_group_id, depends_on_question_id, depends_on_value, is_required, validation_type, max_length FROM questions WHERE form_id = :form_id AND active = 1");
$q_stmt->execute(['form_id' => $form_id]);
$db_questions = $q_stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($db_questions)) {
    logUserSession('Failed', "Submit Error: Form ID $form_id has no active questions or does not exist (from IP " . $_SERVER['REMOTE_ADDR'] . ")");
    echo json_encode(['success' => false, 'error' => 'Invalid form or no active questions available']);
    exit;
}

$q_map = [];
foreach ($db_questions as $q) {
    $q_map[trim($q['question'])] = $q;
}

$raw_response_data = isset($data['response']) && is_array($data['response']) ? $data['response'] : [];
$response_data = [];
foreach ($raw_response_data as $k => $v) {
    $response_data[trim($k)] = is_string($v) ? trim($v) : $v;
}

// 1. Check Missing or Empty Required Questions (Bypass Protection)
foreach ($db_questions as $q) {
    if (intval($q['is_required']) === 1) {
        $q_text = trim($q['question']);

        // Check if question is applicable under hierarchical dropdown rules
        if (!isQuestionApplicable($q, $db_questions, $response_data, $option_groups, $option_group_parents)) {
            // Not applicable: normalize value to 'Not applicable' and skip required validation
            $response_data[$q_text] = 'Not applicable';
            continue;
        }

        if (!isset($response_data[$q_text]) || $response_data[$q_text] === 'Not answered' || $response_data[$q_text] === '' || $response_data[$q_text] === 'Not applicable') {
            logUserSession('Failed', "Submit Error: Tampered data (Required question '$q_text' missing or empty) from IP " . $_SERVER['REMOTE_ADDR']);
            echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
            exit;
        }
    } else {
        $q_text = trim($q['question']);
        if (!isQuestionApplicable($q, $db_questions, $response_data, $option_groups, $option_group_parents)) {
            $response_data[$q_text] = 'Not applicable';
        }
    }
}

// 2. Check Each Submitted Answer (Unknown Question Injection & Valid Options)
foreach ($response_data as $q_text_clean => $answer) {
    // A. Check Unknown / Injected Question Detection
    if (!isset($q_map[$q_text_clean])) {
        logUserSession('Failed', "Submit Error: Tampered data (Unknown question '$q_text_clean' injected) from IP " . $_SERVER['REMOTE_ADDR']);
        echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
        exit;
    }
    
    $q_info = $q_map[$q_text_clean];
    $type = $q_info['type'];
    $group_id = $q_info['option_group_id'];

    // 2. Check Textarea Limit and Allowlist
    if ($type === 'textarea' && $answer !== 'Not answered' && $answer !== '') {
        $limit = isset($q_info['max_length']) && $q_info['max_length'] ? (int)$q_info['max_length'] : 2000;
        if (mb_strlen($answer, 'UTF-8') > $limit) {
            logUserSession('Failed', "Submit Error: Tampered data (Text exceeds $limit chars) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
            echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
            exit;
        }
        if (preg_match('/[^a-zA-Z0-9\s.,?!"\'()\-&\/@]/', $answer)) {
            logUserSession('Failed', "Submit Error: Tampered data (Invalid characters in text) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
            echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
            exit;
        }
        if (preg_match('/([.,?!"\'()\-&\/@])\1/', $answer)) {
            logUserSession('Failed', "Submit Error: Tampered data (Consecutive special characters) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
            echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
            exit;
        }
    }

    // 2.5 Check constraints for Register No, Emp ID, Email
    if ($type === 'text' && $answer !== 'Not answered' && $answer !== '') {
        $q_lower = strtolower($q_text_clean);
        $is_reg = (strpos($q_lower, 'register no') !== false || strpos($q_lower, 'reg no') !== false || strpos($q_lower, 'reg. no') !== false || strpos($q_lower, 'reg.no') !== false);
        $is_emp = (strpos($q_lower, 'emp id') !== false || strpos($q_lower, 'empid') !== false || strpos($q_lower, 'emp. id') !== false || strpos($q_lower, 'employee id') !== false);

        if ($is_reg && $is_emp) {
            $len = mb_strlen($answer, 'UTF-8');
            $is5Emp = ($len === 5 && preg_match('/^[0-9]{5}$/', $answer));
            $is10Reg = ($len === 10 && preg_match('/^[a-zA-Z0-9]{10}$/', $answer));
            if (!$is5Emp && !$is10Reg) {
                logUserSession('Failed', "Submit Error: Tampered data (Invalid Register No / Emp ID) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                exit;
            }
        } elseif ($is_reg) {
            if (mb_strlen($answer, 'UTF-8') !== 10 || preg_match('/[^a-zA-Z0-9]/', $answer)) {
                logUserSession('Failed', "Submit Error: Tampered data (Invalid Register No) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                exit;
            }
        } elseif ($is_emp) {
            if (mb_strlen($answer, 'UTF-8') !== 5 || preg_match('/[^0-9]/', $answer)) {
                logUserSession('Failed', "Submit Error: Tampered data (Invalid Emp ID) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                exit;
            }
        } elseif (strpos($q_lower, 'email') !== false) {
            $limit = 50;
            if (mb_strlen($answer, 'UTF-8') > $limit || preg_match('/[^a-zA-Z0-9@.]/', $answer)) {
                logUserSession('Failed', "Submit Error: Tampered data (Invalid Email chars or length) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                exit;
            }
            if (preg_match('/([@.])\1/', $answer)) {
                logUserSession('Failed', "Submit Error: Tampered data (Consecutive special chars in email) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                exit;
            }
        } else {
            // Generic short text validation
            $limit = isset($q_info['max_length']) && $q_info['max_length'] ? (int)$q_info['max_length'] : 250;
            $validation_type = isset($q_info['validation_type']) ? $q_info['validation_type'] : 'alphanumeric';

            if (mb_strlen($answer, 'UTF-8') > $limit) {
                logUserSession('Failed', "Submit Error: Tampered data (Length exceeds $limit) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                exit;
            }

            if ($validation_type === 'numeric') {
                if (preg_match('/[^0-9]/', $answer)) {
                    logUserSession('Failed', "Submit Error: Tampered data (Invalid chars, expected numeric) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                    echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                    exit;
                }
            } elseif ($validation_type === 'alphabet') {
                if (preg_match('/[^a-zA-Z\s]/', $answer)) {
                    logUserSession('Failed', "Submit Error: Tampered data (Invalid chars, expected alphabet) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                    echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                    exit;
                }
            } else {
                if (preg_match('/[^a-zA-Z0-9\s.,?!"\'()\-&\/@]/', $answer)) {
                    logUserSession('Failed', "Submit Error: Tampered data (Invalid characters in short text) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                    echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                    exit;
                }
                if (preg_match('/([.,?!"\'()\-&\/@])\1/', $answer)) {
                    logUserSession('Failed', "Submit Error: Tampered data (Consecutive special characters in short text) for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                    echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                    exit;
                }
            }
        }
    }

    // 3. Check Valid Options Bypass
    if ($answer !== 'Not answered' && $answer !== 'Not applicable' && in_array($type, ['select', 'radio', 'checkbox', 'rating', 'linear_scale', 'radio_grid', 'checkbox_grid', 'slider_grid'])) {
            if ($group_id && isset($option_groups[$group_id])) {
                $allowed_options = [];
                $has_other = false;
                
                foreach ($option_groups[$group_id] as $opt) {
                    $label = trim($opt['label']);
                    $allowed_options[] = $label;
                    if (strcasecmp($label, 'Other') === 0 || strcasecmp($label, 'Other:') === 0) {
                        $has_other = true;
                    }
                }
                
                $user_answers = ($type === 'checkbox' || $type === 'checkbox_grid') ? (is_array($answer) ? $answer : [$answer]) : [$answer];
                
                foreach ($user_answers as $ua) {
                    $ua = trim($ua);
                    if (strpos($ua, 'Other:') === 0 || strcasecmp($ua, 'Other') === 0) {
                        if (!$has_other) {
                            logUserSession('Failed', "Submit Error: Tampered data (Invalid 'Other') for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                            echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                            exit;
                        }
                    } else {
                        if (!in_array($ua, $allowed_options)) {
                            logUserSession('Failed', "Submit Error: Tampered data (Invalid option '$ua') for '$q_text_clean' from IP " . $_SERVER['REMOTE_ADDR']);
                            echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
                            exit;
                        }
                    }
                }
            }
        }
}
// --- END SECURITY VALIDATION ---

try {
    $stmt = $pdo->prepare("INSERT INTO responses (form_id, respondent_id, response, submitted_at) VALUES (:form_id, :respondent_id, :response, NOW())");
    $stmt->execute([
        ':form_id' => $form_id,
        ':respondent_id' => $respondent_id,
        ':response' => json_encode($response_data)
    ]);
    
    $insert_id = $pdo->lastInsertId();
    logUserSession('Completed', "Form Submitted Successfully (Response ID: $insert_id)");
    echo json_encode(['success' => true, 'id' => $insert_id]);
} catch (PDOException $e) {
    logUserSession('Error', "Database Error (Submitting Form $form_id): " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error Submitting Form, Please reload and try to fill the form again.']);
}
