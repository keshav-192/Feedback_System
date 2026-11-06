<?php
// admin/change_password.php
require_once '../includes/auth.php';
requireApiAdmin();
require_once '../configuration/config.php';
require_once '../trace_log.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$current_password = trim($data['current_password'] ?? '');
$new_password = trim($data['new_password'] ?? '');
$confirm_password = trim($data['confirm_password'] ?? '');

if (empty($current_password) || empty($new_password) || empty($confirm_password)) {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit;
}

if ($new_password !== $confirm_password) {
    echo json_encode(['success' => false, 'message' => 'New password and confirm password do not match.']);
    exit;
}

if ($current_password === $new_password) {
    echo json_encode(['success' => false, 'message' => 'New password cannot be the same as the current password.']);
    exit;
}

// Password validation: capital, small, number, special character
if (!preg_match('/[A-Z]/', $new_password) || 
    !preg_match('/[a-z]/', $new_password) || 
    !preg_match('/[0-9]/', $new_password) || 
    !preg_match('/[\W_]/', $new_password)) {
    echo json_encode(['success' => false, 'message' => 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.']);
    exit;
}

// Fetch current admin's password hash
try {
    $stmt = $pdo->prepare("SELECT password_hash FROM admins WHERE id = :id");
    $stmt->execute(['id' => $_SESSION['admin_id']]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($current_password, $admin['password_hash'])) {
        echo json_encode(['success' => false, 'message' => 'Current password is incorrect.']);
        exit;
    }

    // Hash the new password and update
    $new_hash = password_hash($new_password, PASSWORD_DEFAULT);
    $updateStmt = $pdo->prepare("UPDATE admins SET password_hash = :hash WHERE id = :id");
    $updateStmt->execute(['hash' => $new_hash, 'id' => $_SESSION['admin_id']]);

    writeLog("Admin Password Changed (ID: " . $_SESSION['admin_id'] . ")", 'admin');
    echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
