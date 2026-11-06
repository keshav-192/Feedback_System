<?php
// admin/edit_form/fetch_forms.php
require_once '../../includes/auth.php';
requireApiAdmin();
require_once '../../configuration/config.php';

header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT id AS form_id, title, description, qr_image_path, created_at FROM forms ORDER BY id ASC");
    $forms = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['success' => true, 'forms' => $forms]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
