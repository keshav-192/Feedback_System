<?php
// admin/edit_form/delete_form.php
require_once '../../includes/auth.php';
requireApiAdmin();
require_once '../../configuration/config.php';
require_once '../../trace_log.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$inputJSON = file_get_contents('php://input');
$payload = json_decode($inputJSON, true);

if (!$payload || !isset($payload['form_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload received.']);
    exit;
}

$form_id = $payload['form_id'];

try {
    $pdo->beginTransaction();

    // Fetch the QR image path to delete the physical file
    $stmtImage = $pdo->prepare("SELECT qr_image_path FROM forms WHERE id = :form_id");
    $stmtImage->execute(['form_id' => $form_id]);
    $form_data = $stmtImage->fetch();
    
    if ($form_data && !empty($form_data['qr_image_path'])) {
        $file_path = __DIR__ . '/../../' . $form_data['qr_image_path'];
        if (file_exists($file_path)) {
            unlink($file_path);
        }
    }

    // Delete responses associated with this form first to avoid foreign key constraints
    $pdo->prepare("DELETE FROM responses WHERE form_id = :form_id")->execute(['form_id' => $form_id]);

    // Next delete questions associated with this form
    $pdo->prepare("DELETE FROM questions WHERE form_id = :form_id")->execute(['form_id' => $form_id]);
    
    // Then delete the form itself
    $stmt = $pdo->prepare("DELETE FROM forms WHERE id = :form_id");
    $stmt->execute(['form_id' => $form_id]);

    $pdo->commit();
    writeLog("Form Deleted (Form ID: $form_id)", 'admin');
    echo json_encode(['success' => true, 'message' => 'Form deleted successfully.']);

} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
