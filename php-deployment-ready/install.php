<?php
/**
 * معالج التثبيت التلقائي للنظام (CMS Auto-Installer)
 * يقوم بفحص بيئة الخادم، إنشاء الجداول في MySQL، كتابة ملف الإعدادات، وإنشاء حساب المشرف العام.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

$lockFile = __DIR__ . '/installed.lock';
$configFile = __DIR__ . '/config.php';
$sqlFile = __DIR__ . '/database.sql';

// التحقق من حالة التثبيت المسبق
$isInstalled = file_exists($lockFile);

// معالجة طلبات AJAX للتثبيت واختبار الاتصال
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');

    if ($isInstalled) {
        echo json_encode(['success' => false, 'error' => 'النظام مثبت بالفعل مسبقاً! لأسباب أمنية يرجى حذف ملف installed.lock إن أردت إعادة التثبيت.']);
        exit;
    }

    $action = $_POST['action'] ?? '';

    // 1. اختبار الاتصال بقاعدة البيانات
    if ($action === 'test_connection') {
        $host = trim($_POST['db_host'] ?? 'localhost');
        $dbname = trim($_POST['db_name'] ?? '');
        $user = trim($_POST['db_user'] ?? '');
        $pass = $_POST['db_pass'] ?? '';

        if (!$dbname || !$user) {
            echo json_encode(['success' => false, 'error' => 'يرجى إدخال اسم قاعدة البيانات واسم المستخدم.']);
            exit;
        }

        try {
            // محاولة الاتصال بقاعدة البيانات المحددة
            $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'تم الاتصال بقاعدة البيانات بنجاح تام! جاهز للمتابعة.'
            ]);
        } catch (PDOException $e) {
            // محاولة توضيح سبب الخطأ لمساعدة المستخدم
            $errorMsg = $e->getMessage();
            $detailedHelp = '';

            if (strpos($errorMsg, 'Access denied') !== false) {
                $detailedHelp = 'تأكد من صحة اسم المستخدم وكلمة المرور، وتأكد من أنك قمت بإضافة المستخدم إلى قاعدة البيانات مع تفعيل كل الصلاحيات (All Privileges) في cPanel.';
            } elseif (strpos($errorMsg, 'Unknown database') !== false) {
                $detailedHelp = 'قاعدة البيانات غير موجودة! في استضافات cPanel/Hostinger يرجى التأكد من كتابة الاسم الكامل لقاعدة البيانات بما في ذلك بادئة حسابك (مثال: u123456_school وليس school فقط).';
            } elseif (strpos($errorMsg, 'Connection refused') !== false || strpos($errorMsg, 'getaddrinfo failed') !== false) {
                $detailedHelp = 'تعذر الوصول لخادم MySQL. إذا كنت على سيرفر محلي جرب 127.0.0.1 أو localhost، وفي الاستضافات السحابية تأكد من عنوان مضيف قاعدة البيانات.';
            }

            echo json_encode([
                'success' => false,
                'error' => 'فشل الاتصال: ' . $errorMsg,
                'help' => $detailedHelp
            ]);
        }
        exit;
    }

    // 2. تنفيذ التثبيت الكامل (تنفيذ الجداول، إنشاء الحساب، وحفظ ملف config.php)
    if ($action === 'execute_installation') {
        $host = trim($_POST['db_host'] ?? 'localhost');
        $dbname = trim($_POST['db_name'] ?? '');
        $user = trim($_POST['db_user'] ?? '');
        $pass = $_POST['db_pass'] ?? '';

        $institution = trim($_POST['institution'] ?? 'الثانوية الإعدادية ايكسان');
        $academicYear = trim($_POST['academic_year'] ?? '2026/2027');

        $adminName = trim($_POST['admin_name'] ?? 'المشرف العام');
        $adminUsername = trim($_POST['admin_username'] ?? 'admin');
        $adminEmail = trim($_POST['admin_email'] ?? 'admin@school.local');
        $adminPassword = $_POST['admin_password'] ?? '';
        $skipTables = !empty($_POST['skip_tables']);

        if (!$dbname || !$user || !$adminUsername || !$adminPassword) {
            echo json_encode(['success' => false, 'error' => 'جميع الحقول الأساسية مطلوبة لإتمام التثبيت.']);
            exit;
        }

        try {
            // الاتصال بـ MySQL
            $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
            ]);

            // تعطيل فحص القيود الخارجية مؤقتاً لتجنب أي تعارض في ترتيب إنشاء الجداول
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
            $pdo->exec("SET NAMES utf8mb4;");

            // فحص ذكي: هل الجداول منشأة بالفعل في قاعدة البيانات؟ (مثلاً إذا قام المستخدم بلصقها في phpMyAdmin)
            $tablesExist = false;
            try {
                $checkStmt = $pdo->query("SHOW TABLES LIKE 'users'");
                if ($checkStmt && $checkStmt->rowCount() > 0) {
                    $tablesExist = true;
                }
            } catch (Exception $e) {}

            // إذا لم تكن الجداول موجودة مسبقاً، نقوم بإنشائها مباشرة من المخطط المضمن النظيف 100%
            if (!$skipTables && !$tablesExist) {
                $embeddedTables = [
                        "CREATE TABLE IF NOT EXISTS `users` (
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
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `app_settings` (
                          `key_name` VARCHAR(64) NOT NULL PRIMARY KEY,
                          `value` TEXT NOT NULL,
                          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `sections` (
                          `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                          `level` VARCHAR(64) NOT NULL,
                          `class_number` VARCHAR(32) NOT NULL,
                          `teacher` VARCHAR(128) DEFAULT '',
                          `assigned_teacher_id` VARCHAR(64) DEFAULT NULL,
                          `academic_year` VARCHAR(32) NOT NULL DEFAULT '2026/2027',
                          `roster_json` LONGTEXT DEFAULT NULL,
                          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `seats` (
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
                          UNIQUE KEY `uniq_sec_seat` (`section_id`, `seat_num`)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `teacher_seat_overrides` (
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
                          UNIQUE KEY `uniq_teacher_sec_seat` (`teacher_id`, `section_id`, `seat_num`)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `attendance_history` (
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
                          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `positive_participations` (
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
                          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `daily_violations` (
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
                          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `teacher_timetable` (
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
                          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",
                        "CREATE TABLE IF NOT EXISTS `notes` (
                          `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                          `section_id` VARCHAR(64) NOT NULL,
                          `seat_num` INT NOT NULL,
                          `note_text` TEXT NOT NULL,
                          `note_date` VARCHAR(32) NOT NULL,
                          `note_time` VARCHAR(16) NOT NULL,
                          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
                    ];
                    foreach ($embeddedTables as $tblSql) {
                        try {
                            $pdo->exec($tblSql);
                        } catch (Exception $e) {}
                    }
                }

            // إعادة تفعيل القيود
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

            // تحديث إعدادات المؤسسة
            $stmtSet = $pdo->prepare("INSERT INTO app_settings (key_name, value) VALUES ('institution', ?), ('year', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)");
            $stmtSet->execute([$institution, $academicYear]);

            // إنشاء / تحديث حساب المشرف العام
            $hashedPassword = password_hash($adminPassword, PASSWORD_DEFAULT);
            $adminId = 'usr_admin_' . bin2hex(random_bytes(4));

            $stmtUser = $pdo->prepare("
                INSERT INTO users (id, username, email, password, full_name, role, status, subject, email_verified, academic_year)
                VALUES (?, ?, ?, ?, ?, 'admin', 'active', 'الإدارة التربوية', 1, ?)
                ON DUPLICATE KEY UPDATE
                    password = VALUES(password),
                    full_name = VALUES(full_name),
                    email = VALUES(email),
                    status = 'active'
            ");
            $stmtUser->execute([$adminId, $adminUsername, $adminEmail, $hashedPassword, $adminName, $academicYear]);

            // إعداد محتوى ملف config.php
            $configContent = "<?php
/**
 * إعدادات الاتصال بقاعدة بيانات MySQL
 * تم إنشاؤه تلقائياً بواسطة معالج التثبيت (Auto-Installer) في: " . date('Y-m-d H:i:s') . "
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-user-id, x-user-role');
header('Content-Type: application/json; charset=utf-8');

if (\$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

define('DB_HOST', " . var_export($host, true) . ");
define('DB_NAME', " . var_export($dbname, true) . ");
define('DB_USER', " . var_export($user, true) . ");
define('DB_PASS', " . var_export($pass, true) . ");
define('DB_CHARSET', 'utf8mb4');

try {
    \$dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    \$options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    \$pdo = new PDO(\$dsn, DB_USER, DB_PASS, \$options);
} catch (PDOException \$e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'تعذر الاتصال بقاعدة البيانات MySQL: ' . \$e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonResponse(\$data, \$statusCode = 200) {
    http_response_code(\$statusCode);
    echo json_encode(\$data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function getJsonInput() {
    \$raw = file_get_contents('php://input');
    return json_decode(\$raw, true) ?: [];
}

function getHeader(\$name) {
    \$headerKey = 'HTTP_' . strtoupper(str_replace('-', '_', \$name));
    return \$_SERVER[\$headerKey] ?? '';
}
";

            $configSaved = @file_put_contents($configFile, $configContent);
            if ($configSaved) {
                @file_put_contents($lockFile, "Installed successfully on " . date('Y-m-d H:i:s'));
            }

            echo json_encode([
                'success' => true,
                'config_saved' => (bool)$configSaved,
                'config_content' => $configContent,
                'message' => $configSaved
                    ? 'تم تثبيت وتجهيز النظام وقاعدة البيانات بنجاح تام! يمكنك الآن تسجيل الدخول مباشرة.'
                    : 'تم إنشاء الجداول والمشرف بنجاح! لم نتمكن من حفظ ملف config.php تلقائياً بسبب تصاريح المجلد. يرجى نسخه أو تحميله وحفظه في مجلد النظام.'
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'إجراء غير معروف']);
    exit;
}

// فحوصات متطلبات الخادم للعرض في واجهة المستخدم
$requirements = [
    'php_version' => [
        'name' => 'إصدار PHP (7.4 أو أحدث)',
        'status' => version_compare(PHP_VERSION, '7.4.0', '>='),
        'current' => PHP_VERSION,
        'required' => '>= 7.4.0'
    ],
    'pdo' => [
        'name' => 'امتداد PDO مفعل',
        'status' => extension_loaded('pdo'),
        'current' => extension_loaded('pdo') ? 'مفعل ✓' : 'غير مفعل ✗',
        'required' => 'مطلوب'
    ],
    'pdo_mysql' => [
        'name' => 'امتداد PDO MySQL',
        'status' => extension_loaded('pdo_mysql'),
        'current' => extension_loaded('pdo_mysql') ? 'مفعل ✓' : 'غير مفعل ✗',
        'required' => 'مطلوب'
    ],
    'write_permissions' => [
        'name' => 'صلاحية الكتابة في المجلد',
        'status' => is_writable(__DIR__),
        'current' => is_writable(__DIR__) ? 'قابل للكتابة ✓' : 'غير قابل للكتابة ✗',
        'required' => 'مطلوب لإنشاء config.php'
    ]
];

$allRequirementsPassed = true;
foreach ($requirements as $req) {
    if (!$req['status']) {
        $allRequirementsPassed = false;
        break;
    }
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>معالج التثبيت الذكي | نظام توزيع وتدبير مقاعد الأقسام</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Amiri:wght@700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #1A4E47;
            --primary-dark: #123832;
            --accent: #C98A3C;
            --bg: #F4F1EA;
            --surface: #FFFFFF;
            --border: #E2DDD3;
            --text-main: #1F2926;
            --text-muted: #6C6356;
            --success: #15803D;
            --danger: #DC2626;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Cairo', system-ui, sans-serif;
        }

        body {
            background-color: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
        }

        .container {
            width: 100%;
            max-width: 680px;
            background: var(--surface);
            border-radius: 24px;
            border: 1px solid var(--border);
            box-shadow: 0 20px 40px -15px rgba(26, 78, 71, 0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            color: #FFFFFF;
            padding: 36px 32px 28px;
            text-align: center;
            position: relative;
        }

        .header-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 64px;
            height: 64px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(201, 138, 60, 0.4);
            border-radius: 20px;
            margin-bottom: 16px;
            font-size: 28px;
        }

        .header h1 {
            font-family: 'Amiri', serif;
            font-size: 28px;
            font-weight: 700;
            color: #FFFFFF;
            margin-bottom: 6px;
        }

        .header p {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
        }

        .stepper {
            display: flex;
            background: #EAE6DE;
            padding: 4px;
            border-bottom: 1px solid var(--border);
        }

        .step-item {
            flex: 1;
            padding: 12px 8px;
            text-align: center;
            font-size: 13px;
            font-weight: 700;
            color: var(--text-muted);
            border-radius: 12px;
            transition: all 0.2s;
        }

        .step-item.active {
            background: var(--surface);
            color: var(--primary);
            box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }

        .step-item.completed {
            color: var(--success);
        }

        .content {
            padding: 32px;
        }

        .step-panel {
            display: none;
        }

        .step-panel.active {
            display: block;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .section-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .req-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            background: #FAF8F5;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid var(--border);
        }

        .req-table th, .req-table td {
            padding: 12px 16px;
            font-size: 13px;
            text-align: right;
            border-bottom: 1px solid var(--border);
        }

        .req-table tr:last-child td {
            border-bottom: none;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
        }

        .badge-success {
            background: #DEF7EC;
            color: #03543F;
        }

        .badge-danger {
            background: #FDE8E8;
            color: #9B1C1C;
        }

        .form-group {
            margin-bottom: 18px;
        }

        .form-label {
            display: block;
            font-size: 13px;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 6px;
        }

        .form-hint {
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 4px;
        }

        .form-input {
            width: 100%;
            padding: 12px 16px;
            border: 1.5px solid var(--border);
            border-radius: 14px;
            font-size: 14px;
            background: #FAF8F5;
            color: var(--text-main);
            transition: all 0.2s;
            outline: none;
        }

        .form-input:focus {
            border-color: var(--primary);
            background: #FFFFFF;
            box-shadow: 0 0 0 3px rgba(26, 78, 71, 0.12);
        }

        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        @media (max-width: 540px) {
            .grid-2 {
                grid-template-columns: 1fr;
            }
        }

        .alert {
            padding: 14px 18px;
            border-radius: 14px;
            font-size: 13px;
            line-height: 1.5;
            margin-bottom: 20px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }

        .alert-info {
            background: #E1EFFE;
            color: #1E429F;
            border: 1px solid #B4C6E7;
        }

        .alert-success {
            background: #DEF7EC;
            color: #03543F;
            border: 1px solid #BCF0DA;
        }

        .alert-danger {
            background: #FDE8E8;
            color: #9B1C1C;
            border: 1px solid #FBD5D5;
        }

        .btn-group {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 28px;
            padding-top: 20px;
            border-top: 1px solid var(--border);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 24px;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            text-decoration: none;
        }

        .btn-primary {
            background: var(--primary);
            color: #FFFFFF;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: #EAE6DE;
            color: var(--text-main);
        }

        .btn-secondary:hover {
            background: #DDD8CD;
        }

        .btn-accent {
            background: var(--accent);
            color: #FFFFFF;
        }

        .btn-accent:hover {
            background: #B3772E;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }

        .success-box {
            text-align: center;
            padding: 32px 16px;
        }

        .success-icon {
            width: 80px;
            height: 80px;
            background: #DEF7EC;
            color: #03543F;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            margin-bottom: 20px;
        }

        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #FFFFFF;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <div class="header-icon">🏛️</div>
        <h1>تثبيت منظومة مقاعد الأقسام</h1>
        <p>معالج الإعداد والربط التلقائي بقاعدة بيانات MySQL لخوادم cPanel و XAMPP</p>
    </div>

    <?php if ($isInstalled): ?>
        <div class="content">
            <div class="alert alert-info">
                ℹ️ <strong>النظام مثبت مسبقاً!</strong><br>
                لقد تم إعداد قاعدة البيانات وملف الإعدادات من قبل. يمكنك التوجه مباشرة إلى صفحة تسجيل الدخول واستخدام النظام.
            </div>
            <div style="text-align: center; margin-top: 24px;">
                <a href="index.html" class="btn btn-primary" style="padding: 14px 32px; font-size: 15px;">
                    الدخول إلى المنظومة الرئيسية ⬅
                </a>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 16px;">
                ملاحظة: إذا أردت إعادة التثبيت من جديد، يرجى حذف ملف <code>installed.lock</code> من مدير الملفات في الخادم.
            </p>
        </div>
    <?php else: ?>
        <div class="stepper">
            <div class="step-item active" id="step-nav-1">1. فحص الخادم</div>
            <div class="step-item" id="step-nav-2">2. قاعدة البيانات</div>
            <div class="step-item" id="step-nav-3">3. المؤسسة والإدارة</div>
            <div class="step-item" id="step-nav-4">4. إنهاء</div>
        </div>

        <div class="content">
            <!-- الخطوة 1: فحص بيئة الخادم -->
            <div class="step-panel active" id="step-1">
                <div class="section-title">🔍 فحص متطلبات بيئة الخادم (PHP & Extensions)</div>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
                    يقوم المعالج بفحص إصدار PHP والمكتبات اللازمة لضمان سرعة واستقرار قاعدة البيانات.
                </p>

                <table class="req-table">
                    <thead>
                        <tr>
                            <th>المتطلب</th>
                            <th>المطلوب</th>
                            <th>المتوفر بالخادم</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($requirements as $req): ?>
                            <tr>
                                <td><strong><?= htmlspecialchars($req['name']) ?></strong></td>
                                <td><?= htmlspecialchars($req['required']) ?></td>
                                <td><?= htmlspecialchars($req['current']) ?></td>
                                <td>
                                    <?php if ($req['status']): ?>
                                        <span class="badge badge-success">✓ متوافق</span>
                                    <?php else: ?>
                                        <span class="badge badge-danger">✗ غير متوافق</span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>

                <?php if ($allRequirementsPassed): ?>
                    <div class="alert alert-success">
                        ✓ خادمك يلبي جميع المتطلبات! يمكنك الانتقال إلى الخطوة التالية لإعداد قاعدة البيانات.
                    </div>
                <?php else: ?>
                    <div class="alert alert-danger">
                        ⚠️ الخادم يفتقر لبعض المتطلبات الضرورية أعلاه. يرجى تفعيل امتدادات PDO و PDO_MYSQL وإعطاء صلاحيات الكتابة للمجلد.
                    </div>
                <?php endif; ?>

                <div class="btn-group" style="justify-content: flex-end;">
                    <button type="button" class="btn btn-primary" onclick="goToStep(2)" <?= !$allRequirementsPassed ? 'disabled' : '' ?>>
                        متابعة الإعداد ⬅
                    </button>
                </div>
            </div>

            <!-- الخطوة 2: إعدادات قاعدة البيانات MySQL -->
            <div class="step-panel" id="step-2">
                <div class="section-title">🗄️ إعدادات الاتصال بقاعدة بيانات MySQL</div>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
                    أدخل معلومات قاعدة البيانات التي أنشأتها في cPanel أو phpMyAdmin (أو XAMPP).
                </p>

                <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 12px 16px; margin-bottom: 18px; font-size: 13px; color: #1E40AF; line-height: 1.6;">
                    💡 <strong>ملاحظة هامة لمستخدمي cPanel / الاستضافات:</strong><br>
                    تأكد من كتابة الاسم الكامل لقاعدة البيانات والمستخدم متضمناً بادئة الاستضافة، مثلاً:
                    <code>cpaneluser_school</code> وليس <code>school</code> فقط. وتأكد من ربط المستخدم بقاعدة البيانات في لوحة cPanel مع منح جميع الصلاحيات (ALL PRIVILEGES).
                </div>

                <div id="db-alert"></div>

                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">خادم قاعدة البيانات (Database Host)</label>
                        <input type="text" id="db_host" class="form-input" value="localhost" placeholder="localhost">
                        <div class="form-hint">غالباً ما يكون <code>localhost</code></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">اسم قاعدة البيانات (Database Name)</label>
                        <input type="text" id="db_name" class="form-input" placeholder="مثال: school_map أو cpanel_school">
                        <div class="form-hint">اسم قاعدة البيانات الكامل في cPanel</div>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">اسم المستخدم (Database User)</label>
                        <input type="text" id="db_user" class="form-input" placeholder="مثال: root أو cpanel_user">
                    </div>
                    <div class="form-group">
                        <label class="form-label">كلمة المرور (Database Password)</label>
                        <input type="password" id="db_pass" class="form-input" placeholder="كلمة المرور (فارغة في XAMPP)">
                    </div>
                </div>

                <div style="margin-top: 10px;">
                    <button type="button" class="btn btn-secondary" id="btn-test-db" onclick="testDatabaseConnection()">
                        🔌 اختبار الاتصال بقاعدة البيانات
                    </button>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="goToStep(1)">السابق</button>
                    <button type="button" class="btn btn-primary" id="btn-to-step3" onclick="validateStep2()">
                        المتابعة لبيانات المؤسسة ⬅
                    </button>
                </div>
            </div>

            <!-- الخطوة 3: بيانات المؤسسة وحساب المشرف العام -->
            <div class="step-panel" id="step-3">
                <div class="section-title">🏫 بيانات المؤسسة التعليمية وحساب الإدارة</div>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                    حدد اسم المؤسسة التعليمية وأنشئ حساب المشرف العام الأول للنظام.
                </p>

                <div id="install-alert"></div>

                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">اسم المؤسسة التعليمية</label>
                        <input type="text" id="institution" class="form-input" value="الثانوية الإعدادية ايكسان">
                    </div>
                    <div class="form-group">
                        <label class="form-label">الموسم الدراسي</label>
                        <input type="text" id="academic_year" class="form-input" value="2026/2027">
                    </div>
                </div>

                <div style="margin: 16px 0; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: #334155;">
                        <input type="checkbox" id="skip_tables" value="1">
                        <span>لقد قمت مسبقاً باستيراد الجداول عبر phpMyAdmin (تخطي إنشاء الجداول واكتفِ بضبط الإعدادات والحساب)</span>
                    </label>
                </div>

                <div style="margin: 20px 0 14px; border-top: 1px dashed var(--border); padding-top: 16px;">
                    <h3 style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 12px;">
                        👤 حساب المشرف العام (المدير / الحارس العام)
                    </h3>
                </div>

                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">الاسم الكامل للمشرف</label>
                        <input type="text" id="admin_name" class="form-input" value="المشرف العام (الإدارة التربوية)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">اسم المستخدم للدخول</label>
                        <input type="text" id="admin_username" class="form-input" value="admin">
                    </div>
                </div>

                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">البريد الإلكتروني</label>
                        <input type="email" id="admin_email" class="form-input" value="admin@echsa.ma">
                    </div>
                    <div class="form-group">
                        <label class="form-label">كلمة المرور الجديدة</label>
                        <input type="password" id="admin_password" class="form-input" value="admin123">
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="goToStep(2)">السابق</button>
                    <button type="button" class="btn btn-accent" id="btn-do-install" onclick="executeFullInstallation()">
                        🚀 بدء التثبيت التلقائي وإنشاء الجداول
                    </button>
                </div>
            </div>

            <!-- الخطوة 4: اكتمال التثبيت بنجاح -->
            <div class="step-panel" id="step-4">
                <div class="success-box">
                    <div class="success-icon">🎉</div>
                    <h2 style="font-family: 'Amiri', serif; font-size: 26px; color: var(--primary); margin-bottom: 10px;">
                        تم تثبيت النظام بنجاح تام!
                    </h2>
                    <p style="font-size: 14px; color: var(--text-muted); max-width: 480px; margin: 0 auto 24px; line-height: 1.6;">
                        تم بناء كافة جداول MySQL، وتوليد ملف الإعدادات <code>config.php</code>، وتفعيل حساب المشرف العام. منظومتك الآن جاهزة للعمل والاستخدام بالكامل.
                    </p>

                    <div style="background: #FAF8F5; border: 1px solid var(--border); border-radius: 16px; padding: 18px; text-align: right; max-width: 420px; margin: 0 auto 28px;">
                        <div style="font-size: 13px; font-weight: 700; color: var(--primary); margin-bottom: 8px;">🔑 بيانات الدخول الخاصة بك:</div>
                        <div style="font-size: 13px; color: var(--text-main); margin-bottom: 4px;">• اسم المستخدم: <strong id="res-username">admin</strong></div>
                        <div style="font-size: 13px; color: var(--text-main);">• الرتبة: <strong>مشرف عام (Admin)</strong></div>
                    </div>

                    <div id="manual-config-box" style="display: none; margin: 0 auto 24px; max-width: 480px; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 14px; padding: 16px; text-align: right;">
                        <div style="font-weight: 700; color: #92400E; margin-bottom: 6px;">⚠️ تنبيه: تعذر حفظ ملف config.php تلقائياً</div>
                        <p style="font-size: 12px; color: #78350F; margin-bottom: 12px; line-height: 1.5;">
                            تم إنشاء الجداول والمشرف بنجاح، ولكن الخادم لم يسمح بحفظ ملف <code>config.php</code> بسبب صلاحيات المجلد (Permission). يرجى تنزيله وحفظه داخل المجلد الرئيسي للنظام:
                        </p>
                        <div style="display: flex; gap: 8px; justify-content: center;">
                            <button type="button" class="btn btn-primary" onclick="downloadConfigFile()" style="padding: 8px 16px; font-size: 13px;">💾 تحميل config.php جاهزاً</button>
                            <button type="button" class="btn btn-secondary" onclick="copyConfigCode()" style="padding: 8px 16px; font-size: 13px;">📋 نسخ الكود</button>
                        </div>
                    </div>

                    <a href="index.html" class="btn btn-primary" style="padding: 14px 36px; font-size: 15px;">
                        الانتقال إلى المنظومة وتسجيل الدخول ⬅
                    </a>
                </div>
            </div>
        </div>
    <?php endif; ?>
</div>

<script>
let isDbConnected = false;
let generatedConfigContent = '';

function goToStep(stepNum) {
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step-item').forEach(s => s.classList.remove('active'));

    const targetPanel = document.getElementById('step-' + stepNum);
    const targetNav = document.getElementById('step-nav-' + stepNum);
    if (targetPanel) targetPanel.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    for (let i = 1; i < stepNum; i++) {
        const prevNav = document.getElementById('step-nav-' + i);
        if (prevNav) prevNav.classList.add('completed');
    }
}

async function testDatabaseConnection() {
    const btn = document.getElementById('btn-test-db');
    const alertBox = document.getElementById('db-alert');
    const host = document.getElementById('db_host').value.trim();
    const name = document.getElementById('db_name').value.trim();
    const user = document.getElementById('db_user').value.trim();
    const pass = document.getElementById('db_pass').value;

    if (!name || !user) {
        alertBox.innerHTML = '<div class="alert alert-danger">⚠️ يرجى ملء اسم قاعدة البيانات واسم المستخدم أولاً.</div>';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جارٍ اختبار الاتصال...';
    alertBox.innerHTML = '';

    const formData = new FormData();
    formData.append('action', 'test_connection');
    formData.append('db_host', host);
    formData.append('db_name', name);
    formData.append('db_user', user);
    formData.append('db_pass', pass);

    try {
        const res = await fetch('install.php', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            isDbConnected = true;
            alertBox.innerHTML = '<div class="alert alert-success">✓ ' + data.message + '</div>';
        } else {
            isDbConnected = false;
            let helpHtml = data.help ? '<div style="margin-top: 8px; font-size: 12px; color: #7F1D1D; line-height: 1.5;">💡 <strong>كيف تحل هذا الخطأ:</strong> ' + data.help + '</div>' : '';
            alertBox.innerHTML = '<div class="alert alert-danger"><div>✗ ' + data.error + '</div>' + helpHtml + '</div>';
        }
    } catch (err) {
        alertBox.innerHTML = '<div class="alert alert-danger">✗ خطأ أثناء الاتصال بالخادم: ' + err.message + '</div>';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🔌 اختبار الاتصال بقاعدة البيانات';
    }
}

function validateStep2() {
    const name = document.getElementById('db_name').value.trim();
    const user = document.getElementById('db_user').value.trim();
    const alertBox = document.getElementById('db-alert');

    if (!name || !user) {
        alertBox.innerHTML = '<div class="alert alert-danger">⚠️ يرجى إدخال اسم قاعدة البيانات واسم المستخدم قبل المتابعة.</div>';
        return;
    }
    goToStep(3);
}

async function executeFullInstallation() {
    const btn = document.getElementById('btn-do-install');
    const alertBox = document.getElementById('install-alert');

    const host = document.getElementById('db_host').value.trim();
    const name = document.getElementById('db_name').value.trim();
    const user = document.getElementById('db_user').value.trim();
    const pass = document.getElementById('db_pass').value;

    const institution = document.getElementById('institution').value.trim();
    const year = document.getElementById('academic_year').value.trim();

    const adminName = document.getElementById('admin_name').value.trim();
    const adminUser = document.getElementById('admin_username').value.trim();
    const adminEmail = document.getElementById('admin_email').value.trim();
    const adminPass = document.getElementById('admin_password').value;
    const skipTables = document.getElementById('skip_tables')?.checked ? '1' : '0';

    if (!adminUser || !adminPass) {
        alertBox.innerHTML = '<div class="alert alert-danger">⚠️ يرجى تحديد اسم مستخدم وكلمة مرور للمشرف العام.</div>';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جارٍ إنشاء الجداول وضبط الإعدادات...';
    alertBox.innerHTML = '';

    const formData = new FormData();
    formData.append('action', 'execute_installation');
    formData.append('db_host', host);
    formData.append('db_name', name);
    formData.append('db_user', user);
    formData.append('db_pass', pass);
    formData.append('institution', institution);
    formData.append('academic_year', year);
    formData.append('admin_name', adminName);
    formData.append('admin_username', adminUser);
    formData.append('admin_email', adminEmail);
    formData.append('admin_password', adminPass);
    formData.append('skip_tables', skipTables);

    try {
        const res = await fetch('install.php', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            document.getElementById('res-username').innerText = adminUser;
            if (!data.config_saved && data.config_content) {
                generatedConfigContent = data.config_content;
                document.getElementById('manual-config-box').style.display = 'block';
            }
            goToStep(4);
        } else {
            alertBox.innerHTML = '<div class="alert alert-danger">✗ فشل التثبيت: ' + data.error + '</div>';
            btn.disabled = false;
            btn.innerHTML = '🚀 بدء التثبيت التلقائي وإنشاء الجداول';
        }
    } catch (err) {
        alertBox.innerHTML = '<div class="alert alert-danger">✗ حدث خطأ غير متوقع: ' + err.message + '</div>';
        btn.disabled = false;
        btn.innerHTML = '🚀 بدء التثبيت التلقائي وإنشاء الجداول';
    }
}

function downloadConfigFile() {
    if (!generatedConfigContent) return;
    const blob = new Blob([generatedConfigContent], { type: 'application/x-httpd-php' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.php';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyConfigCode() {
    if (!generatedConfigContent) return;
    navigator.clipboard.writeText(generatedConfigContent).then(() => {
        alert('✓ تم نسخ كود config.php إلى الحافظة بنجاح!');
    }).catch(() => {
        prompt('انسخ كود config.php أدناه:', generatedConfigContent);
    });
}
</script>

</body>
</html>
