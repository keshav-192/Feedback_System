<?php
// admin/global_options/save_options.php
require_once '../../includes/auth.php';
requireApiAdmin();
require_once '../../trace_log.php';
header('Content-Type: application/json');

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || empty($data['group_name'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data provided.']);
    exit;
}

$optionsFile = __DIR__ . '/../../options.json';

if (!file_exists($optionsFile)) {
    echo json_encode(['success' => false, 'message' => 'options.json not found.']);
    exit;
}

$currentJson = file_get_contents($optionsFile);
$optionsArray = json_decode($currentJson, true);

if (!is_array($optionsArray)) {
    echo json_encode(['success' => false, 'message' => 'Could not parse options.json.']);
    exit;
}

// Construct new option object
$newOptionSet = [
    'group_name' => trim($data['group_name'])
];

if (!empty($data['parent_group'])) {
    $newOptionSet['parent_group'] = trim($data['parent_group']);
}

if (!empty($data['options']) && is_array($data['options'])) {
    $newOptionSet['options'] = [];
    foreach ($data['options'] as $choice) {
        if (!empty($choice['label'])) {
            $weightVal = isset($choice['weight']) && $choice['weight'] !== '' ? (int)$choice['weight'] : 1;
            if ($weightVal < 1) {
                $weightVal = 1;
            }
            
            $optObj = [
                'label' => trim($choice['label']),
                'weight' => $weightVal
            ];

            if (isset($choice['parents']) && is_array($choice['parents'])) {
                $cleanParents = array_values(array_filter(array_map('trim', $choice['parents'])));
                if (!empty($cleanParents)) {
                    $optObj['parents'] = $cleanParents;
                }
            }

            $newOptionSet['options'][] = $optObj;
        }
    }
} else {
    // If no choices, default to TEXTAREA type as per existing structure
    $newOptionSet['type'] = 'TEXTAREA';
}

$isUpdate = false;
$oldOptions = [];
if (!empty($data['group_id'])) {
    // Update existing
    $newOptionSet['group_id'] = $data['group_id'];
    foreach ($optionsArray as $key => $opt) {
        if ($opt['group_id'] === $data['group_id']) {
            // CRITICAL: Preserve the original group_name to prevent breaking existing forms analytics
            $newOptionSet['group_name'] = $opt['group_name'];
            $oldOptions = isset($opt['options']) && is_array($opt['options']) ? $opt['options'] : [];
            if (isset($data['parent_group'])) {
                if (trim($data['parent_group']) !== '') {
                    $newOptionSet['parent_group'] = trim($data['parent_group']);
                } else {
                    unset($newOptionSet['parent_group']);
                }
            } elseif (isset($opt['parent_group'])) {
                $newOptionSet['parent_group'] = $opt['parent_group'];
            }
            $optionsArray[$key] = $newOptionSet;
            $isUpdate = true;
            break;
        }
    }
    if (!$isUpdate) {
        echo json_encode(['success' => false, 'message' => 'Option set not found for updating.']);
        exit;
    }
} else {
    // Check for duplicate name for new option sets
    foreach ($optionsArray as $opt) {
        if (isset($opt['group_name']) && strcasecmp(trim($opt['group_name']), $newOptionSet['group_name']) === 0) {
            echo json_encode(['success' => false, 'message' => 'An Option Set with this exact name already exists. Please choose a different name.']);
            exit;
        }
    }
    
    // Generate new group_id (e.g., opt_grp_019)
    $maxIdNum = 0;
    foreach ($optionsArray as $opt) {
        if (preg_match('/^opt_grp_(\d+)$/', $opt['group_id'], $matches)) {
            $num = (int)$matches[1];
            if ($num > $maxIdNum) {
                $maxIdNum = $num;
            }
        }
    }
    
    $newIdNum = $maxIdNum + 1;
    $newGroupId = 'opt_grp_' . str_pad($newIdNum, 3, '0', STR_PAD_LEFT);
    $newOptionSet['group_id'] = $newGroupId;
    
    // Append
    $optionsArray[] = $newOptionSet;
}

$jsonString = json_encode($optionsArray, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

if (file_put_contents($optionsFile, $jsonString) !== false) {
    $groupName = isset($newOptionSet['group_name']) ? $newOptionSet['group_name'] : 'Unknown';
    if ($isUpdate) {
        $oldLabels = array_column($oldOptions, 'label');
        $addedChoices = [];
        if (!empty($newOptionSet['options'])) {
            foreach ($newOptionSet['options'] as $choice) {
                if (!in_array($choice['label'], $oldLabels)) {
                    $addedChoices[] = "'" . $choice['label'] . "' (Weight: " . $choice['weight'] . ")";
                }
            }
        }
        $addedDetail = !empty($addedChoices) ? "Added Choices: [" . implode(', ', $addedChoices) . "]" : "Saved with no new choices";
        $totalChoices = !empty($newOptionSet['options']) ? count($newOptionSet['options']) : 0;
        writeLog("Global Options Updated [Name: '$groupName', Group ID: " . $newOptionSet['group_id'] . "]: $addedDetail; Total Choices: $totalChoices", 'admin');
    } else {
        $choiceList = [];
        if (!empty($newOptionSet['options'])) {
            foreach ($newOptionSet['options'] as $choice) {
                $choiceList[] = "'" . $choice['label'] . "' (Weight: " . $choice['weight'] . ")";
            }
        }
        $choicesDetail = !empty($choiceList) ? "Choices: [" . implode(', ', $choiceList) . "]" : "No choices";
        $totalChoices = count($choiceList);
        writeLog("Global Options Created [Name: '$groupName', Group ID: " . $newOptionSet['group_id'] . "]: $choicesDetail; Total Choices: $totalChoices", 'admin');
    }
    echo json_encode([
        'success' => true, 
        'message' => 'Option set added successfully.',
        'new_option' => $newOptionSet
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to write to options.json.']);
}
