<?php
// admin/edit_form/fetch_form_details.php
require_once '../../includes/auth.php';
requireApiAdmin();
require_once '../../configuration/config.php';

header('Content-Type: application/json');

$form_id = $_GET['id'] ?? null;

if (!$form_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No form ID provided.']);
    exit;
}

try {
    // 1. Get Form Details
    $stmtForm = $pdo->prepare("SELECT id AS form_id, title, description, created_at FROM forms WHERE id = :id");
    $stmtForm->execute(['id' => $form_id]);
    $form = $stmtForm->fetch(PDO::FETCH_ASSOC);

    if (!$form) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Form not found.']);
        exit;
    }

    // 2. Get Questions
    $stmtQ = $pdo->prepare("SELECT * FROM questions WHERE form_id = :id ORDER BY step_no ASC, question_order ASC");
    $stmtQ->execute(['id' => $form_id]);
    $questions = $stmtQ->fetchAll(PDO::FETCH_ASSOC);

    // Group questions by step_no (sections)
    $sections = [];
    foreach ($questions as $q) {
        $step = (int)$q['step_no'];
        if (!isset($sections[$step])) {
            $sections[$step] = [
                'section_num' => $step,
                'title' => 'Section ' . $step,
                'section_name' => isset($q['section_name']) ? $q['section_name'] : null,
                'questions' => []
            ];
        }
        
        // Format question payload similarly to how frontend generates it
        $q_data = [
            'question_id' => isset($q['id']) ? $q['id'] : null,
            'text' => $q['question'],
            'type' => $q['type'],
            'required' => (bool)$q['is_required'],
            'is_filter' => (bool)$q['filter'],
            'active' => (bool)$q['active'],
            'validation_type' => isset($q['validation_type']) ? $q['validation_type'] : 'alphanumeric',
            'max_length' => isset($q['max_length']) ? $q['max_length'] : null,
            'depends_on_question_id' => !empty($q['depends_on_question_id']) ? (int)$q['depends_on_question_id'] : null,
            'depends_on_value' => isset($q['depends_on_value']) ? $q['depends_on_value'] : null,
            'sub_section_name' => isset($q['sub_section_name']) ? $q['sub_section_name'] : null
        ];
        
        if ($q['type'] === 'select' || $q['type'] === 'checkbox' || $q['type'] === 'radio') {
            $q_data['type'] = 'optionset';
            if ($q['type'] === 'checkbox') {
                $q_data['render_type'] = 'checkbox';
            } elseif ($q['type'] === 'radio') {
                $q_data['render_type'] = 'radio';
            } else {
                $q_data['render_type'] = 'dropdown';
            }
            $q_data['option_set'] = $q['option_group_id'];
        } else if ($q['type'] === 'rating') {
            $q_data['type'] = 'rating';
            $q_data['option_set'] = $q['option_group_id'];
        } else if ($q['type'] === 'linear_scale' || $q['type'] === 'radio_grid' || $q['type'] === 'checkbox_grid' || $q['type'] === 'slider_grid') {
            $q_data['type'] = 'linear_scale';
            $q_data['option_set'] = $q['option_group_id'];
            if ($q['type'] === 'checkbox_grid') {
                $q_data['render_type'] = 'checkbox_grid';
            } elseif ($q['type'] === 'slider_grid') {
                $q_data['render_type'] = 'slider_grid';
            } else {
                $q_data['render_type'] = 'radio_grid';
            }
        }

        $sections[$step]['questions'][] = $q_data;
    }

    // Post-process sections: remove empty ghost sections (caused by archived questions) and re-number
    $valid_sections = [];
    $archived_questions = [];
    
    foreach ($sections as $step => $section) {
        $has_active = false;
        foreach ($section['questions'] as $q) {
            if ($q['active']) {
                $has_active = true;
                break;
            }
        }
        
        if ($has_active) {
            $valid_sections[$step] = $section;
        } else {
            // Section only contains archived questions. We don't want a ghost section.
            foreach ($section['questions'] as $q) {
                $archived_questions[] = $q;
            }
        }
    }
    
    // Append orphaned archived questions to the first valid section
    if (!empty($archived_questions)) {
        if (empty($valid_sections)) {
            // Edge case: all questions in the entire form are archived
            $valid_sections[1] = [
                'section_num' => 1,
                'title' => 'Section 1',
                'section_name' => '',
                'questions' => []
            ];
        }
        $first_step = array_key_first($valid_sections);
        $valid_sections[$first_step]['questions'] = array_merge($valid_sections[$first_step]['questions'], $archived_questions);
    }
    
    // Re-index sections array to be 0-indexed and sequential
    $final_sections = [];
    $new_step = 1;
    foreach ($valid_sections as $sec) {
        $sec['section_num'] = $new_step;
        $sec['title'] = 'Section ' . $new_step;
        $final_sections[] = $sec;
        $new_step++;
    }

    $form['sections'] = $final_sections;
    unset($form['questions']); // Don't send flat list

    echo json_encode(['success' => true, 'form' => $form]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
