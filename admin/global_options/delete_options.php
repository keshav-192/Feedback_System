<?php
// admin/global_options/delete_options.php
require_once '../../includes/auth.php';
requireApiAdmin();
require_once '../../trace_log.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || empty($data['group_id'])) {
    echo json_encode(['success' => false, 'message' => 'No group ID provided.']);
    exit;
}

$groupId = $data['group_id'];
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

$found = false;
$newOptionsArray = [];
$deletedGroupName = '';

require_once '../../configuration/config.php';

foreach ($optionsArray as $opt) {
    if (isset($opt['group_id']) && $opt['group_id'] === $groupId) {
        $found = true;
        $deletedGroupName = isset($opt['group_name']) ? $opt['group_name'] : 'Unknown';
        
        // CHECK USAGE BEFORE DELETION
        if (!isset($_GET['force']) || $_GET['force'] !== '1') {
            $checkStmt = $pdo->prepare("SELECT COUNT(DISTINCT form_id) as form_count, COUNT(*) as q_count FROM questions WHERE option_group_id = :group_name AND active = 1");
            $checkStmt->execute(['group_name' => $deletedGroupName]);
            $usage = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($usage && $usage['q_count'] > 0) {
                echo json_encode([
                    'success' => false, 
                    'in_use' => true,
                    'form_count' => $usage['form_count'],
                    'q_count' => $usage['q_count'],
                    'message' => "This option set is currently used in {$usage['q_count']} question(s) across {$usage['form_count']} active form(s). Are you sure you want to delete it?"
                ]);
                exit;
            }
        }
        
        // Skip this item so it's effectively deleted
        continue;
    }
    $newOptionsArray[] = $opt;
}

if (!$found) {
    echo json_encode(['success' => false, 'message' => 'Option set not found.']);
    exit;
}

$jsonString = json_encode($newOptionsArray, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

if (file_put_contents($optionsFile, $jsonString) !== false) {
    if (isset($_GET['force']) && $_GET['force'] === '1') {
        $checkStmt = $pdo->prepare("SELECT COUNT(DISTINCT form_id) as form_count, COUNT(*) as q_count FROM questions WHERE option_group_id = :group_name AND active = 1");
        $checkStmt->execute(['group_name' => $deletedGroupName]);
        $usage = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $qCount = $usage ? (int)$usage['q_count'] : 0;
        $formCount = $usage ? (int)$usage['form_count'] : 0;
        writeLog("Global Options Force Deleted [Name: '$deletedGroupName', Group ID: $groupId]: Used in $qCount question(s) across $formCount active form(s)", 'admin');
    } else {
        writeLog("Global Options Deleted [Name: '$deletedGroupName', Group ID: $groupId]", 'admin');
    }
    echo json_encode(['success' => true, 'message' => 'Option set deleted successfully.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to write to options.json.']);
}
