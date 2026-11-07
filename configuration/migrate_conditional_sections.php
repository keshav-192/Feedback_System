<?php
/**
 * Database Migration: Conditional Sub-Sections Support
 * Adds depends_on_question_id, depends_on_value, and sub_section_name to `questions` table.
 */
require_once __DIR__ . '/config.php';

try {
    echo "Running migration: Conditional Sub-Sections...\n";

    // Fetch existing columns in questions table
    $stmt = $pdo->query("SHOW COLUMNS FROM `questions`");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('depends_on_question_id', $columns)) {
        $pdo->exec("ALTER TABLE `questions` ADD COLUMN `depends_on_question_id` INT(11) NULL DEFAULT NULL AFTER `option_group_id`");
        echo "- Added column: depends_on_question_id\n";
    } else {
        echo "- Column already exists: depends_on_question_id\n";
    }

    if (!in_array('depends_on_value', $columns)) {
        $pdo->exec("ALTER TABLE `questions` ADD COLUMN `depends_on_value` VARCHAR(255) NULL DEFAULT NULL AFTER `depends_on_question_id`");
        echo "- Added column: depends_on_value\n";
    } else {
        echo "- Column already exists: depends_on_value\n";
    }

    if (!in_array('sub_section_name', $columns)) {
        $pdo->exec("ALTER TABLE `questions` ADD COLUMN `sub_section_name` VARCHAR(150) NULL DEFAULT NULL AFTER `depends_on_value`");
        echo "- Added column: sub_section_name\n";
    } else {
        echo "- Column already exists: sub_section_name\n";
    }

    // Check index
    $indexStmt = $pdo->query("SHOW INDEX FROM `questions` WHERE Key_name = 'idx_depends_on_question'");
    if ($indexStmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `questions` ADD INDEX `idx_depends_on_question` (`depends_on_question_id`)");
        echo "- Added index: idx_depends_on_question\n";
    } else {
        echo "- Index already exists: idx_depends_on_question\n";
    }

    echo "Migration completed successfully!\n";
} catch (Exception $e) {
    echo "Migration Error: " . $e->getMessage() . "\n";
    exit(1);
}

