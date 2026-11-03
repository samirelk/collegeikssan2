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
('institution', 'الثانوية الإعدادية إحسان'),
('site_name', 'منظومة إحسان لتدبير الأقسام والغياب والسلوك'),
('site_url', 'https://school.ma'),
('director_name', 'محمد الشريف'),
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

CREATE TABLE IF NOT EXISTS `school_activities` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(64) NOT NULL DEFAULT 'أنشطة عامة',
  `image_url` LONGTEXT DEFAULT NULL,
  `author_id` VARCHAR(64) DEFAULT '',
  `author_name` VARCHAR(128) DEFAULT '',
  `author_role` VARCHAR(32) DEFAULT 'teacher',
  `author_subject` VARCHAR(64) DEFAULT '',
  `status` ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved',
  `likes_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_act_status` (`status`),
  INDEX `idx_act_cat` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `school_activities` (`id`, `title`, `description`, `category`, `image_url`, `author_id`, `author_name`, `author_role`, `author_subject`, `status`, `likes_count`)
VALUES 
('act_seed_1', 'أسبوع العلوم والتجارب الفيزيائية بالمختبر المدرسي', 'تنظيم ورشات علمية تطبيقية تفاعلية لتلاميذ السنة الثالثة إعدادي حول الظواهر الكهربائية والميكانيكية بإشراف أساتذة العلوم والفيزياء.', 'أنشطة علمية', 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80', 'usr_admin_samir', 'الأستاذ: سمير القراشي (المشرف العام)', 'admin', 'الإدارة التربوية', 'approved', 25),
('act_seed_2', 'دوري التضامن الرياضي في كرة القدم المصغرة', 'انطلاق فعاليات دوري كرة القدم المصغرة لتلاميذ المؤسسة بملاعب التربية البدنية، تكريساً لقيم الروح الرياضية والتعاون الجماعي.', 'أنشطة رياضية', 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80', 'usr_teacher_alami', 'ذ. محمد العلمي', 'teacher', 'الرياضيات', 'approved', 38)
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- =========================================================================

-- =========================================================================

-- =========================================================================

-- =========================================================================

-- =========================================================================
-- Daily Violations (21 Authentic Protected Records)
-- =========================================================================
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_benali_1_marrakchi', 'sec_mus4ead8_3_1p2v', 19, 'إلياس المراكشي', '19', 'B184034147', 'عدم إحضار الأدوات المدرسية', 'عدم إحضار مقرر التربية الإسلامية والدفتر الخاص بالمادة', 'تنبيه شفهي وتسجيل في السجل', 'ذ.كريم بنعلي', 'التربية الإسلامية', '2026-10-29', '09:15', '2026-10-29T09:27:28.234997+00:00', 'usr_mus3qsx789xp') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_benali_2_belkadi', 'sec_mus4ead8_3_1p2v', 4, 'ميمون بالقاضي', '4', 'B188014595', 'التشويش داخل القسم', 'التشويش أثناء تلاوة القرآن الكريم ومقاطعة الزملاء المتكررة', 'إنذار وتنبيه شفهي', 'ذ.كريم بنعلي', 'التربية الإسلامية', '2026-10-29', '09:40', '2026-10-29T09:27:28.234997+00:00', 'usr_mus3qsx789xp') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_benali_3_riyahi', 'sec_mus4ead6_0_wmch', 2, 'محمد الرياحي', '2', 'B186014622', 'عدم إنجاز الواجبات المنزلية', 'عدم إنجاز أنشطة التعلم الذاتي وحفظ الآيات المقررة', 'تنبيه شفهي مع إشعار ولي الأمر', 'ذ.كريم بنعلي', 'التربية الإسلامية', '2026-10-29', '10:30', '2026-10-29T09:27:28.234997+00:00', 'usr_mus3qsx789xp') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_benali_4_aalam', 'sec_mus4eadb_7_ytnu', 4, 'اسامة أعلام', '27', 'B188044631', 'استعمال الهاتف أثناء الحصة', 'استعمال الهاتف الذكي داخل الحصة دون إذن تربوي', 'سحب الهاتف وإحالته على الإدارة التربوية', 'ذ.كريم بنعلي', 'التربية الإسلامية', '2026-10-29', '11:15', '2026-10-29T09:27:28.234997+00:00', 'usr_mus3qsx789xp') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_benali_5_qlich', 'sec_mus4eadc_8_e4sy', 1, 'ندير قليش', '1', 'B161033426', 'عدم احترام زملاء القسم', 'التلفظ بعبارات غير لائقة تجاه زميله في الصف وإثارة الفوضى', 'إنذار كتابي وتوجيه تربوي', 'ذ.كريم بنعلي', 'التربية الإسلامية', '2026-10-29', '14:20', '2026-10-29T09:27:28.234997+00:00', 'usr_mus3qsx789xp') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_benali_6_hiti', 'sec_mus4ead7_2_wk0x', 5, 'آدم حيتي', '5', 'B190060472', 'عدم الانضباط', 'رفض الجلوس في المقعد المخصص له وإحداث الفوضى في الصف', 'تنبيه شفهي والتزام كتابي بالانضباط', 'ذ.كريم بنعلي', 'التربية الإسلامية', '2026-10-29', '15:10', '2026-10-29T09:27:28.234997+00:00', 'usr_mus3qsx789xp') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_director_3_lahmidi', 'sec_mus4ead6_0_wmch', 4, 'ياسين لحميدي', '4', 'B190019114', 'مخالفة النظام الداخلي', 'التأخر المتكرر عن تحية العلم الصباحية والدخول للمؤسسة', 'استدعاء ولي الأمر وتوقيع تعهد بالانضباط', 'السيد المدير: محمد الشريف (مدير المؤسسة)', 'الإدارة التربوية', '2026-10-29', '08:15', '2026-10-29T09:27:28.234997+00:00', 'usr_director_iksan') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_director_4_lakmouchi', 'sec_mus4ead6_0_wmch', 5, 'محمد لكموشي', '5', 'B190022733', 'إتلاف ممتلكات المؤسسة', 'الكتابة على الجدران وتخريب تجهيزات مقعد الفصل', 'إلزام ولي الأمر بإصلاح الضرر مع إنذار تأديبي', 'السيد المدير: محمد الشريف (مدير المؤسسة)', 'الإدارة التربوية', '2026-10-29', '11:45', '2026-10-29T09:27:28.234997+00:00', 'usr_director_iksan') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_director_5_fnassi', 'sec_mus4eada_5_gdvw', 3, 'المختار الفناسي', '3', 'B170028184', 'مغادرة القسم دون إذن', 'التسلل خارج ساحة المؤسسة دون ترخيص مسبق أثناء الحصة', 'إحالة على مجلس الانضباط واستدعاء ولي الأمر', 'السيد المدير: محمد الشريف (مدير المؤسسة)', 'الإدارة التربوية', '2026-10-29', '10:10', '2026-10-29T09:27:28.234997+00:00', 'usr_director_iksan') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_director_6_kourari', 'sec_mus4eadb_7_ytnu', 5, 'بلال كوراري', '24', 'B188014608', 'عدم الانضباط', 'إثارة الشغب في الممرات وعدم الامتثال لتعليمات الحراسة العامة', 'توبيخ رسمي وإنذار أخير قبل الإحالة على المجلس التأديبي', 'السيد المدير: محمد الشريف (مدير المؤسسة)', 'الإدارة التربوية', '2026-10-29', '15:45', '2026-10-29T09:27:28.234997+00:00', 'usr_director_iksan') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_director_7_daadouai', 'sec_mus4ead8_4_0ady', 5, 'وسيم الدعدوعي', '5', 'B170030548', 'عدم احترام الأستاذ', 'التطاول اللفظي داخل الجناح العلمي ورفض التوجيهات', 'استدعاء فوري لولي الأمر وتوقيع التزام قانوني', 'السيد المدير: محمد الشريف (مدير المؤسسة)', 'الإدارة التربوية', '2026-10-29', '16:00', '2026-10-29T09:27:28.234997+00:00', 'usr_director_iksan') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_mutw04pzrt0l', 'sec_mus4ead6_0_wmch', 2, 'محمد الرياحي', '2', 'B186014622', 'عدم إحضار الأدوات المدرسية', 'عدم إحضار الدفتر والأدوات المدرسية للمرة الثانية', 'تنبيه شفهي', 'سمير القراشي', 'الرياضيات', '2026-10-29', '08:26', '2026-10-04T13:59:13.128Z', 'usr_mus3qsxfuxy3') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_muv3oe23geyj', 'sec_mus4ead8_4_0ady', 9, 'ابراهيم امعيوة', '9', 'B180034151', 'استعمال الهاتف أثناء الحصة', 'استعمال الهاتف الذكي خلسة أثناء شرح الدرس', 'تنبيه شفهي', 'سمير القراشي', 'الرياضيات', '2026-10-29', '08:26', '2026-10-05T10:21:48.460Z', 'usr_mus3qsxfuxy3') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_muwfqi1cx1m8', 'sec_mus4ead7_2_wk0x', 10, 'ايوب الهصاك', '10', 'B190072931', 'التشويش داخل القسم', 'التشويش وإثارة الضحك بين زملائه أثناء تقديم الدرس', 'تنبيه شفهي', 'سمير القراشي', 'الرياضيات', '2026-10-29', '08:26', '2026-10-06T08:47:08.498Z', 'usr_mus3qsxfuxy3') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_mv0qmfjo6won', 'sec_mus4ead8_3_1p2v', 19, 'إلياس المراكشي', '19', 'B184034147', 'عدم احترام زملاء القسم', 'التلفظ بعبارات غير لائقة تجاه زملائه والتشويش أثناء الحصة', 'تنبيه شفهي', 'سمير القراشي', 'الرياضيات', '2026-10-29', '08:26', '2026-10-09T09:02:59.125Z', 'usr_mus3qsxfuxy3') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_mvao2vrstw9v', 'sec_mus4ead8_4_0ady', 9, 'ابراهيم امعيوة', '9', 'B180034151', 'عدم إحضار اللوازم المدرسية', 'تكرار عدم إحضار الأدوات الهندسية والكتب المدرسية', 'استدعاء ولي الأمر', 'سمير القراشي', 'الرياضيات', '2026-10-29', '08:26', '2026-10-16T07:49:29.560Z', 'usr_mus3qsxfuxy3') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_mvrzn1vlhaou', 'sec_mus4eadb_6_b5sw', 30, 'ندى خلوقي', '30', 'B185022719', 'عدم إنجاز الواجب المنزلي', 'تتجول في الساحة بشكل استعراضي لتسريحة الشعر', 'تنبيه شفهي', 'السيد المدير: محمد الشريف (مدير المؤسسة)', 'الإدارة التربوية', '2026-10-29', '08:26', '2026-10-28T10:45:11.361Z', 'usr_director_iksan') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_mvt91l447r2s', 'sec_mus4ead7_1_39ea', 5, 'محمد خلوق', '6', 'B193022735', 'عدم احترام الأستاذ', 'التطاول في الكلام والاعتراض غير اللائق على ملاحظات الأستاذة', 'إنذار كتابي', 'رميساء القمبوعي', 'الفرنسية', '2026-10-29', '08:26', '2026-10-29T07:56:12.196Z', 'usr_mus3qsxlti1d') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_mvta2rn0jha1', 'sec_mus4eadh_9_wgvd', 7, 'نهاد الحساني', '7', 'B195022718', 'سوء سلوك وقلة انضباط', 'حضر والدها واطلع على غيابها وتعهد بعدم التكرار', 'إشعار لولي الأمر', 'السيد المدير: محمد الشريف (مدير المؤسسة)', 'الإدارة التربوية', '2026-10-29', '08:25 ص', '2026-10-29T08:25:06.924Z', 'usr_director_iksan') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_mvtafonvh9x0', 'sec_mus4ead7_1_39ea', 0, 'أسينا اغدو', '34', 'B182020967', 'سوء سلوك وقلة انضباط', 'اخبر والدها بالمخالفة وتعهد بعدم التكرار', 'إشعار لولي الأمر', 'السيد المدير: محمد الشريف (مدير المؤسسة)', 'الإدارة التربوية', '2026-10-29', '08:35', '2026-10-29T08:35:09.595Z', 'usr_director_iksan') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);
INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES ('v_samir_boumazough', 'sec_mus4ead7_2_wk0x', 1, 'يوسف بومزوغ', '1', 'B180034153', 'عدم إحضار الأدوات المدرسية', 'عدم إحضار الدفتر واللوازم الخاصة بحصة الرياضيات', 'تنبيه شفهي وتسجيل في السجل', 'سمير القراشي', 'الرياضيات', '2026-10-29', '15:00', '2026-10-29T15:00:00.000Z', 'usr_mus3qsxfuxy3') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);

