<?php
// admin/check_form_title.php
require_once '../includes/auth.php';
requireApiAdmin();
require_once '../configuration/config.php';

header('Content-Type: application/json');

$title = isset($_GET['title']) ? trim($_GET['title']) : '';
$exclude_id = isset($_GET['exclude_id']) ? intval($_GET['exclude_id']) : 0;

if ($title === '') {
    echo json_encode(['exists' => false]);
    exit;
}

try {
    if ($exclude_id > 0) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM forms WHERE LOWER(title) = LOWER(:title) AND id != :exclude_id");
        $stmt->execute(['title' => $title, 'exclude_id' => $exclude_id]);
    } else {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM forms WHERE LOWER(title) = LOWER(:title)");
        $stmt->execute(['title' => $title]);
    }
    
    $count = $stmt->fetchColumn();
    echo json_encode(['exists' => ($count > 0)]);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Database error']);
}
?>
