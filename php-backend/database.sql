-- =======================================================
-- مخطط قاعدة بيانات نظام إدارة وتوزيع مقاعد الأقسام (MySQL / MariaDB)
-- متوافق مع: cPanel, phpMyAdmin, XAMPP, WampServer, InfinityFree
-- الترميز: utf8mb4_unicode_ci للدعم الكامل للغة العربية
-- =======================================================

CREATE DATABASE IF NOT EXISTS `school_map` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `school_map`;

-- 1. جدول المستخدمين (المدير، الحراس العامون، الأساتذة)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `email` VARCHAR(128) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(128) NOT NULL,
  `role` ENUM('admin', 'director', 'teacher') NOT NULL DEFAULT 'teacher',
  `academic_year` VARCHAR(32) NOT NULL DEFAULT '2026/2027',
  `status` ENUM('active', 'pending', 'rejected') NOT NULL DEFAULT 'pending',
  `subject` VARCHAR(64) DEFAULT 'الرياضيات',
  `email_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. إعدادات المؤسسة والسنة الدراسية
CREATE TABLE IF NOT EXISTS `app_settings` (
  `key_name` VARCHAR(64) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. جدول الأقسام والفصول الدراسية
CREATE TABLE IF NOT EXISTS `sections` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `level` VARCHAR(64) NOT NULL,
  `class_number` VARCHAR(32) NOT NULL,
  `teacher` VARCHAR(128) DEFAULT '',
  `assigned_teacher_id` VARCHAR(64) DEFAULT NULL,
  `academic_year` VARCHAR(32) NOT NULL DEFAULT '2026/2027',
  `roster_json` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sec_teacher` (`assigned_teacher_id`),
  INDEX `idx_sec_year` (`academic_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. جدول المقاعد والتوزيع الصفي
CREATE TABLE IF NOT EXISTS `seats` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `section_id` VARCHAR(64) NOT NULL,
  `seat_num` INT NOT NULL,
  `student_name` VARCHAR(128) DEFAULT '',
  `student_number` VARCHAR(32) DEFAULT '',
  `massar_number` VARCHAR(64) DEFAULT '',
  `roster_id` VARCHAR(64) DEFAULT NULL,
  `status_color` VARCHAR(32) DEFAULT 'default',
  `attendance` ENUM('present', 'absent', 'late') DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_sec_seat` (`section_id`, `seat_num`),
  INDEX `idx_seat_student` (`student_name`),
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. جدول تخصيص المقاعد لكل أستاذ (Teacher Seat Overrides)
CREATE TABLE IF NOT EXISTS `teacher_seat_overrides` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `teacher_id` VARCHAR(64) NOT NULL,
  `section_id` VARCHAR(64) NOT NULL,
  `seat_num` INT NOT NULL,
  `student_name` VARCHAR(128) DEFAULT '',
  `student_number` VARCHAR(32) DEFAULT '',
  `massar_number` VARCHAR(64) DEFAULT '',
  `roster_id` VARCHAR(64) DEFAULT NULL,
  `status_color` VARCHAR(32) DEFAULT 'default',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_teacher_sec_seat` (`teacher_id`, `section_id`, `seat_num`),
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. أرشيف الغياب اليومي والسجلات
CREATE TABLE IF NOT EXISTS `attendance_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `section_id` VARCHAR(64) NOT NULL,
  `seat_num` INT DEFAULT 0,
  `student_name` VARCHAR(128) NOT NULL,
  `student_number` VARCHAR(32) DEFAULT '',
  `status` ENUM('absent', 'late') NOT NULL DEFAULT 'absent',
  `recorded_date` DATE NOT NULL,
  `session_period` VARCHAR(64) DEFAULT '1 ساعة',
  `teacher_name` VARCHAR(128) DEFAULT '',
  `teacher_subject` VARCHAR(64) DEFAULT '',
  `justified` ENUM('unjustified', 'justified') DEFAULT 'unjustified',
  `justification_reason` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `absence_mode` VARCHAR(32) DEFAULT 'hours',
  `duration_hours` INT DEFAULT 1,
  `duration_days` INT DEFAULT 0,
  `duration_label` VARCHAR(64) DEFAULT '1 ساعة',
  `created_by` VARCHAR(64) DEFAULT '',
  `removed_by` VARCHAR(64) DEFAULT '',
  `removed_at` VARCHAR(64) DEFAULT '',
  `remover_name` VARCHAR(128) DEFAULT '',
  `remover_subject` VARCHAR(64) DEFAULT '',
  `count_in_stats` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_att_sec_date` (`section_id`, `recorded_date`),
  INDEX `idx_att_student` (`student_name`),
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. جدول المشاركات الإيجابية والتعزيز (Stars & Points)
CREATE TABLE IF NOT EXISTS `positive_participations` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `section_id` VARCHAR(64) NOT NULL,
  `seat_num` INT DEFAULT NULL,
  `student_name` VARCHAR(128) NOT NULL,
  `student_number` VARCHAR(32) DEFAULT '',
  `massar_number` VARCHAR(64) DEFAULT '',
  `participation_type` VARCHAR(128) NOT NULL,
  `points` INT NOT NULL DEFAULT 1,
  `note` TEXT DEFAULT NULL,
  `teacher_id` VARCHAR(64) DEFAULT '',
  `teacher_name` VARCHAR(128) DEFAULT '',
  `teacher_subject` VARCHAR(64) DEFAULT '',
  `recorded_date` DATE NOT NULL,
  `recorded_time` VARCHAR(16) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pos_sec` (`section_id`),
  INDEX `idx_pos_student` (`student_name`),
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. جدول المخالفات اليومية
CREATE TABLE IF NOT EXISTS `daily_violations` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `section_id` VARCHAR(64) NOT NULL,
  `seat_num` INT DEFAULT NULL,
  `student_name` VARCHAR(128) NOT NULL,
  `student_number` VARCHAR(32) DEFAULT '',
  `massar_number` VARCHAR(64) DEFAULT '',
  `violation_type` VARCHAR(128) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `action_taken` VARCHAR(128) DEFAULT '',
  `teacher_name` VARCHAR(128) DEFAULT '',
  `teacher_subject` VARCHAR(64) DEFAULT '',
  `teacher_id` VARCHAR(64) DEFAULT '',
  `recorded_date` DATE NOT NULL,
  `recorded_time` VARCHAR(16) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_vio_sec` (`section_id`),
  INDEX `idx_vio_student` (`student_name`),
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. جدول استعمال زمان الأساتذة (Timetable)
CREATE TABLE IF NOT EXISTS `teacher_timetable` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(64) NOT NULL,
  `day_of_week` VARCHAR(32) NOT NULL,
  `slot_id` VARCHAR(32) NOT NULL,
  `period_type` VARCHAR(32) NOT NULL,
  `start_time` VARCHAR(16) NOT NULL,
  `end_time` VARCHAR(16) NOT NULL,
  `section_id` VARCHAR(64) NOT NULL,
  `room` VARCHAR(64) DEFAULT '',
  `subject` VARCHAR(64) DEFAULT '',
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tt_teacher` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. جدول الملاحظات على المقاعد (Notes)
CREATE TABLE IF NOT EXISTS `notes` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `section_id` VARCHAR(64) NOT NULL,
  `seat_num` INT NOT NULL,
  `note_text` TEXT NOT NULL,
  `note_date` VARCHAR(32) NOT NULL,
  `note_time` VARCHAR(16) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =======================================================
-- البيانات الافتراضية الأولية (Default Seeds)
-- =======================================================

-- إعدادات المؤسسة الافتراضية
INSERT INTO `app_settings` (`key_name`, `value`) VALUES
('institution', 'الثانوية الإعدادية ايكسان'),
('year', '2026/2027'),
('teacher', '')
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`);

-- حساب المشرف العام الافتراضي (كلمة المرور: admin123)
INSERT INTO `users` (`id`, `username`, `email`, `password`, `full_name`, `role`, `status`, `subject`, `email_verified`)
VALUES
('usr_admin_default', 'admin', 'admin@echsa.ma', '$2y$10$wTqKjWl0xL5YkU3V1Z8nxeZ8mX1C9y0qP4bO7A8d.kF2R6g9H3uO6', 'المشرف العام (الإدارة التربوية)', 'admin', 'active', 'الإدارة', 1)
ON DUPLICATE KEY UPDATE `status`='active';
