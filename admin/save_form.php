<?php
// admin/save_form.php
require_once '../includes/auth.php';
requireApiAdmin();
require_once '../configuration/config.php';
require_once '../trace_log.php';

// Ensure the request is POST and contains JSON
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

// Handle multipart/form-data payload
$payload = null;
if (isset($_POST['form_data'])) {
    $payload = json_decode($_POST['form_data'], true);
} else {
    // Fallback for direct JSON if still used somehow
    $inputJSON = file_get_contents('php://input');
    $payload = json_decode($inputJSON, true);
}

if (!$payload || !isset($payload['title']) || !isset($payload['sections'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload received.']);
    exit;
}

// Check for duplicate form title (case-insensitive)
$title_check_stmt = $pdo->prepare("SELECT COUNT(*) FROM forms WHERE LOWER(title) = LOWER(:title)");
$title_check_stmt->execute(['title' => trim($payload['title'])]);
if ($title_check_stmt->fetchColumn() > 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "A form with the name '" . trim($payload['title']) . "' already exists. Please choose a different name."]);
    exit;
}

// Handle QR Image Upload
$qr_image_path = null;
if (isset($_FILES['qr_image']) && $_FILES['qr_image']['error'] === UPLOAD_ERR_OK) {
    $upload_dir = '../uploads/qr_codes/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }
    $file_ext = strtolower(pathinfo($_FILES['qr_image']['name'], PATHINFO_EXTENSION));
    $allowed_exts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
    if (in_array($file_ext, $allowed_exts)) {
        $filename = 'qr_' . time() . '_' . uniqid() . '.' . $file_ext;
        $dest_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['qr_image']['tmp_name'], $dest_path)) {
            $qr_image_path = 'uploads/qr_codes/' . $filename;
        }
    }
}


