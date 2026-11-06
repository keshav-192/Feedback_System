<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'iqac');

// Define the Base URL of the application
define('BASE_URL', '/Stakeholder_Feedback/');


try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    require_once __DIR__ . '/../trace_log.php';
    writeLog("Critical Error: Database connection failed - " . $e->getMessage());
    die("Database connection failed: " . $e->getMessage());
}