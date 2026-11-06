
<?php
// admin/edit_form/delete_question.php
require_once '../../includes/auth.php';
requireApiAdmin();
require_once '../../configuration/config.php';
require_once '../../trace_log.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$inputJSON = file_get_contents('php://input');
$payload = json_decode($inputJSON, true);

if (!isset($payload['question_id']) || !isset($payload['form_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid parameters.']);
    exit;
}

$question_id = intval($payload['question_id']);
$form_id = intval($payload['form_id']);

try {
    $pdo->beginTransaction();

    // 1. Delete the question itself
    $stmt2 = $pdo->prepare("DELETE FROM questions WHERE id = :qid AND form_id = :fid");
    $stmt2->execute(['qid' => $question_id, 'fid' => $form_id]);

    $deleted = $stmt2->rowCount();

    $pdo->commit();

    if ($deleted > 0) {
        writeLog("Permanently Deleted Question (Question ID: $question_id) from Form $form_id", 'admin');
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Question not found or already deleted.']);
    }
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    error_log("Delete Question Error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error.']);
}
?>
