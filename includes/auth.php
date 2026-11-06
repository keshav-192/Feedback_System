<?php
// includes/auth.php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../configuration/config.php';

/**
 * Require admin authentication for web pages.
 * Redirects to login page if not authenticated.
 */
function requireAdmin() {
    if (!isset($_SESSION['admin_id'])) {
        header("Location: " . BASE_URL . "admin/login.php");
        exit;
    }
    
    // Prevent browser caching of authenticated pages
    header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
    header("Cache-Control: post-check=0, pre-check=0", false);
    header("Pragma: no-cache");
}

/*
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
*/

/**
 * Require admin authentication for API endpoints.
 * Returns 401 Unauthorized JSON response if not authenticated.
 */
function requireApiAdmin() {
    if (!isset($_SESSION['admin_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
    
    /*
    // CSRF Protection
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $headers = apache_request_headers();
        $token = isset($headers['X-CSRF-Token']) ? $headers['X-CSRF-Token'] : (isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : '');
        if (empty($token) || !hash_equals($_SESSION['csrf_token'], $token)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'CSRF token validation failed.']);
            exit;
        }
    }
    */
}
