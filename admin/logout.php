<?php
// admin/logout.php
session_start();
require_once '../trace_log.php';
$admin_emp_id = $_SESSION['admin_emp_id'] ?? 'Unknown';
writeLog("Admin Logout (Emp ID: $admin_emp_id)", 'admin');
session_unset();
session_destroy();
header("Location: login.php");
exit;
?>
