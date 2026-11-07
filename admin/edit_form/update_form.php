<?php
// admin/edit_form/update_form.php
require_once '../../includes/auth.php';
requireApiAdmin();
require_once '../../configuration/config.php';
require_once '../../trace_log.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$payload = null;
if (isset($_POST['form_data'])) {
    $payload = json_decode($_POST['form_data'], true);
} else {
    $inputJSON = file_get_contents('php://input');
    $payload = json_decode($inputJSON, true);
}

if (!$payload || !isset($payload['form_id']) || !isset($payload['title']) || !isset($payload['sections'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload received.']);
    exit;
}

$form_id = $payload['form_id'];

// Check for duplicate form title (case-insensitive)
$title_check_stmt = $pdo->prepare("SELECT COUNT(*) FROM forms WHERE LOWER(title) = LOWER(:title) AND id != :form_id");
$title_check_stmt->execute(['title' => trim($payload['title']), 'form_id' => $form_id]);
if ($title_check_stmt->fetchColumn() > 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "A form with the name '" . trim($payload['title']) . "' already exists. Please choose a different name."]);
    exit;
}

// Handle QR Image Upload
$qr_image_path = null;
$qr_uploaded = false;
if (isset($_FILES['qr_image']) && $_FILES['qr_image']['error'] === UPLOAD_ERR_OK) {
    $upload_dir = '../../uploads/qr_codes/';
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
            $qr_uploaded = true;
        }
    }
}