-- =========================================================================
-- Baseline Positive Participations (66 Protected Records)
-- =========================================================================
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1790356596812_gt6l3q', 'sec_mus4ead6_0_wmch', 24, 'يونس الكموشي', '24', 'B203013309', 'مشاركة صفية متميزة وإجابة صحيحة', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mugyyp69j93l', '2026-09-25', '17:16', '2026-09-25T17:16:36.812Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1790370133519_62ne4o', 'sec_mus4ead7_1_39ea', 2, 'أنس العزوزي', '2', 'B172039986', 'إنجاز متقن للواجبات والتمارين', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mugyyp69j93l', '2026-09-25', '21:02', '2026-09-25T21:02:13.519Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1790411326142_bblpj0', 'sec_mus4ead7_1_39ea', 27, 'عبد القادر قندروش', '27', 'B201034352', 'مشاركة صفية متميزة وإجابة صحيحة', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mugyyp69j93l', '2026-09-26', '08:28', '2026-09-26T08:28:46.142Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791281816169_u7lql9', 'sec_mus4ead8_4_0ady', 10, 'أحلام سلطانة', '10', 'B180037921', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-06', '10:16', '2026-10-06T10:16:56.169Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791281837041_3nhpre', 'sec_mus4ead8_4_0ady', 20, 'مريم الهصاك', '20', 'B192022708', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-06', '10:17', '2026-10-06T10:17:17.041Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791281859084_6xaz7q', 'sec_mus4ead8_4_0ady', 26, 'ملاك الزرواني', '26', 'B197022774', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-06', '10:17', '2026-10-06T10:17:39.084Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791538725370_wwblwu', 'sec_mus4ead8_3_1p2v', 31, 'اشوارق مريم', '31', 'B206041196', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '09:38', '2026-10-09T09:38:45.370Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791538782551_kndf73', 'sec_mus4ead8_3_1p2v', 25, 'روميساء بنزل', '25', 'B202013326', 'إنجاز متقن للواجبات والتمارين', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '09:39', '2026-10-09T09:39:42.551Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791538928470_h55txb', 'sec_mus4ead8_3_1p2v', 24, 'أميرة بودهان', '24', 'B200034279', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '09:42', '2026-10-09T09:42:08.470Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791538946908_qweblm', 'sec_mus4ead8_3_1p2v', 23, 'احمد امحرف', '23', 'B200013322', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '09:42', '2026-10-09T09:42:26.908Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791538966496_ezcqx9', 'sec_mus4ead8_3_1p2v', 17, 'كوثر اليوزولي', '17', 'B195072920', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '09:42', '2026-10-09T09:42:46.496Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791538984696_4cj9yy', 'sec_mus4ead8_3_1p2v', 28, 'محمد ايت صالح', '28', 'B203013314', 'إنجاز متقن للواجبات والتمارين', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '09:43', '2026-10-09T09:43:04.696Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791542410434_kdgl7z', 'sec_mus4ead6_0_wmch', 7, 'شمس عمران', '7', 'B190072063', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '10:40', '2026-10-09T10:40:10.434Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791542431024_8m9yj8', 'sec_mus4ead6_0_wmch', 25, 'زينب امهاوش', '25', 'B205013298', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '10:40', '2026-10-09T10:40:31.024Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791542451275_yarpyz', 'sec_mus4ead6_0_wmch', 21, 'علي قاسي', '21', 'B202013317', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '10:40', '2026-10-09T10:40:51.275Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791542469649_4wgcwv', 'sec_mus4ead6_0_wmch', 15, 'وصال حوليش', '15', 'B197069690', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '10:41', '2026-10-09T10:41:09.649Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791542486467_1685w6', 'sec_mus4ead6_0_wmch', 30, 'محمد البوزيدي', '30', 'B209059243', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '10:41', '2026-10-09T10:41:26.467Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791542505139_nckizt', 'sec_mus4ead6_0_wmch', 18, 'خديجة الكواز', '18', 'B201013318', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-09', '10:41', '2026-10-09T10:41:45.139Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791619942378_3fux4s', 'sec_mus4ead7_1_39ea', 11, 'محمد اغدو', '11', 'B193069689', 'إنجاز متقن للواجبات والتمارين', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-10', '08:12', '2026-10-10T08:12:22.378Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791619966869_zc6key', 'sec_mus4ead7_1_39ea', 1, 'رضى العزوزي', '25', 'B200013320', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-10', '08:12', '2026-10-10T08:12:46.869Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791620002528_xfhqe2', 'sec_mus4ead7_1_39ea', 14, 'بلال الجنتافي', '14', 'B194022786', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-10', '08:13', '2026-10-10T08:13:22.528Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791620032930_4u3vje', 'sec_mus4ead7_1_39ea', 5, 'أنس امعيوة', '15', 'B194022787', 'إنجاز متقن للواجبات والتمارين', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-10', '08:13', '2026-10-10T08:13:52.930Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1791620081930_hla912', 'sec_mus4ead7_1_39ea', 12, 'احمد بوعزاتي', '10', 'B193022738', 'إنجاز متقن للواجبات والتمارين', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-10', '08:14', '2026-10-10T08:14:41.930Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053524786_y7q1q1', 'sec_mus4ead8_3_1p2v', 11, 'ايمان الزغاوي', '11', 'B192082651', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:38', '2026-10-15T08:38:44.786Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053552324_l8i6ul', 'sec_mus4ead8_3_1p2v', 18, 'كوثر اليوزولي', '17', 'B195072920', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:39', '2026-10-15T08:39:12.324Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053574313_b1gdlr', 'sec_mus4ead8_3_1p2v', 31, 'اشوارق مريم', '31', 'B206041196', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:39', '2026-10-15T08:39:34.313Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053611017_s66qoh', 'sec_mus4ead8_3_1p2v', 24, 'أميرة بودهان', '24', 'B200034279', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:40', '2026-10-15T08:40:11.017Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053639382_v21rr5', 'sec_mus4ead8_3_1p2v', 28, 'محمد ايت صالح', '28', 'B203013314', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:40', '2026-10-15T08:40:39.382Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053662822_i3ppce', 'sec_mus4ead8_3_1p2v', 26, 'دعاء عجة', '26', 'B202013328', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:41', '2026-10-15T08:41:02.822Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053702682_vnbmq8', 'sec_mus4ead8_3_1p2v', 2, 'ملاك المراكشي', '2', 'B184034147', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:41', '2026-10-15T08:41:42.682Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053736022_95lnev', 'sec_mus4ead8_3_1p2v', 3, 'دعاء شرود', '3', 'B204034360', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:42', '2026-10-15T08:42:16.022Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053917523_68vmtk', 'sec_mus4ead8_3_1p2v', 2, 'ملاك المراكشي', '2', 'B184034147', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:45', '2026-10-15T08:45:17.523Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053939736_yt255j', 'sec_mus4ead8_3_1p2v', 3, 'دعاء شرود', '3', 'B204034360', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:45', '2026-10-15T08:45:39.736Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792053964301_rge3za', 'sec_mus4ead8_3_1p2v', 11, 'ايمان الزغاوي', '11', 'B192082651', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:46', '2026-10-15T08:46:04.301Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054000609_kfs21e', 'sec_mus4ead8_3_1p2v', 18, 'كوثر اليوزولي', '17', 'B195072920', 'مشاركة صفية متميزة وإجابة صحيحة', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:46', '2026-10-15T08:46:40.609Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054025601_xeb6lm', 'sec_mus4ead8_3_1p2v', 31, 'اشوارق مريم', '31', 'B206041196', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:47', '2026-10-15T08:47:05.601Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054040039_ifh9tr', 'sec_mus4ead8_3_1p2v', 24, 'أميرة بودهان', '24', 'B200034279', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:47', '2026-10-15T08:47:20.039Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054059579_qfj9up', 'sec_mus4ead8_3_1p2v', 28, 'محمد ايت صالح', '28', 'B203013314', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:47', '2026-10-15T08:47:39.579Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054076255_9clrx5', 'sec_mus4ead8_3_1p2v', 26, 'دعاء عجة', '26', 'B202013328', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:47', '2026-10-15T08:47:56.255Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054194689_dxm0c9', 'sec_mus4ead8_3_1p2v', 31, 'اشوارق مريم', '31', 'B206041196', 'تفوق وتميز في التقييم اليومي', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:49', '2026-10-15T08:49:54.689Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054212267_v7l3z4', 'sec_mus4ead8_3_1p2v', 28, 'محمد ايت صالح', '28', 'B203013314', 'تفوق وتميز في التقييم اليومي', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:50', '2026-10-15T08:50:12.267Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054238623_8b6itq', 'sec_mus4ead8_3_1p2v', 34, 'وديان صبحي', '34', 'B205013300', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:50', '2026-10-15T08:50:38.623Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054254490_9uszjy', 'sec_mus4ead8_3_1p2v', 23, 'احمد امحرف', '23', 'B200013322', 'تفوق وتميز في التقييم اليومي', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:50', '2026-10-15T08:50:54.490Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054279199_ibefnx', 'sec_mus4ead8_3_1p2v', 27, 'محمد امين العمراني', '27', 'B203013312', 'إنجاز متقن للواجبات والتمارين', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:51', '2026-10-15T08:51:19.199Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054301016_lex1qt', 'sec_mus4ead8_3_1p2v', 18, 'كوثر اليوزولي', '17', 'B195072920', 'تفوق وتميز في التقييم اليومي', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:51', '2026-10-15T08:51:41.016Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054317915_kfmcl4', 'sec_mus4ead8_3_1p2v', 26, 'دعاء عجة', '26', 'B202013328', 'تفوق وتميز في التقييم اليومي', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:51', '2026-10-15T08:51:57.915Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054338777_5nrr30', 'sec_mus4ead8_3_1p2v', 24, 'أميرة بودهان', '24', 'B200034279', 'تفوق وتميز في التقييم اليومي', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:52', '2026-10-15T08:52:18.777Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054356392_4tfl16', 'sec_mus4ead8_3_1p2v', 25, 'روميساء بنزل', '25', 'B202013326', 'تفوق وتميز في التقييم اليومي', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:52', '2026-10-15T08:52:36.392Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054563995_dzde2p', 'sec_mus4ead8_3_1p2v', 34, 'وديان صبحي', '34', 'B205013300', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:56', '2026-10-15T08:56:03.995Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792054583906_xbwa9a', 'sec_mus4ead8_3_1p2v', 25, 'روميساء بنزل', '25', 'B202013326', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-15', '08:56', '2026-10-15T08:56:23.906Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792138154575_5v0q43', 'sec_mus4ead7_1_39ea', 1, 'رضى العزوزي', '25', 'B200013320', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-16', '08:09', '2026-10-16T08:09:14.575Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792138169606_j86q1u', 'sec_mus4ead7_1_39ea', 2, 'ريان العزوزي', '18', 'B196050113', 'إنجاز متقن للواجبات والتمارين', 1, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-16', '08:09', '2026-10-16T08:09:29.606Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792138194996_glszlh', 'sec_mus4ead7_1_39ea', 4, 'محمد امين احساني', '13', 'B193072929', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-16', '08:09', '2026-10-16T08:09:54.996Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792138243876_vb9ysp', 'sec_mus4ead7_1_39ea', 14, 'بلال الجنتافي', '14', 'B194022786', 'إنجاز متقن للواجبات والتمارين', 3, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-16', '08:10', '2026-10-16T08:10:43.876Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792138295034_8xyuy5', 'sec_mus4ead7_1_39ea', 11, 'ريان بوغرضاين', '32', 'B208041578', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-16', '08:11', '2026-10-16T08:11:35.034Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792138365153_4bkk02', 'sec_mus4ead7_1_39ea', 13, 'ريهام خلاط', '20', 'B196072922', 'إنجاز متقن للواجبات والتمارين', 6, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-16', '08:12', '2026-10-16T08:12:45.153Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792138536982_xpirst', 'sec_mus4ead7_1_39ea', 14, 'زينب امزوص', '28', 'B202013302', 'إنجاز متقن للواجبات والتمارين', 4, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-16', '08:15', '2026-10-16T08:15:36.982Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_1792138608161_1bc36p', 'sec_mus4ead7_1_39ea', 15, 'مريم كشوط', '8', 'B190072928', 'إنجاز متقن للواجبات والتمارين', 2, '', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-16', '08:16', '2026-10-16T08:16:48.161Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_t2_19_drahmi', 'sec_mus4eada_5_gdvw', 19, 'دينة ادراهمي', '19', 'B190022726', 'مشاركة متميزة وتفاعل إيجابي في الحصة', 3, 'إجابات نموذجية وسرعة بديهة', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-29', '09:30', '2026-10-29T09:30:00.000Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_t2_1_aghadou', 'sec_mus4eada_5_gdvw', 1, 'محمد أمين اغدو', '1', 'B161033412', 'إنجاز متقن للواجبات والتمارين', 3, 'مواظبة وتميز في حل الأنشطة الرياضية', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-29', '09:30', '2026-10-29T09:30:00.000Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_t2_23_cherroud', 'sec_mus4eada_5_gdvw', 23, 'خديجة شرود', '23', 'B190022796', 'تفوق وتميز في التقييم اليومي', 3, 'حصول على العلامة الكاملة في التطبيق السريع', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-29', '09:30', '2026-10-29T09:30:00.000Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_t2_29_marrakchi', 'sec_mus4eada_5_gdvw', 29, 'غفران المراكشي', '29', 'B192022717', 'إنجاز متقن للواجبات وحسن انضباط', 3, 'عمل جماعي متميز وانضباط عالي', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-29', '09:30', '2026-10-29T09:30:00.000Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_t2_2_zariouh', 'sec_mus4eada_5_gdvw', 2, 'كوثر زريوح', '2', 'B169033418', 'مشاركة صفية متميزة وإجابة صحيحة', 3, 'تفاعل ممتاز ومشاركة فعالة في الدرس', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-29', '09:30', '2026-10-29T09:30:00.000Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_t2_31_khalouqi', 'sec_mus4eada_5_gdvw', 31, 'مروان خلوقي', '31', 'B195001040', 'مشاركة صفية متميزة وإجابة صحيحة', 2, 'مبادرة فردية موفقة في البرهنة الرياضية', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-29', '09:30', '2026-10-29T09:30:00.000Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_t2_3_fnassi', 'sec_mus4eada_5_gdvw', 3, 'المختار الفناسي', '3', 'B170028184', 'تفوق وتميز في التقييم اليومي', 2, 'تحسن ملحوظ وانضباط إيجابي', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-29', '09:30', '2026-10-29T09:30:00.000Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);
INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES ('pos_t2_4_ghribi', 'sec_mus4eada_5_gdvw', 4, 'عبدالصمد الغريبي', '4', 'B171028160', 'إنجاز متقن للواجبات والتمارين', 2, 'دفتر منظم وتمارين مكتملة بدقة', 'سمير القراشي', 'الرياضيات', 'usr_mus3qsxfuxy3', '2026-10-29', '09:30', '2026-10-29T09:30:00.000Z') ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);

CREATE TABLE IF NOT EXISTS `parent_summons` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `section_id` VARCHAR(64) NOT NULL,
  `student_name` VARCHAR(128) NOT NULL,
  `student_number` VARCHAR(32) DEFAULT '',
  `massar_number` VARCHAR(64) DEFAULT '',
  `reason` TEXT NOT NULL,
  `summons_date` DATE NOT NULL,
  `appointment_time` VARCHAR(16) DEFAULT '10:00',
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `created_by` VARCHAR(128) DEFAULT '',
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sum_sec` (`section_id`),
  FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

