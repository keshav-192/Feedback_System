<?php
// trace_log.php - System Logger for Stakeholder Feedback Portal

function writeLog($message, $type = 'user')
{
    date_default_timezone_set('Asia/Kolkata');
    $date = date("Y-m-d");
    
    // Ensure both user and admin log directories exist
    $baseLogDir = __DIR__ . "/logs";
    foreach (['user', 'admin'] as $dirType) {
        $dir = $baseLogDir . "/" . $dirType;
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
            file_put_contents($dir . "/.htaccess", "Options -Indexes\nDeny from all");
        }
    }

    if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
        @session_start();
    }

    $time = date("Y-m-d H:i:s");
    $page = basename($_SERVER['PHP_SELF']);
    $url = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : 'UNKNOWN';
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'UNKNOWN';
    $location = "Stakeholder Feedback Server";

    // Auto-detect admin context from URL (including analytics)
    if (strpos($url, '/admin/') !== false || strpos($url, '/analytics/') !== false) {
        $type = 'admin';
    }

    $emp_id_suffix = "";
    if (isset($_SESSION['admin_emp_id'])) {
        $emp_id_suffix = " [Emp ID: " . $_SESSION['admin_emp_id'] . "]";
    }
    
    // Set the specific log directory based on type
    $logDir = $baseLogDir . "/" . $type;
    $logFile = $logDir . "/system_${date}.log";

    $logMessage = "[INFO] [$time] [$page] [$location] [$ip] [$url] $message$emp_id_suffix" . PHP_EOL;

    file_put_contents($logFile, $logMessage, FILE_APPEND);
}
?>
