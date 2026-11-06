<?php
// admin/log_admin_event.php
require_once '../includes/auth.php';
requireApiAdmin();
require_once '../trace_log.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$inputJSON = file_get_contents('php://input');
$payload = json_decode($inputJSON, true);

if ($payload && isset($payload['action'])) {
    $action = strip_tags(trim($payload['action']));
    $form_title = isset($payload['form_title']) ? strip_tags(trim($payload['form_title'])) : '';
    
    $logMsg = "Form Builder Action: " . $action;
    if ($form_title !== '') {
        $logMsg .= " [Form: $form_title]";
    }
    
    writeLog($logMsg, 'admin');
    echo json_encode(['success' => true]);
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid payload.']);
}
?>
