<?php
require_once '../trace_log.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if ($data && isset($data['form_id'])) {
        $form_id = intval($data['form_id']);
        $duration = isset($data['duration_sec']) ? intval($data['duration_sec']) . 's' : 'unknown';
        $journey = isset($data['journey']) && is_array($data['journey'])
            ? implode(' -> ', array_map('strip_tags', $data['journey']))
            : 'Opened Form';

        writeLog("User Session Abandoned [Form ID: $form_id, Duration: $duration]: $journey -> Left Form");
        echo json_encode(['success' => true]);
        exit;
    }
}
echo json_encode(['success' => false]);