try {
    $pdo->beginTransaction();

    // Load Option Sets mapping for human-readable group names
    $options_map = [];
    $options_file = __DIR__ . '/../../options.json';
    if (file_exists($options_file)) {
        $opt_data = json_decode(file_get_contents($options_file), true);
        if (is_array($opt_data)) {
            foreach ($opt_data as $og) {
                if (isset($og['group_id']) && isset($og['group_name'])) {
                    $options_map[$og['group_id']] = $og['group_name'];
                    $options_map[$og['group_name']] = $og['group_name'];
                }
            }
        }
    }
    $format_optionset = function($val) use (&$options_map) {
        if (!$val) return 'None';
        return $options_map[$val] ?? $val;
    };

    $changes = [];
    $forked_q_ids = [];

    // Fetch existing form data to compare changes and handle QR cleanup
    $stmtOldForm = $pdo->prepare("SELECT title, description, qr_image_path FROM forms WHERE id = :form_id");
    $stmtOldForm->execute(['form_id' => $form_id]);
    $old_form_data = $stmtOldForm->fetch(PDO::FETCH_ASSOC);
    $old_qr_path = ($old_form_data && !empty($old_form_data['qr_image_path'])) ? __DIR__ . '/../../' . $old_form_data['qr_image_path'] : null;

    if ($old_form_data) {
        if (trim($old_form_data['title']) !== trim($payload['title'])) {
            $changes[] = "Form Title changed from '" . $old_form_data['title'] . "' to '" . trim($payload['title']) . "'";
        }
        $old_desc = trim((string)$old_form_data['description']);
        $new_desc = isset($payload['description']) ? trim((string)$payload['description']) : '';
        if ($old_desc !== $new_desc) {
            if ($old_desc === '') {
                $changes[] = "Form Description added: '$new_desc'";
            } elseif ($new_desc === '') {
                $changes[] = "Form Description removed (was '$old_desc')";
            } else {
                $changes[] = "Form Description changed from '$old_desc' to '$new_desc'";
            }
        }
    }

    // 1. Update Form Meta
    if ($qr_uploaded) {
        $changes[] = "Form QR Image replaced with new upload";
        $stmtForm = $pdo->prepare("UPDATE forms SET title = :title, description = :description, qr_image_path = :qr_image_path WHERE id = :form_id");
        $stmtForm->execute([
            'title' => $payload['title'],
            'description' => isset($payload['description']) ? $payload['description'] : '',
            'qr_image_path' => $qr_image_path,
            'form_id' => $form_id
        ]);
        if ($old_qr_path && file_exists($old_qr_path)) {
            unlink($old_qr_path);
        }
    } else if (isset($payload['remove_qr']) && $payload['remove_qr'] === true) {
        if ($old_form_data && !empty($old_form_data['qr_image_path'])) {
            $changes[] = "Form QR Image removed";
        }
        $stmtForm = $pdo->prepare("UPDATE forms SET title = :title, description = :description, qr_image_path = NULL WHERE id = :form_id");
        $stmtForm->execute([
            'title' => $payload['title'],
            'description' => isset($payload['description']) ? $payload['description'] : '',
            'form_id' => $form_id
        ]);
        if ($old_qr_path && file_exists($old_qr_path)) {
            unlink($old_qr_path);
        }
    } else {
        $stmtForm = $pdo->prepare("UPDATE forms SET title = :title, description = :description WHERE id = :form_id");
        $stmtForm->execute([
            'title' => $payload['title'],
            'description' => isset($payload['description']) ? $payload['description'] : '',
            'form_id' => $form_id
        ]);
    }

    // 2. Fetch existing questions to detect diffs and handle soft delete
    $stmtOldQ = $pdo->prepare("SELECT id, question, type, is_required, step_no, question_order, option_group_id, section_name, filter, active, validation_type, max_length FROM questions WHERE form_id = :form_id");
    $stmtOldQ->execute(['form_id' => $form_id]);
    $old_questions = [];
    while ($row = $stmtOldQ->fetch(PDO::FETCH_ASSOC)) {
        $old_questions[$row['id']] = $row;
    }
    $existing_ids = array_keys($old_questions);
    $payload_question_ids = [];

    // Track old section names for section name diffs
    $old_section_names = [];
    foreach ($old_questions as $oq) {
        if (!empty($oq['active']) && !empty($oq['step_no'])) {
            $st = (int)$oq['step_no'];
            if (!isset($old_section_names[$st]) && !empty($oq['section_name'])) {
                $old_section_names[$st] = trim($oq['section_name']);
            }
        }
    }

    foreach ($payload['sections'] as $sIndex => $section) {
        $step_no = $sIndex + 1;
        $new_sname = isset($section['section_name']) ? trim($section['section_name']) : '';
        $old_sname = $old_section_names[$step_no] ?? '';
        if (isset($old_section_names[$step_no]) && $old_sname !== $new_sname) {
            $from_lbl = $old_sname !== '' ? "'$old_sname'" : "(Untitled)";
            $to_lbl = $new_sname !== '' ? "'$new_sname'" : "(Untitled)";
            $changes[] = "Section $step_no Name changed from $from_lbl to $to_lbl";
        }
    }

    $stmtInsert = $pdo->prepare("INSERT INTO questions 
        (form_id, question, type, is_required, question_order, step_no, option_group_id, depends_on_question_id, depends_on_value, sub_section_name, section_name, filter, active, validation_type, max_length) 
        VALUES (:form_id, :question, :type, :is_required, :question_order, :step_no, :option_group_id, :depends_on_question_id, :depends_on_value, :sub_section_name, :section_name, :filter, :active, :validation_type, :max_length)");

    $stmtUpdate = $pdo->prepare("UPDATE questions SET 
        question = :question, type = :type, is_required = :is_required, 
        question_order = :question_order, step_no = :step_no, 
        option_group_id = :option_group_id, depends_on_question_id = :depends_on_question_id, 
        depends_on_value = :depends_on_value, sub_section_name = :sub_section_name, 
        section_name = :section_name, 
        filter = :filter, active = :active, validation_type = :validation_type, max_length = :max_length 
        WHERE id = :id AND form_id = :form_id");

    $ref_to_db_id = [];
    foreach ($old_questions as $oldId => $oq) {
        $ref_to_db_id[(string)$oldId] = (int)$oldId;
        $ref_to_db_id['qid_' . $oldId] = (int)$oldId;
    }

    foreach ($payload['sections'] as $sIndex => $section) {
        $step_no = $sIndex + 1;
        $section_name = isset($section['section_name']) && trim($section['section_name']) !== '' ? trim($section['section_name']) : null;
        $sec_label = $section_name ? "Section $step_no ('$section_name')" : "Section $step_no";
        
        if (isset($section['questions']) && is_array($section['questions'])) {
            foreach ($section['questions'] as $qIndex => $q) {
                $question_order = $qIndex + 1;
                
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

                $q_id = isset($q['question_id']) ? $q['question_id'] : null;
                $active = isset($q['active']) && $q['active'] ? 1 : 0;
                $is_required = !empty($q['required']) ? 1 : 0;
                $filter = !empty($q['is_filter']) ? 1 : 0;
                $new_title = trim($q['text'] ?? '');
                $client_uid = isset($q['client_uid']) ? trim($q['client_uid']) : null;
                $dep_ref = !empty($q['depends_on_ref']) ? trim($q['depends_on_ref']) : (!empty($q['depends_on_question_id']) ? trim($q['depends_on_question_id']) : null);
                $depends_on_value = isset($q['depends_on_value']) && trim($q['depends_on_value']) !== '' ? trim($q['depends_on_value']) : null;
                $sub_section_name = isset($q['sub_section_name']) && trim($q['sub_section_name']) !== '' ? trim($q['sub_section_name']) : null;

                $depends_on_question_id = null;
                if ($dep_ref) {
                    if (!isset($ref_to_db_id[$dep_ref])) {
                        throw new Exception("Invalid question dependency: Parent question does not exist or appears after this block.");
                    }
                    $depends_on_question_id = $ref_to_db_id[$dep_ref];
                    if (empty($depends_on_value)) {
                        throw new Exception("Conditional sub-section matching value cannot be empty.");
                    }
                }
                
                if ($q_id) {
                    $old_q = $old_questions[$q_id] ?? null;

                    if ($old_q && $old_q['active'] == 0) {
                        $payload_question_ids[] = $q_id;
                        continue; // Skip updates for already archived questions
                    }

                    if ($old_q) {
                        $old_title = trim($old_q['question']);
                        $q_diffs = [];

                        if ($old_title !== $new_title) {
                            $q_diffs[] = "Title changed from '$old_title' to '$new_title'";
                        }

                        if ($old_q['type'] !== $db_type) {
                            $q_diffs[] = "Type changed from '{$old_q['type']}' to '$db_type'";
                        }

                        if ((string)$old_q['option_group_id'] !== (string)$option_group_id) {
                            $old_opt_name = $format_optionset($old_q['option_group_id']);
                            $new_opt_name = $format_optionset($option_group_id);
                            $q_diffs[] = "Option Set changed from '$old_opt_name' to '$new_opt_name'";
                        }

                        $old_req = !empty($old_q['is_required']) ? 1 : 0;
                        if ($old_req !== $is_required) {
                            $q_diffs[] = "Required changed from " . ($old_req ? 'Yes' : 'No') . " to " . ($is_required ? 'Yes' : 'No');
                        }

                        $old_flt = !empty($old_q['filter']) ? 1 : 0;
                        if ($old_flt !== $filter) {
                            $q_diffs[] = "Filter changed from " . ($old_flt ? 'Yes' : 'No') . " to " . ($filter ? 'Yes' : 'No');
                        }

                        if ($db_type === 'text' || $db_type === 'textarea' || $old_q['type'] === 'text' || $old_q['type'] === 'textarea') {
                            if ($old_q['validation_type'] !== $validation_type) {
                                $q_diffs[] = "Validation Rule changed from '{$old_q['validation_type']}' to '$validation_type'";
                            }
                            if ((string)$old_q['max_length'] !== (string)$max_length) {
                                $old_len = $old_q['max_length'] ? (string)$old_q['max_length'] : 'Default';
                                $new_len = $max_length ? (string)$max_length : 'Default';
                                $q_diffs[] = "Max Length changed from '$old_len' to '$new_len'";
                            }
                        }

                        $old_act = !empty($old_q['active']) ? 1 : 0;
                        if ($old_act !== $active) {
                            $q_diffs[] = "Status changed from " . ($old_act ? 'Active' : 'Archived') . " to " . ($active ? 'Active' : 'Archived');
                        }

                        $old_step = (int)$old_q['step_no'];
                        if ($old_step !== $step_no) {
                            $q_diffs[] = "Moved from Section $old_step to Section $step_no";
                        }

                        if (!empty($q_diffs)) {
                            $changes[] = "[$sec_label] Question '$old_title': " . implode(', ', $q_diffs);
                        }
                    }

                    if ($old_q && (
                        $old_q['type'] !== $db_type || 
                        $old_q['option_group_id'] != $option_group_id || 
                        trim($old_q['question']) !== trim($q['text']) ||
                        $old_q['validation_type'] !== $validation_type ||
                        $old_q['max_length'] != $max_length
                    )) {
                        // Title, Optionset, Type, Validation, or Length has changed. We fork this into a new question!
                        // The old question will automatically be archived by the cleanup script because its ID is not added to $payload_question_ids
                        $forked_q_ids[] = $q_id;

                        $stmtInsert->execute([
                            'form_id' => $form_id,
                            'question' => $q['text'],
                            'type' => $db_type,
                            'is_required' => $is_required,
                            'question_order' => $question_order,
                            'step_no' => $step_no,
                            'option_group_id' => $option_group_id,
                            'depends_on_question_id' => $depends_on_question_id,
                            'depends_on_value' => $depends_on_value,
                            'sub_section_name' => $sub_section_name,
                            'section_name' => $section_name,
                            'filter' => $filter,
                            'active' => $active,
                            'validation_type' => $validation_type,
                            'max_length' => $max_length
                        ]);
                        $fork_id = (int)$pdo->lastInsertId();
                        $payload_question_ids[] = $fork_id;
                        if ($client_uid) $ref_to_db_id[$client_uid] = $fork_id;
                        $ref_to_db_id[(string)$fork_id] = $fork_id;
                    } else {
                        // Normal update
                        $payload_question_ids[] = $q_id;
                        $stmtUpdate->execute([
                            'question' => $q['text'],
                            'type' => $db_type,
                            'is_required' => $is_required,
                            'question_order' => $question_order,
                            'step_no' => $step_no,
                            'option_group_id' => $option_group_id,
                            'depends_on_question_id' => $depends_on_question_id,
                            'depends_on_value' => $depends_on_value,
                            'sub_section_name' => $sub_section_name,
                            'section_name' => $section_name,
                            'filter' => $filter,
                            'active' => $active,
                            'validation_type' => $validation_type,
                            'max_length' => $max_length,
                            'id' => $q_id,
                            'form_id' => $form_id
                        ]);
                        if ($client_uid) $ref_to_db_id[$client_uid] = (int)$q_id;
                        $ref_to_db_id[(string)$q_id] = (int)$q_id;
                    }
                } else {
                    // New Question
                    $desc_parts = [];
                    $type_lbl = $db_type;
                    if ($option_group_id) {
                        $type_lbl .= " [Set: {$format_optionset($option_group_id)}]";
                    }
                    $desc_parts[] = "Type: $type_lbl";
                    $desc_parts[] = "Required: " . ($is_required ? 'Yes' : 'No');
                    if ($filter) {
                        $desc_parts[] = "Filter: Yes";
                    }
                    if ($db_type === 'text' || $db_type === 'textarea') {
                        $desc_parts[] = "Validation: $validation_type";
                        if ($max_length) {
                            $desc_parts[] = "MaxLen: $max_length";
                        }
                    }
                    $changes[] = "[$sec_label] Added new Question '$new_title' (" . implode(', ', $desc_parts) . ")";

                    $stmtInsert->execute([
                        'form_id' => $form_id,
                        'question' => $q['text'],
                        'type' => $db_type,
                        'is_required' => $is_required,
                        'question_order' => $question_order,
                        'step_no' => $step_no,
                        'option_group_id' => $option_group_id,
                        'depends_on_question_id' => $depends_on_question_id,
                        'depends_on_value' => $depends_on_value,
                        'sub_section_name' => $sub_section_name,
                        'section_name' => $section_name,
                        'filter' => $filter,
                        'active' => $active,
                        'validation_type' => $validation_type,
                        'max_length' => $max_length
                    ]);
                    $new_id = (int)$pdo->lastInsertId();
                    $payload_question_ids[] = $new_id;
                    if ($client_uid) $ref_to_db_id[$client_uid] = $new_id;
                    $ref_to_db_id[(string)$new_id] = $new_id;
                }
            }
        }
    }

    // Soft delete any questions not in the payload
    $missing_ids = array_diff($existing_ids, $payload_question_ids);
    if (!empty($missing_ids)) {
        foreach ($missing_ids as $mid) {
            if (in_array($mid, $forked_q_ids)) {
                continue; // Forked questions were already logged as modified
            }
            if (isset($old_questions[$mid])) {
                $old_q = $old_questions[$mid];
                if ((int)$old_q['active'] === 1) {
                    $m_sec_no = $old_q['step_no'] ? "Section " . $old_q['step_no'] : "Unknown Section";
                    $m_sec_label = !empty($old_q['section_name']) ? "$m_sec_no ('{$old_q['section_name']}')" : $m_sec_no;
                    $changes[] = "[$m_sec_label] Archived Question '{$old_q['question']}'";
                }
            }
        }

        $placeholders = str_repeat('?,', count($missing_ids) - 1) . '?';
        $stmtSoftDelete = $pdo->prepare("UPDATE questions SET active = 0 WHERE form_id = ? AND id IN ($placeholders)");
        $params = array_merge([$form_id], $missing_ids);
        $stmtSoftDelete->execute($params);
    }

    $pdo->commit();

    if (!empty($changes)) {
        writeLog("Form Updated with Changes [Form: " . $payload['title'] . " (ID: $form_id)]: " . implode('; ', $changes), 'admin');
    } else {
        writeLog("Form Updated [Form: " . $payload['title'] . " (ID: $form_id)]: No field changes detected", 'admin');
    }
    echo json_encode(['success' => true, 'message' => 'Form updated successfully.']);

} catch (PDOException $e) {
    $pdo->rollBack();
    if (isset($qr_uploaded) && $qr_uploaded && isset($qr_image_path) && $qr_image_path !== null) {
        $file_path = __DIR__ . '/../../' . $qr_image_path;
        if (file_exists($file_path)) unlink($file_path);
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
