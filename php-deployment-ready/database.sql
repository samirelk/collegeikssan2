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

CREATE TABLE IF NOT EXISTS `app_settings` (
  `key_name` VARCHAR(64) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `seats` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `section_id` VARCHAR(64) NOT NULL,
  `seat_num` INT NOT NULL,
  `student_name` VARCHAR(128) DEFAULT '',
  `student_number` VARCHAR(32) DEFAULT '',
  `massar_number` VARCHAR(64) DEFAULT '',
  `guardian_phone` VARCHAR(32) DEFAULT '',
  `photo_url` LONGTEXT DEFAULT NULL,
  `roster_id` VARCHAR(64) DEFAULT NULL,
  `status_color` VARCHAR(32) DEFAULT 'default',
  `attendance` ENUM('present', 'absent', 'late') DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_sec_seat` (`section_id`, `seat_num`),
  INDEX `idx_seat_student` (`student_name`),
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `from_time` VARCHAR(16) DEFAULT NULL,
  `to_time` VARCHAR(16) DEFAULT NULL,
  `count_in_stats` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_att_sec_date` (`section_id`, `recorded_date`),
  INDEX `idx_att_student` (`student_name`),
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `academic_years` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(32) NOT NULL UNIQUE,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_current` TINYINT(1) NOT NULL DEFAULT 0,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `section_assignments` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `teacher_id` VARCHAR(64) NOT NULL,
  `section_id` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `request_note` TEXT DEFAULT NULL,
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME DEFAULT NULL,
  `reviewed_by` VARCHAR(64) DEFAULT NULL,
  `academic_year` VARCHAR(32) DEFAULT NULL,
  `subject` VARCHAR(64) DEFAULT 'الرياضيات',
  INDEX `idx_sa_teacher` (`teacher_id`),
  INDEX `idx_sa_section` (`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `academic_years` (`id`, `name`, `start_date`, `end_date`, `is_current`, `is_archived`, `notes`)
VALUES ('ay_2026_2027', '2026/2027', '2026-09-01', '2027-07-30', 1, 0, 'الموسم الدراسي الافتراضي')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

INSERT INTO `app_settings` (`key_name`, `value`) VALUES
('institution', 'الثانوية الإعدادية ايكسان'),
('year', '2026/2027'),
('teacher', '')
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`);

INSERT INTO `users` (`id`, `username`, `email`, `password`, `full_name`, `role`, `status`, `subject`, `email_verified`)
VALUES
('usr_admin_default', 'admin', 'admin@echsa.ma', '$2y$10$wTqKjWl0xL5YkU3V1Z8nxeZ8mX1C9y0qP4bO7A8d.kF2R6g9H3uO6', 'المشرف العام (الإدارة التربوية)', 'admin', 'active', 'الإدارة', 1)
ON DUPLICATE KEY UPDATE `status`='active';

CREATE TABLE IF NOT EXISTS `student_accounts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `massar_number` VARCHAR(64) NOT NULL UNIQUE,
  `student_name` VARCHAR(128) NOT NULL,
  `section_id` VARCHAR(64) DEFAULT '',
  `guardian_phone` VARCHAR(32) DEFAULT '',
  `guardian_phone_verified` TINYINT(1) DEFAULT 0,
  `photo_url` LONGTEXT DEFAULT NULL,
  `verification_code` VARCHAR(16) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sa_massar` (`massar_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_dispatch_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `to_phone` VARCHAR(32) NOT NULL,
  `intl_phone` VARCHAR(32) NOT NULL,
  `sender_name` VARCHAR(128) NOT NULL,
  `message_text` TEXT NOT NULL,
  `code` VARCHAR(64) DEFAULT '',
  `status` VARCHAR(32) NOT NULL DEFAULT 'delivered',
  `gateway` VARCHAR(64) NOT NULL DEFAULT 'WhatsApp Cloud API',
  `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_wdl_sent` (`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `app_settings` (`key_name`, `value`) VALUES
('sms_provider', 'whatsapp_cloud'),
('verification_channel', 'whatsapp_cloud'),
('whatsapp_cloud_enabled', '1')
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`);