try {
    // Start Transaction
    $pdo->beginTransaction();

    // 1. Insert Form
    $stmtForm = $pdo->prepare("INSERT INTO forms (title, description, qr_image_path) VALUES (:title, :description, :qr_image_path)");
    $stmtForm->execute([
        'title' => $payload['title'],
        'description' => isset($payload['description']) ? $payload['description'] : '',
        'qr_image_path' => $qr_image_path
    ]);
    $form_id = $pdo->lastInsertId();

    // 2. Insert Questions
    $stmtQuestion = $pdo->prepare("INSERT INTO questions 
        (form_id, question, type, is_required, question_order, step_no, option_group_id, depends_on_question_id, depends_on_value, sub_section_name, section_name, filter, validation_type, max_length) 
        VALUES (:form_id, :question, :type, :is_required, :question_order, :step_no, :option_group_id, :depends_on_question_id, :depends_on_value, :sub_section_name, :section_name, :filter, :validation_type, :max_length)");

    $uid_to_db_id = [];

    foreach ($payload['sections'] as $sIndex => $section) {
        $step_no = $sIndex + 1; // Visual section order maps to step_no
        $section_name = isset($section['section_name']) && trim($section['section_name']) !== '' ? trim($section['section_name']) : null;
        
        if (isset($section['questions']) && is_array($section['questions'])) {
            foreach ($section['questions'] as $qIndex => $q) {
                $question_order = $qIndex + 1; // Order within the section
                
                // Map Frontend Types to DB Types
                $raw_type = isset($q['type']) ? $q['type'] : 'text';
                $db_type = $raw_type;
                $option_group_id = null;

                if ($raw_type === 'optionset' || $raw_type === 'rating' || $raw_type === 'linear_scale') {
                    if ($raw_type === 'rating') {
                        $db_type = 'rating';
                    } elseif ($raw_type === 'linear_scale') {
                        $render_type = isset($q['render_type']) ? $q['render_type'] : 'radio_grid';
                        if ($render_type === 'checkbox_grid') {
                            $db_type = 'checkbox_grid';
                        } elseif ($render_type === 'slider_grid') {
                            $db_type = 'slider_grid';
                        } else {
                            $db_type = 'linear_scale';
                        }
                    } else {
                        $render_type = isset($q['render_type']) ? $q['render_type'] : 'dropdown';
                        if ($render_type === 'checkbox') {
                            $db_type = 'checkbox';
                        } elseif ($render_type === 'radio') {
                            $db_type = 'radio';
                        } else {
                            $db_type = 'select';
                        }
                    }
                    // Store the group name directly as requested
                    $option_group_id = isset($q['option_set']) ? $q['option_set'] : null;
                }

                $validation_type = 'alphanumeric';
                $max_length = null;

                if ($raw_type === 'text' || $raw_type === 'textarea') {
                    $validation_type = isset($q['validation_type']) ? $q['validation_type'] : 'alphanumeric';
                    if (isset($q['max_length']) && $q['max_length'] !== '') {
                        $max_length = (int)$q['max_length'];
                        if ($max_length <= 0) $max_length = 1;
                    }
                }

                // Conditional Sub-Section Dependencies
                $client_uid = isset($q['client_uid']) ? trim($q['client_uid']) : null;
                $dep_uid = isset($q['depends_on_client_uid']) && trim($q['depends_on_client_uid']) !== '' ? trim($q['depends_on_client_uid']) : null;
                $dep_val = isset($q['depends_on_value']) && trim($q['depends_on_value']) !== '' ? trim($q['depends_on_value']) : null;
                $sub_sec = isset($q['sub_section_name']) && trim($q['sub_section_name']) !== '' ? trim($q['sub_section_name']) : null;

                $depends_on_question_id = null;
                if ($dep_uid) {
                    if (!isset($uid_to_db_id[$dep_uid])) {
                        throw new Exception("Invalid question dependency: Parent question is missing or appears after the dependent block.");
                    }
                    $depends_on_question_id = $uid_to_db_id[$dep_uid];
                    if (empty($dep_val)) {
                        throw new Exception("Conditional sub-section matching value cannot be empty.");
                    }
                }

                $stmtQuestion->execute([
                    'form_id' => $form_id,
                    'question' => $q['text'],
                    'type' => $db_type,
                    'is_required' => !empty($q['required']) ? 1 : 0,
                    'question_order' => $question_order,
                    'step_no' => $step_no,
                    'option_group_id' => $option_group_id,
                    'depends_on_question_id' => $depends_on_question_id,
                    'depends_on_value' => $dep_val,
                    'sub_section_name' => $sub_sec,
                    'section_name' => $section_name,
                    'filter' => !empty($q['is_filter']) ? 1 : 0,
                    'validation_type' => $validation_type,
                    'max_length' => $max_length
                ]);

                $inserted_id = (int)$pdo->lastInsertId();
                if ($client_uid) {
                    $uid_to_db_id[$client_uid] = $inserted_id;
                }
            }
        }
    }

    // Commit Transaction
    $pdo->commit();

    // ── Build Consolidated Single-Line Creation Log ──
    $structure_parts = [];
    $total_questions = 0;
    if (isset($payload['sections']) && is_array($payload['sections'])) {
        foreach ($payload['sections'] as $sIndex => $sec) {
            $sNum = $sIndex + 1;
            $sName = !empty($sec['section_name']) ? "Section $sNum ('" . trim($sec['section_name']) . "')" : "Section $sNum";
            $q_items = [];
            if (isset($sec['questions']) && is_array($sec['questions'])) {
                foreach ($sec['questions'] as $q) {
                    $total_questions++;
                    $q_title = trim($q['text'] ?? '');
                    if (mb_strlen($q_title) > 30) {
                        $q_title = mb_substr($q_title, 0, 30) . '...';
                    }
                    $q_raw_type = isset($q['type']) ? $q['type'] : 'text';
                    $type_detail = $q_raw_type;
                    if ($q_raw_type === 'optionset') {
                        $r_type = isset($q['render_type']) ? $q['render_type'] : 'dropdown';
                        $opt_set = !empty($q['option_set']) ? ", '" . $q['option_set'] . "'" : '';
                        $type_detail = "$r_type$opt_set";
                    } elseif ($q_raw_type === 'rating' || $q_raw_type === 'linear_scale') {
                        $opt_set = !empty($q['option_set']) ? ", '" . $q['option_set'] . "'" : '';
                        $type_detail = "$q_raw_type$opt_set";
                    } elseif ($q_raw_type === 'text' || $q_raw_type === 'textarea') {
                        $extras = [];
                        if (!empty($q['validation_type']) && $q['validation_type'] !== 'alphanumeric') {
                            $extras[] = $q['validation_type'];
                        }
                        if (!empty($q['max_length'])) {
                            $extras[] = "Max: " . $q['max_length'];
                        }
                        if (!empty($extras)) {
                            $type_detail .= " [" . implode(', ', $extras) . "]";
                        }
                    }
                    $q_items[] = "'$q_title' ($type_detail)";
                }
            }
            $structure_parts[] = "[$sName]: " . (!empty($q_items) ? implode(', ', $q_items) : '0 questions');
        }
    }

    $ops_summary = "";
    if (!empty($payload['builder_operations']) && is_array($payload['builder_operations'])) {
        $clean_ops = array_map(function($op) { return strip_tags(trim($op)); }, $payload['builder_operations']);
        $ops_summary = "Operations: [" . implode(' -> ', $clean_ops) . "]; ";
    }

    $desc_text = !empty($payload['description']) ? "Description added: '" . mb_strimwidth(trim($payload['description']), 0, 40, '...') . "'; " : "";
    $img_text = ($qr_image_path !== null) ? "QR Image added; " : "";

    $log_msg = "New Form Created [Form: " . $payload['title'] . " (ID: $form_id)]: " 
        . $ops_summary 
        . $desc_text 
        . $img_text 
        . "Total: " . count($payload['sections']) . " Sections, $total_questions Questions; "
        . implode('; ', $structure_parts);

    writeLog($log_msg, 'admin');

    echo json_encode([
        'success' => true,
        'message' => 'Form saved successfully.',
        'form_id' => $form_id
    ]);

} catch (PDOException $e) {
    // Rollback if any error occurs
    $pdo->rollBack();
    if (isset($qr_image_path) && $qr_image_path !== null) {
        $file_path = __DIR__ . '/../' . $qr_image_path;
        if (file_exists($file_path)) unlink($file_path);
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
